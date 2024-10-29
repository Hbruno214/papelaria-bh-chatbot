const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const winston = require('winston');
require('dotenv').config(); // Carregar variáveis de ambiente

// Configuração do Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// Inicializa o cliente do WhatsApp
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Gera o QR code
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    logger.info('QR code gerado. Escaneie para autenticar.');
});

// Conexão bem-sucedida
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
    logger.info('WhatsApp conectado com sucesso.');
});

// Verifica horário de funcionamento
const isWithinBusinessHours = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    return day >= 1 && day <= 6 && hour >= 8 && hour < 18;
};

// Funil de atendimento
client.on('message', async msg => {
    const telefoneBloqueado = process.env.BLOCKED_PHONE || '5582981452814@c.us';

    try {
        if (msg.from.endsWith('@g.us') || msg.from === telefoneBloqueado) {
            return; // Ignora grupos e números bloqueados
        }

        if (!isWithinBusinessHours()) {
            await client.sendMessage(msg.from, '⏰ Fora do horário de funcionamento. Retorne entre 8h e 18h, de segunda a sábado.');
            return;
        }

        const name = (await msg.getContact()).pushname?.split(" ")[0] || 'Cliente';
        if (/^(menu|oi|olá|preço|valor|impressão|serviços)$/i.test(msg.body)) {
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH*. Selecione um dos serviços:
1 - Impressão
2 - Xerox
3 - Revelação de Foto
Diga o número da opção desejada ou envie um arquivo.`);
        } else if (msg.body === '1') {
            await client.sendMessage(msg.from, 'Impressão: R$ 2,00 por página. Envie o arquivo para impressão.');
        } else if (msg.body === '2') {
            await client.sendMessage(msg.from, 'Xerox: R$ 0,50 por documento. Envie o documento para cópia.');
        } else if (msg.body === '3') {
            await client.sendMessage(msg.from, 'Revelação de Foto: R$ 5,00. Envie a foto para revelação.');
        }
    } catch (error) {
        logger.error('Erro ao processar a mensagem:', error);
    }
});

// Inicializa o cliente
client.initialize();
