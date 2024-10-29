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

// Verifica horário de funcionamento
const isWithinBusinessHours = () => {
    const now = new Date();
    const day = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: 'short' });
    const hour = parseInt(now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: 'numeric', hour12: false }));

    const dayNumber = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].indexOf(day);
    return dayNumber >= 1 && dayNumber <= 6 && hour >= 8 && hour < 18;
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

        if (msg.body.match(/(menu|oi|olá|ola|serviços|materiais)/i) && msg.from.endsWith('@c.us')) {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH* ️. Aqui estão algumas opções:\n\n1 - Impressão\n2 - Xerox\n3 - Revelação de Foto\n4 - Foto 3x4\n5 - Plastificação A4\n6 - Plastificação SUS\n7 - Impressão em papel cartão\n8 - Papel fotográfico adesivo\n9 - Encadernação 50 folhas\n10 - Mais opções de materiais.\n\nDiga o número da opção ou envie seu arquivo.`);
            await delay(3000);
            await chat.sendStateTyping();
        } else if (msg.body >= '1' && msg.body <= '10') {
            // Lógica de resposta para cada opção
            // [Conteúdo aqui]
        } else if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const filePath = `${uploadDir}/${msg.id.id}.${media.mimetype.split('/')[1]}`;
            fs.writeFileSync(filePath, media.data, { encoding: 'base64' });
            await client.sendMessage(msg.from, `📥 Recebemos seu arquivo com sucesso. Nome do arquivo: *${filePath}*. Processaremos seu pedido em breve.`);
            logger.info(`Arquivo recebido de ${msg.from}: ${filePath}`);
        } else {
            await client.sendMessage(msg.from, 'Desculpe, não entendi. Por favor, envie um número de opção ou escreva "menu".');
        }

    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});
