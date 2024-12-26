document.addEventListener('DOMContentLoaded', () => {
    const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
    });
    
    let socketConnected = false;
    const errorMessage = document.getElementById('errorMessage');
    const createGameButton = document.getElementById('createGame');
    const bingoNameInput = document.getElementById('bingoName');
    const playerNameInput = document.getElementById('playerName');
    const adminSetup = document.getElementById('adminSetup');
    const playerSetup = document.getElementById('playerSetup');
    const shareLinkDiv = document.getElementById('shareLink');

    // Estado do jogo
    let players = [];
    let generatedCards = [];
    let gameCount = 0;
    let winners = [];
    let gameCode = '';
    let isAdmin = false;
    let openCardIndex = -1;
    let gameStarted = false;

    // Desabilita o botão até a conexão ser estabelecida
    createGameButton.disabled = true;

    socket.on('connect', () => {
        console.log('Connected to server');
        socketConnected = true;
        createGameButton.disabled = false;
        errorMessage.textContent = '';
        errorMessage.style.color = '#4CAF50';
        errorMessage.textContent = 'Conectado ao servidor';
        setTimeout(() => {
            errorMessage.textContent = '';
        }, 2000);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        socketConnected = false;
        createGameButton.disabled = true;
        errorMessage.style.color = '#ff3e3e';
        errorMessage.textContent = 'Desconectado do servidor. Tentando reconectar...';
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        socketConnected = false;
        createGameButton.disabled = true;
        errorMessage.style.color = '#ff3e3e';
        errorMessage.textContent = 'Erro de conexão com o servidor. Por favor, recarregue a página.';
    });

    socket.on('error', (error) => {
        console.error('Server error:', error);
        errorMessage.style.color = '#ff3e3e';
        errorMessage.textContent = error.message || 'Ocorreu um erro no servidor.';
    });

    socket.on('gameCreated', (response) => {
        console.log('Game created response:', response);
        if (response.success) {
            errorMessage.style.color = '#4CAF50';
            errorMessage.textContent = response.message;
            
            // Atualiza a interface
            adminSetup.style.display = 'none';
            shareLinkDiv.style.display = 'block';
            
            // Cria e mostra o link de compartilhamento
            const gameUrl = `${window.location.origin}?game=${response.gameCode}`;
            shareLinkDiv.innerHTML = `
                <p>Compartilhe este link com os jogadores:</p>
                <input type="text" value="${gameUrl}" readonly style="width: 100%; margin-bottom: 10px;">
                <button onclick="navigator.clipboard.writeText('${gameUrl}')">Copiar Link</button>
            `;

            setTimeout(() => {
                errorMessage.textContent = '';
            }, 3000);
        }
    });

    // Função para gerar código do jogo
    function generateGameCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Event listener para o botão criar jogo
    createGameButton.addEventListener('click', () => {
        if (!socketConnected) {
            errorMessage.style.color = '#ff3e3e';
            errorMessage.textContent = 'Aguarde a conexão com o servidor...';
            return;
        }

        const bingoName = bingoNameInput.value.trim();
        const adminName = playerNameInput.value.trim();

        if (!bingoName || !adminName) {
            errorMessage.style.color = '#ff3e3e';
            errorMessage.textContent = 'Por favor, preencha todos os campos.';
            return;
        }

        // Desabilita o botão durante a criação
        createGameButton.disabled = true;
        createGameButton.textContent = 'Criando...';

        // Gera o código do jogo e envia para o servidor
        gameCode = generateGameCode();
        console.log('Emitting createGame event:', { gameCode, adminName, bingoName });
        
        socket.emit('createGame', { gameCode, adminName, bingoName });
        isAdmin = true;

        // Reabilita o botão após 2 segundos
        setTimeout(() => {
            createGameButton.disabled = false;
            createGameButton.textContent = 'Criar Jogo';
        }, 2000);
    });

    // Resto do código permanece o mesmo...
    // (Mantenha todas as outras funções e event listeners que já existiam)
});

