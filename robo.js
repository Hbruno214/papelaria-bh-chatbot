const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const winston = require('winston');
const express = require('express');
const qrcodeLib = require('qrcode');
const fs = require('fs');

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

// Diretório de uploads
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Servidor para evitar timeout
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot-whatsapp", dataPath: process.env.SESSION_PATH }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Números bloqueados
const blockedNumbers = ['+5582981452814@c.us', '+5582987616759@c.us'];

// Função para verificar se o número é bloqueado
const isBlockedNumber = (number) => {
    const formattedNumber = `${number}@c.us`; // Formata o número para o formato esperado
    return blockedNumbers.includes(formattedNumber);
};

// Função para verificar horário de funcionamento
const isWithinBusinessHours = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    return day >= 1 && day <= 6 && hour >= 8 && hour < 18;
};

// Serviço de leitura do QR code
client.on('qr', async qr => {
    qrcode.generate(qr, { small: true });
    logger.info('QR code gerado.');
    try {
        await qrcodeLib.toFile('./qrcode.png', qr);
        console.log("QR Code saved as qrcode.png");
    } catch (err) {
        console.error(err);
    }
});

// Evento de conexão
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
    logger.info('WhatsApp conectado com sucesso.');
});

// Inicializa o cliente
client.initialize();

// Delay para simular o estado de digitação
const delay = ms => new Promise(res => setTimeout(res, ms));

// Atendimento
client.on('message', async msg => {
    // Verifica se o número está bloqueado
    console.log(`Verificando número: ${msg.from}`); // Log de depuração
    if (isBlockedNumber(msg.from)) {
        logger.info(`Mensagem ignorada de número bloqueado: ${msg.from}`);
        return; // Sai da função sem responder
    }

    try {
        // Ignora mensagens de grupos
        if (msg.from.endsWith('@g.us')) {
            logger.info(`Mensagem ignorada de grupo: ${msg.from}`);
            return;
        }

        // Verifica horário de funcionamento
        if (!isWithinBusinessHours()) {
            await client.sendMessage(msg.from, '⏰ Olá! No momento, estamos fora do horário de funcionamento. A *Papelaria BH* atende de *segunda a sábado*, das *8h às 18h*. Por favor, entre em contato novamente dentro desse horário. Obrigado!');
            logger.info(`Mensagem fora do horário de funcionamento de ${msg.from}`);
            return;
        }

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const name = contact.pushname ? contact.pushname.split(" ")[0] : 'Cliente';

        // Mensagem de boas-vindas e opções de serviços
        if (msg.body.match(/(menu|oi|olá|bom dia|boa tarde|boa noite|serviços|materiais)/i) && msg.from.endsWith('@c.us')) {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH* ️. Como posso ajudar? Aqui estão algumas opções de serviços:\n\n *1 - Impressão* (R$ 2,00 por página)\n *2 - Xerox* (R$ 0,50 por documento)\n *3 - Revelação de Foto* (R$ 5,00)\n *4 - Foto 3x4* (R$ 5,00 por 6 unidades)\n *5 - Plastificação A4* (R$ 7,00)\n *6 - Plastificação SUS* (R$ 5,00)\n *7 - Impressão em papel cartão* (R$ 3,00)\n *8 - Papel fotográfico adesivo* (R$ 5,00)\n *9 - Encadernação 50 folhas* (R$ 12,00)\n *10 - Ver mais opções de materiais e variedades*\n\nDiga o número da opção que deseja, ou envie seu arquivo para impressão.`);
            await delay(3000);
            await chat.sendStateTyping();
        } else if (msg.body === '1') {
            await handlePrintRequest(msg.from, name);
        } else if (msg.body === '2') {
            await handleXeroxRequest(msg.from, name);
        } else if (msg.body === '3') {
            await handlePhotoRevelationRequest(msg.from, name);
        } else if (msg.body === '4') {
            await handlePhoto3x4Request(msg.from, name);
        } else if (msg.body.toLowerCase().includes('pagamento')) {
            await handlePaymentRequest(msg.from);
        } else {
            await handleFileUpload(msg);
        }

    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});

// Funções para atender cada serviço
const handlePrintRequest = async (from, name) => {
    await client.sendMessage(from, '️ O valor da impressão é *R$ 2,00 por página*. Envie o arquivo para que possamos imprimir. O prazo para a impressão é de *5 a 10 minutos*. Quando estiver pronto, você poderá buscar aqui na *Papelaria BH*.');
    setTimeout(async () => {
        await client.sendMessage(from, `*${name}*, seu pedido de impressão está pronto! Pode retirar na *Papelaria BH*.`);
    }, 600000); // 10 minutos
};

const handleXeroxRequest = async (from, name) => {
    await client.sendMessage(from, 'O valor da xerox é *R$ 0,50 por documento*. O prazo para a xerox é de *5 a 10 minutos*. Envie os documentos que deseja copiar e busque na *Papelaria BH*.');
    setTimeout(async () => {
        await client.sendMessage(from, `*${name}*, sua xerox está pronta! Pode retirar na *Papelaria BH*.`);
    }, 600000); // 10 minutos
};

const handlePhotoRevelationRequest = async (from, name) => {
    await client.sendMessage(from, '️ O valor para revelação de foto é *R$ 5,00*. O prazo para a revelação é de *5 a 10 minutos*. Envie a foto que deseja revelar e venha buscar na *Papelaria BH*.');
    setTimeout(async () => {
        await client.sendMessage(from, `*${name}*, sua revelação de foto está pronta! Pode retirar na *Papelaria BH*.`);
    }, 600000); // 10 minutos
};

const handlePhoto3x4Request = async (from, name) => {
    await client.sendMessage(from, 'O valor para foto 3x4 é *R$ 5,00 para 6 unidades*. O prazo para a foto é de *5 a 10 minutos*. Envie sua foto para impressão ou venha tirar aqui na *Papelaria BH*.');
    setTimeout(async () => {
        await client.sendMessage(from, `*${name}*, sua foto 3x4 está pronta! Pode retirar na *Papelaria BH*.`);
    }, 600000); // 10 minutos
};

// Função para receber arquivos
const handleFileUpload = async (msg) => {
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        const fileName = `${uploadDir}/${msg.id}.jpg`; // Ajuste conforme necessário
        fs.writeFileSync(fileName, media.data, { encoding: 'base64' });
        await client.sendMessage(msg.from, 'Arquivo recebido com sucesso! Obrigado por utilizar nossos serviços.');
        await client.sendMessage(msg.from, 'Gostaríamos de saber se o atendimento foi satisfatório. Por favor, responda com "sim" ou "não".');
    }
};

// Função de pagamento
const handlePaymentRequest = async (from) => {
    const pixMessage = '💸 Para pagamentos, você pode usar o Pix:\nChave: *82987616759*';
    await client.sendMessage(from, pixMessage);
};

// Feedback do cliente
const handleFeedback = async (msg) => {
    if (msg.body.toLowerCase() === 'sim') {
        await client.sendMessage(msg.from, '🎉 Que bom que você ficou satisfeito! Agradecemos pelo feedback. Se precisar de mais alguma coisa, estamos à disposição.');
    } else if (msg.body.toLowerCase() === 'não') {
        await client.sendMessage(msg.from, '😞 Lamentamos saber disso. Por favor, nos diga como podemos melhorar.');
    }
};

