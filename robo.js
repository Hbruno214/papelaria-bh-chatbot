const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const winston = require('winston');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// Cria um endpoint de escuta para evitar timeout
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Configura o cliente do WhatsApp com a sessão
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot-whatsapp", dataPath: process.env.SESSION_PATH }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Função para verificar se estamos dentro do horário de funcionamento
const isWithinBusinessHours = () => {
    const now = new Date();
    const day = now.getDay();  // 0 - Domingo, 1 - Segunda, ..., 6 - Sábado
    const hour = now.getHours();  // Horas do dia, de 0 a 23
    // A papelaria funciona de segunda a sábado (1 a 6), das 8h às 18h
    return day >= 1 && day <= 6 && hour >= 8 && hour < 18;
};

// Geração de código de pedido único
const generateOrderCode = () => `BH-${Date.now()}`;

// Serviço de leitura do QR code
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    logger.info('QR code gerado.');
});

// Evento de sucesso ao conectar
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
    logger.info('WhatsApp conectado com sucesso.');
});

// Inicializa o cliente
client.initialize();

// Função de delay
const delay = ms => new Promise(res => setTimeout(res, ms));

// Funil de atendimento
client.on('message', async msg => {
    const telefoneBloqueado = process.env.BLOCKED_PHONE || '5582981452814@c.us';
    try {
        // Verifica se a mensagem veio de um grupo
        if (msg.from.endsWith('@g.us')) {
            logger.info(`Mensagem ignorada de grupo: ${msg.from}`);
            return;
        }

        // Verifica se a mensagem é do número bloqueado
        if (msg.from === telefoneBloqueado) {
            logger.warn(`Mensagem recebida de número bloqueado: ${msg.from}`);
            return;
        }

        // Verifica se estamos fora do horário de funcionamento
        if (!isWithinBusinessHours()) {
            await client.sendMessage(msg.from, '⏰ Olá! No momento, estamos fora do horário de funcionamento. A *Papelaria BH* atende de *segunda a sábado*, das *8h às 18h*. Por favor, entre em contato novamente dentro desse horário. Obrigado!');
            logger.info(`Mensagem fora do horário de funcionamento de ${msg.from}`);
            return;
        }

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const name = contact.pushname ? contact.pushname.split(" ")[0] : 'Cliente';

        if (msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola|preço|valor|valores|impressão|xerox|foto|serviços|materiais)/i) && msg.from.endsWith('@c.us')) {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH* ️. Como posso ajudar? Aqui estão algumas opções de serviços:\n\n *1 - Impressão* (R$ 2,00 por página)\n *2 - Xerox* (R$ 0,50 por documento)\n️ *3 - Revelação de Foto* (R$ 5,00)\n *4 - Foto 3x4* (R$ 5,00 por 6 unidades)\n *5 - Plastificação A4* (R$ 7,00)\n *6 - Plastificação SUS* (R$ 5,00)\n *7 - Impressão em papel cartão* (R$ 3,00)\n *8 - Papel fotográfico adesivo* (R$ 5,00)\n *9 - Encadernação 50 folhas* (R$ 12,00)\n *10 - Ver mais opções de materiais e variedades*\n\nDiga o número da opção que deseja, ou envie seu arquivo para impressão.`);
            await delay(3000);
            await chat.sendStateTyping();
        } else if (msg.body === '1') {
            await client.sendMessage(msg.from, '️ O valor da impressão é *R$ 2,00 por página*. Envie o arquivo para que possamos imprimir. O prazo para a impressão é de *5 a 10 minutos*. Quando estiver pronto, você poderá buscar aqui na *Papelaria BH*.');
            setTimeout(async () => {
                await client.sendMessage(msg.from, `*${name}*, seu pedido de impressão está pronto! Pode retirar na *Papelaria BH*.`);
            }, 600000);  // 10 minutos = 600000 ms
        } else if (msg.body === '2') {
            await client.sendMessage(msg.from, 'O valor da xerox é *R$ 0,50 por documento*. O prazo para a xerox é de *5 a 10 minutos*. Envie os documentos que deseja copiar e busque na *Papelaria BH*.');
            setTimeout(async () => {
                await client.sendMessage(msg.from, `*${name}*, sua xerox está pronta! Pode retirar na *Papelaria BH*.`);
            }, 600000);  // 10 minutos
        } else if (msg.body === '3') {
            await client.sendMessage(msg.from, '️ O valor para revelação de foto é *R$ 5,00*. O prazo para a revelação é de *5 a 10 minutos*. Envie a foto que deseja revelar e venha buscar na *Papelaria BH*.');
            setTimeout(async () => {
                await client.sendMessage(msg.from, `*${name}*, sua revelação de foto está pronta! Pode retirar na *Papelaria BH*.`);
            }, 600000);  // 10 minutos
        } else if (msg.body === '4') {
            await client.sendMessage(msg.from, 'O valor para foto 3x4 é *R$ 5,00 para 6 unidades*. O prazo para a foto é de *5 a 10 minutos*. Envie sua foto para impressão ou venha tirar aqui na *Papelaria BH*.');
            setTimeout(async () => {
                await client.sendMessage(msg.from, `*${name}*, sua foto 3x4 está pronta! Pode retirar na *Papelaria BH*.`);
            }, 600000);  // 10 minutos
        }

        // Recebendo arquivos (adicionar funções conforme necessário)
    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});
