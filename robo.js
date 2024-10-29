const { Client } = require('whatsapp-web.js');
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

// Cria um endpoint de escuta para evitar timeout no Heroku
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

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

// Função para verificar se estamos dentro do horário de funcionamento
const isWithinBusinessHours = () => {
    const now = new Date();
    const day = now.getDay();  // 0 - Domingo, 1 - Segunda, ..., 6 - Sábado
    const hour = now.getHours();  // Horas do dia, de 0 a 23
    // A papelaria funciona de segunda a sábado (1 a 6), das 8h às 18h
    return day >= 1 && day <= 6 && hour >= 8 && hour < 18;
};

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

        if (msg.body.match(/(menu|Menu|oi|Olá|olá|ola|Ola|preço|valor|impressão|xerox|foto|serviços|materiais)/i)) {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(msg.from, `Olá, *${name}*! Bem-vindo à *Papelaria BH*. Como posso ajudar? Aqui estão algumas opções de serviços:\n\n *1 - Impressão* (R$ 2,00 por página)\n *2 - Xerox* (R$ 0,50 por documento)\n *3 - Revelação de Foto* (R$ 5,00)\n *4 - Foto 3x4* (R$ 5,00 por 6 unidades)\n *5 - Plastificação A4* (R$ 7,00)\n *6 - Plastificação SUS* (R$ 5,00)\n *7 - Impressão em papel cartão* (R$ 3,00)\n *8 - Papel fotográfico adesivo* (R$ 5,00)\n *9 - Encadernação 50 folhas* (R$ 12,00)\n\nDiga o número da opção que deseja, ou envie seu arquivo para impressão.`);
            await delay(3000);
            await chat.sendStateTyping();
        } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(msg.body)) {
            let responseMessage = '';
            switch (msg.body) {
                case '1':
                    responseMessage = 'O valor da impressão é *R$ 2,00 por página*. Envie o arquivo para que possamos imprimir. O prazo para a impressão é de *5 a 10 minutos*. Quando estiver pronto, você poderá buscar aqui na *Papelaria BH*.';
                    break;
                case '2':
                    responseMessage = 'O valor da xerox é *R$ 0,50 por documento*. O prazo para a xerox é de *5 a 10 minutos*. Envie os documentos que deseja copiar e busque na *Papelaria BH*.';
                    break;
                case '3':
                    responseMessage = 'O valor para revelação de foto é *R$ 5,00*. O prazo para a revelação é de *5 a 10 minutos*. Envie a foto que deseja revelar e venha buscar na *Papelaria BH*.';
                    break;
                case '4':
                    responseMessage = 'O valor para foto 3x4 é *R$ 5,00 para 6 unidades*. O prazo para a foto é de *5 a 10 minutos*. Envie sua foto para impressão ou venha tirar aqui na *Papelaria BH*.';
                    break;
                case '5':
                    responseMessage = 'O valor para plastificação A4 é *R$ 7,00*. O prazo para plastificação é de *5 a 10 minutos*. Envie o documento para plastificação.';
                    break;
                case '6':
                    responseMessage = 'O valor para plastificação SUS é *R$ 5,00*. O prazo para plastificação é de *5 a 10 minutos*. Envie o documento para plastificação.';
                    break;
                case '7':
                    responseMessage = 'O valor para impressão em papel cartão é *R$ 3,00*. O prazo para impressão é de *5 a 10 minutos*. Envie o arquivo para impressão.';
                    break;
                case '8':
                    responseMessage = 'O valor para papel fotográfico adesivo é *R$ 5,00*. O prazo para impressão é de *5 a 10 minutos*. Envie o arquivo para impressão.';
                    break;
                case '9':
                    responseMessage = 'O valor para encadernação de 50 folhas é *R$ 12,00*. O prazo para encadernação é de *10 a 15 minutos*. Envie os documentos que deseja encadernar.';
                    break;
                default:
                    responseMessage = 'Desculpe, não entendi sua solicitação.';
            }

            await client.sendMessage(msg.from, responseMessage);
            setTimeout(async () => {
                await client.sendMessage(msg.from, `*${name}*, seu pedido está pronto! Pode retirar na *Papelaria BH* após o prazo mencionado acima.`);
            }, 600000); // 10 minutos como exemplo
        } else if (msg.hasMedia) {
            await msg.downloadMedia();
            await client.sendMessage(msg.from, 'Arquivo recebido. Em 5 minutos, você pode retirar na *Papelaria BH*. Obrigado!');
        } else {
            await client.sendMessage(msg.from, 'Desculpe, não consegui entender sua mensagem. Você pode escolher uma opção do menu ou enviar seu arquivo.');
        }
    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
        await client.sendMessage(msg.from, 'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.');
    }
});
