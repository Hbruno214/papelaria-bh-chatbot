const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeLib = require('qrcode');
const winston = require('winston');
const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone'); // Certifique-se de usar moment-timezone para lidar com fusos horários

// Configuração do diretório de uploads
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuração do servidor Express e da porta
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot está ativo'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Configuração do logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console(), // Adicionei log no console para facilitar o monitoramento
    ],
});

// Lista de números bloqueados
const blockedNumbers = ["5582981452814@c.us", "5582987616759@c.us", "558281452814@c.us"];

// Função para verificar se o número está bloqueado
function isBlockedNumber(contactId) {
    return blockedNumbers.includes(contactId);
}

// Inicializa o cliente com checagem rigorosa de números bloqueados
const client = new Client({
    authStrategy: new LocalAuth()
});

// Geração do QR Code com verificação de bloqueio
client.on('qr', async qr => {
    qrcode.generate(qr, { small: true });
    logger.info('QR code gerado.');
    try {
        await qrcodeLib.toFile('./qrcode.png', qr);
        console.log("QR Code salvo como qrcode.png");
    } catch (err) {
        console.error(err);
    }
});

// Evento de sucesso ao conectar
client.on('ready', () => {
    console.log('✅ Bot conectado no WhatsApp.');
    logger.info('WhatsApp conectado com sucesso.');
});

// Exemplo de uso no evento de recebimento de mensagens com bloqueio rigoroso
client.on('message', async msg => {
    const contactId = msg.from;

    // Verificar se o número está bloqueado
    if (isBlockedNumber(contactId)) {
        logger.warn(`Mensagem ignorada de número bloqueado: ${contactId}`);
        return; // Ignora a mensagem e sai da função imediatamente
    }

    try {
        // Log de mensagens recebidas para monitoramento, excluindo bloqueados
        console.log(`Mensagem recebida de ${msg.from}: ${msg.body}`);

        // Verificação adicional de mensagens de grupos
        if (msg.from.endsWith('@g.us')) {
            logger.info(`Mensagem ignorada de grupo: ${msg.from}`);
            return;
        }

        // Verificar horário de funcionamento
        if (!isWithinBusinessHours()) {
            logger.info(`Mensagem recebida fora do horário de funcionamento de ${msg.from}.`);
            await client.sendMessage(msg.from, 'Desculpe, estamos fora do horário de atendimento. Nosso horário é de segunda a sábado, das 8h às 18h.');
            return;
        }

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const name = contact.pushname || 'Cliente';

        if (msg.body.match(/(menu|oi|olá|ola|serviços|materiais)/i)) {
            await chat.sendStateTyping();
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH* 🛍️. Escolha uma das opções abaixo:\n\n1 - Impressão\n2 - Xerox\n3 - Revelação de Foto\n4 - Foto 3x4\n5 - Plastificação A4\n6 - Plastificação SUS\n7 - Impressão em papel cartão\n8 - Papel fotográfico adesivo\n9 - Encadernação 50 folhas\n10 - Mais opções.\n\nEnvie o número ou anexe seu arquivo.`);
        } else if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const filePath = `${uploadDir}/${msg.id.id}.${media.mimetype.split('/')[1]}`;
            fs.writeFileSync(filePath, media.data, { encoding: 'base64' });
            await client.sendMessage(msg.from, `📥 Arquivo recebido: *${filePath}*. Processando seu pedido, pronto para retirada em 5 minutos. Pague via PIX (82987616759) ou na loja.`);
            logger.info(`Arquivo recebido de ${msg.from}: ${filePath}`);
            await client.sendMessage(msg.from, `Gostaria de dar sua opinião? Digite "Sim" ou "Não".`);
        } else if (!isNaN(msg.body) && msg.body >= 1 && msg.body <= 10) {
            await client.sendMessage(msg.from, `Você selecionou a opção ${msg.body}. Logo entraremos em contato para mais informações.`);
        } else if (['sim', 'não'].includes(msg.body.toLowerCase())) {
            if (msg.body.toLowerCase() === 'sim') {
                await client.sendMessage(msg.from, 'Obrigado pelo feedback positivo! Estamos sempre à disposição.');
            } else {
                await client.sendMessage(msg.from, 'Agradecemos o feedback! Vamos trabalhar para melhorar.');
            }
        } else {
            await client.sendMessage(msg.from, 'Desculpe, não entendi. Digite "menu" para ver as opções.');
        }

    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});

// Função para verificar horário de funcionamento
const isWithinBusinessHours = () => {
    const now = moment().tz("America/Sao_Paulo"); // Ajuste de fuso horário
    const day = now.format('ddd').toLowerCase();
    const hour = now.hour();

    const isWeekday = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].includes(day);
    const isWithinHours = hour >= 8 && hour < 18;

    return isWeekday && isWithinHours;
};

// Inicializa o cliente
client.initialize().catch(error => {
    console.error("Erro ao inicializar o cliente:", error);
});
