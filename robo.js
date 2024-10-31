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

// Número bloqueado
const numeroBloqueado = '+5582981452814@c.us';

// Função para verificar se o número é bloqueado
const isBlockedNumber = (number) => number === numeroBloqueado;

// Função para verificar horário de funcionamento
const isWithinBusinessHours = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    return day >= 1 && day <= 6 && hour >= 8 && hour < 18;
};

// Geração de código de pedido
const generateOrderCode = () => `BH-${Date.now()}`;

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

const delay = ms => new Promise(res => setTimeout(res, ms));

// Atendimento
client.on('message', async msg => {
    if (isBlockedNumber(msg.from)) return; // Ignora mensagens do número bloqueado

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
            await chat.sendStateTyping();
            await delay(2000); // Simula um atraso para que o cliente não perceba uma resposta instantânea
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH* ️. Como posso ajudar? Aqui estão algumas opções de serviços:\n\n *1 - Impressão* (R$ 2,00 por página)\n *2 - Xerox* (R$ 0,50 por documento)\n️ *3 - Revelação de Foto* (R$ 5,00)\n *4 - Foto 3x4* (R$ 5,00 por 6 unidades)\n *5 - Plastificação A4* (R$ 7,00)\n *6 - Plastificação SUS* (R$ 5,00)\n *7 - Impressão em papel cartão* (R$ 3,00)\n *8 - Papel fotográfico adesivo* (R$ 5,00)\n *9 - Encadernação 50 folhas* (R$ 12,00)\n *10 - Ver mais opções de materiais e variedades*\n\nDiga o número da opção que deseja, ou envie seu arquivo para impressão.\n\n💳 *Para pagamentos, nosso Pix é: 82987616759*.`);
        } else if (['1', '2', '3', '4'].includes(msg.body)) {
            let responseMessage;
            switch (msg.body) {
                case '1':
                    responseMessage = '️ O valor da impressão é *R$ 2,00 por página*. Envie o arquivo para que possamos imprimir. O prazo para a impressão é de *5 a 10 minutos*. Quando estiver pronto, você poderá buscar aqui na *Papelaria BH*.';
                    break;
                case '2':
                    responseMessage = 'O valor da xerox é *R$ 0,50 por documento*. O prazo para a xerox é de *5 a 10 minutos*. Envie os documentos que deseja copiar e busque na *Papelaria BH*.';
                    break;
                case '3':
                    responseMessage = '️ O valor para revelação de foto é *R$ 5,00*. O prazo para a revelação é de *5 a 10 minutos*. Envie a foto que deseja revelar e venha buscar na *Papelaria BH*.';
                    break;
                case '4':
                    responseMessage = 'O valor para foto 3x4 é *R$ 5,00 para 6 unidades*. O prazo para a foto é de *5 a 10 minutos*. Envie sua foto para impressão ou venha tirar aqui na *Papelaria BH*.';
                    break;
            }

            await client.sendMessage(msg.from, responseMessage);
            await chat.sendStateTyping(); // Informa que o bot está "digitando"
            await delay(3000); // Simula o tempo de processamento

            // Aguardando envio de arquivo
            logger.info(`Aguardando arquivo de ${msg.from}`);
        } else if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            // Aqui você pode salvar o arquivo recebido, se necessário
            console.log('Arquivo recebido:', media);
            await client.sendMessage(msg.from, '📄 Arquivo recebido com sucesso! Estamos processando seu pedido.');

            // Simula o tempo para processamento
            await delay(600000); // 10 minutos de espera
            await client.sendMessage(msg.from, `*${name}*, seu pedido está pronto! Pode retirar na *Papelaria BH*.`);

            // Feedback do cliente
            await client.sendMessage(msg.from, 'Obrigado por utilizar nossos serviços! Gostaríamos de saber se o atendimento foi satisfatório. Por favor, responda com "sim" ou "não".');
        } else if (msg.body.toLowerCase() === 'sim' || msg.body.toLowerCase() === 'não') {
            const feedback = msg.body.toLowerCase() === 'sim' ? 'positivo' : 'negativo';
            await client.sendMessage(msg.from, `Agradecemos seu feedback ${feedback}! Estamos aqui para ajudar sempre que precisar.`);
        }
    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});
