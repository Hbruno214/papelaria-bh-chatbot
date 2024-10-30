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

// Configuração do diretório de uploads
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

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

// Ajuste para o horário de Brasília
const isWithinBusinessHours = () => {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const day = brasiliaTime.toLocaleString("pt-BR", { weekday: 'short' }).toLowerCase();
    const hour = brasiliaTime.getHours();

    const isWeekday = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].includes(day);
    const isWithinHours = hour >= 8 && hour < 18;

    logger.info(`Horário atual em Brasília: ${brasiliaTime.toLocaleString("pt-BR")}. Função isWithinBusinessHours: ${isWeekday && isWithinHours}`);
    return isWeekday && isWithinHours;
};

// Geração do QR Code
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

// Evento de sucesso ao conectar
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
    logger.info('WhatsApp conectado com sucesso.');
});

// Inicializa o cliente
client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('message', async msg => {
    const telefoneBloqueado = process.env.BLOCKED_PHONE || '5582981452814@c.us';
    try {
        if (msg.from.endsWith('@g.us')) {
            logger.info(`Mensagem ignorada de grupo: ${msg.from}`);
            return;
        }

        if (msg.from === telefoneBloqueado) {
            logger.warn(`Mensagem recebida de número bloqueado: ${msg.from}`);
            return;
        }

        if (!isWithinBusinessHours()) {
            await client.sendMessage(msg.from, '⏰ Estamos fora do horário de funcionamento. A Papelaria BH atende de segunda a sábado, das 8h às 18h. Por favor, entre em contato nesse período. Obrigado!');
            logger.info(`Mensagem fora do horário de funcionamento de ${msg.from}`);
            return;
        }

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const name = contact.pushname ? contact.pushname.split(" ")[0] : 'Cliente';

        // Mensagem de boas-vindas e opções de serviços
        if (msg.body.match(/(menu|oi|olá|ola|serviços|materiais)/i) && msg.from.endsWith('@c.us')) {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH* ️. Aqui estão algumas opções:\n\n1 - Impressão\n2 - Xerox\n3 - Revelação de Foto\n4 - Foto 3x4\n5 - Plastificação A4\n6 - Plastificação SUS\n7 - Impressão em papel cartão\n8 - Papel fotográfico adesivo\n9 - Encadernação 50 folhas\n10 - Mais opções de materiais.\n\nDiga o número da opção ou envie seu arquivo.`);
            await delay(3000);
            await chat.sendStateTyping();
        } 
        // Lógica para resposta a arquivos
        else if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const filePath = `${uploadDir}/${msg.id.id}.${media.mimetype.split('/')[1]}`;
            fs.writeFileSync(filePath, media.data, { encoding: 'base64' });
            await client.sendMessage(msg.from, `📥 Recebemos seu arquivo com sucesso. Nome do arquivo: *${filePath}*. Processaremos seu pedido em breve. Seu arquivo estará pronto em 5 minutos para retirar na papelaria.\n\nObrigado! Você pode pagar via PIX (chave: 82987616759) ou na loja.`);
            logger.info(`Arquivo recebido de ${msg.from}: ${filePath}`);
            // Pergunta de feedback
            await delay(3000);
            await client.sendMessage(msg.from, `Gostaríamos de saber sua opinião! Você ficou satisfeito com o serviço? Responda com "Sim" ou "Não".`);
        } 
        // Lógica para serviços
        else if (msg.body >= '1' && msg.body <= '10') {
            // Lógica de resposta para cada opção
            // [Conteúdo aqui]
        } else {
            await client.sendMessage(msg.from, 'Desculpe, não entendi. Por favor, envie um número de opção ou escreva "menu".');
        }

    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});

// Lógica para feedback do cliente
client.on('message', async msg => {
    const feedbackPrompt = ['sim', 'não'];
    
    if (feedbackPrompt.includes(msg.body.toLowerCase())) {
        if (msg.body.toLowerCase() === 'sim') {
            await client.sendMessage(msg.from, 'Agradecemos seu feedback positivo! Estamos aqui para ajudar sempre que precisar.');
        } else {
            await client.sendMessage(msg.from, 'Agradecemos por seu feedback! Vamos trabalhar para melhorar nossos serviços.');
        }
    }
});
