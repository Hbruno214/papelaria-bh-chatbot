// Dependências
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const winston = require('winston');
const express = require('express');
const axios = require('axios'); // Adiciona a biblioteca axios

const app = express();
const PORT = process.env.PORT || 3000;

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot-whatsapp" }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// Função para verificar se está dentro do horário de atendimento
const isWithinBusinessHours = () => {
    const now = new Date();
    now.setHours(now.getUTCHours() - 3); // Ajuste para horário de Brasília
    const day = now.getDay();
    const hour = now.getHours();

    // Retorna falso aos domingos e fora do horário de atendimento
    if (day === 0 || hour < 8 || hour >= 18) {
        return false;
    }
    return day >= 1 && day <= 6;
};

// Geração de QR Code
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    logger.info('QR code gerado.');
});

// Quando o cliente está conectado
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
    logger.info('WhatsApp conectado com sucesso.');
});

client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

// Mensagem padrão de opções
const sendOptions = async (chat, name) => {
    const optionsMessage = `Olá, *${name}*! Como posso ajudar você hoje?\n\nEscolha uma das opções abaixo:\n1. Impressão\n2. Preços\n3. Outros serviços`;
    await chat.sendMessage(optionsMessage);
};

// Função para chamar a API do Hugging Face
const sendMessageToModel = async (message) => {
    const TOKEN = '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'; // Seu token atualizado
    const MODEL_URL = 'https://api-inference.huggingface.co/models/Hbruno214/chatbot-modelo'; // URL do seu modelo

    try {
        const response = await axios.post(MODEL_URL, {
            inputs: message
        }, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data) {
            logger.info('Resposta recebida do modelo:', response.data);
            return response.data; // Retorna a resposta do modelo
        } else {
            throw new Error('Resposta do modelo está vazia.');
        }
    } catch (error) {
        // Log de erro mais detalhado
        console.error('Erro ao se comunicar com o modelo:', error.message);
        logger.error('Erro ao se comunicar com o modelo:', {
            message: error.message,
            config: error.config,
            response: error.response ? error.response.data : 'Sem resposta',
        });
        return 'Desculpe, não consegui processar sua solicitação. Por favor, tente novamente.';
    }
};

// Processamento de mensagens
client.on('message', async msg => {
    console.log(`Mensagem recebida: ${msg.body}`);
    const telefoneBloqueado = process.env.BLOCKED_PHONE || '5582981452814@c.us';

    try {
        if (msg.from.endsWith('@g.us') || msg.from === telefoneBloqueado) {
            console.log(`Mensagem ignorada de grupo ou número bloqueado: ${msg.from}`);
            return;
        }

        // Verifica o horário de funcionamento
        if (!isWithinBusinessHours()) {
            await client.sendMessage(msg.from, '⏰ Olá! Estamos fora do horário de atendimento. A Papelaria BH atende de segunda a sábado, das 8h às 18h. Por favor, entre em contato dentro desse horário. Obrigado!');
            console.log(`Mensagem enviada para ${msg.from} sobre horário de funcionamento.`);
            logger.info(`Mensagem fora do horário de funcionamento de ${msg.from}`);
            return;
        }

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const name = contact.pushname ? contact.pushname.split(" ")[0] : 'Cliente';
        const lowerCaseMessage = msg.body.toLowerCase();

        // Enviar opções se for a primeira mensagem
        if (lowerCaseMessage.includes('menu') || lowerCaseMessage.includes('oi') || lowerCaseMessage.includes('olá')) {
            await sendOptions(chat, name);
            return;
        }

        // Verificar se o cliente enviou um arquivo
        if (msg.hasMedia) {
            await msg.downloadMedia();
            await client.sendMessage(msg.from, `📩 Recebemos seu arquivo. O que você gostaria de fazer com ele?`);
            return;
        }

        // Processar as opções
        if (lowerCaseMessage.includes('1')) {
            await client.sendMessage(msg.from, 'Você selecionou Impressão. O valor da impressão é *R$ 2,00 por página*. Envie o arquivo para impressão.');
        } else if (lowerCaseMessage.includes('2')) {
            await client.sendMessage(msg.from, 'Os preços são os seguintes:\n1 - Impressão (R$ 2,00 por página)\n2 - Xerox (R$ 0,50 por documento)\n3 - Revelação de Foto (R$ 5,00)\n4 - Foto 3x4 (R$ 5,00 por 6 unidades)\n5 - Plastificação A4 (R$ 7,00)\n6 - Plastificação SUS (R$ 5,00)\n7 - Impressão em papel cartão (R$ 3,00)\n8 - Papel fotográfico adesivo (R$ 5,00)\n9 - Encadernação 50 folhas (R$ 12,00)\n10 - Ver mais opções de materiais e variedades');
        } else if (lowerCaseMessage.includes('3')) {
            await client.sendMessage(msg.from, 'Por favor, descreva qual outro serviço você gostaria de saber.');
        } else {
            // Enviar a mensagem para o modelo da Hugging Face se não for uma das opções conhecidas
            const responseFromModel = await sendMessageToModel(msg.body);
            await client.sendMessage(msg.from, responseFromModel);
        }

    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});
