const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal'); // Importa o qrcode-terminal

// Lista de números bloqueados
const blockedNumbers = ["5582981452814@c.us", "5582987616759@c.us"];

// Função para verificar se o número está bloqueado
function isBlockedNumber(number) {
    return blockedNumbers.includes(number);
}

const client = new Client({
    authStrategy: new LocalAuth({ 
        clientId: "bot-whatsapp",
        dataPath: './session_data'
    })
});

client.on('qr', (qr) => {
    console.log("QR Code gerado! Escaneie para conectar.");

    // Exibe o QR code no console como ASCII
    qrcode.generate(qr, { small: true });

    // Opcional: Salva o QR code como imagem
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qr)}`;
    console.log(`Link para escanear o QR Code: ${qrImage}`);
});

client.on('ready', () => {
    console.log("✅ Tudo certo! WhatsApp conectado.");
});

client.initialize();
