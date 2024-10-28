client.on('message', async msg => {
    console.log(`Mensagem recebida: ${msg.body}`);
    try {
        const chat = await msg.getChat();
        const lowerCaseMessage = msg.body.toLowerCase();

        // Enviar a lista de serviços sempre que uma nova mensagem for recebida
        await sendServiceList(chat);

        // Responder de acordo com a escolha do cliente
        let responseMessage = '';

        if (lowerCaseMessage.includes('1')) {
            responseMessage = 'Você escolheu Impressão. O valor é *R$ 2,00 por página*. Envie o arquivo para impressão quando estiver pronto.';
        } else if (lowerCaseMessage.includes('2')) {
            responseMessage = 'Você escolheu Xerox. O valor é *R$ 0,50 por documento*. Informe quantos documentos deseja copiar.';
        } else if (lowerCaseMessage.includes('3')) {
            responseMessage = 'Você escolheu Revelação de Foto. O valor é *R$ 5,00* por foto.';
        } else if (lowerCaseMessage.includes('4')) {
            responseMessage = 'Você escolheu Foto 3x4. O valor é *R$ 5,00* por 6 unidades.';
        } else if (lowerCaseMessage.includes('5')) {
            responseMessage = 'Você escolheu Plastificação A4. O valor é *R$ 7,00* por unidade.';
        } else if (lowerCaseMessage.includes('6')) {
            responseMessage = 'Você escolheu Plastificação SUS. O valor é *R$ 5,00* por unidade.';
        } else if (lowerCaseMessage.includes('7')) {
            responseMessage = 'Você escolheu Impressão em papel cartão. O valor é *R$ 3,00* por página.';
        } else if (lowerCaseMessage.includes('8')) {
            responseMessage = 'Você escolheu Papel fotográfico adesivo. O valor é *R$ 5,00* por unidade.';
        } else if (lowerCaseMessage.includes('9')) {
            responseMessage = 'Você escolheu Encadernação de até 50 folhas. O valor é *R$ 12,00*.';
        } else if (msg.hasMedia) {
            // Confirma o recebimento do arquivo
            await msg.downloadMedia(); // Baixa o arquivo
            await client.sendMessage(msg.from, '📩 Arquivo recebido! Em até 5 minutos, você pode retirar na Papelaria BH. Obrigado!');
            return; // Sai da função após confirmar o recebimento do arquivo
        } else {
            // Caso a mensagem não corresponda a uma das opções acima, resposta genérica
            await client.sendMessage(msg.from, 'Desculpe, não entendi sua solicitação. Por favor, escolha um dos serviços da lista ou descreva mais detalhes sobre o que deseja.');
            return; // Sai da função se a mensagem não for válida
        }

        // Enviar a mensagem de resposta
        await client.sendMessage(msg.from, responseMessage);

        // Perguntar se o cliente deseja saber as formas de pagamento
        const paymentInquiry = await client.sendMessage(msg.from, 'Você gostaria de saber sobre as formas de pagamento? (sim/não)');
        
        client.on('message', async responseMsg => {
            const lowerCaseResponse = responseMsg.body.toLowerCase();

            if (responseMsg.from === msg.from) { // Verifica se a resposta é do mesmo cliente
                if (lowerCaseResponse.includes('sim')) {
                    const paymentDetails = 'Aceitamos as seguintes formas de pagamento:\n- Pix: Chave: 82987616759\n- Cartão de Crédito ou Débito\n- Em dinheiro na loja Papelaria BH.';
                    await client.sendMessage(msg.from, paymentDetails);
                } else if (lowerCaseResponse.includes('não')) {
                    await client.sendMessage(msg.from, 'Ok! Se precisar de mais alguma coisa, estou à disposição.');
                } else {
                    await client.sendMessage(msg.from, 'Desculpe, não entendi sua resposta. Você gostaria de saber sobre as formas de pagamento? (sim/não)');
                }
            }
        });
    } catch (error) {
        logger.error('Erro ao processar a mensagem: ', error);
    }
});
