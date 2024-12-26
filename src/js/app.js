document.addEventListener('DOMContentLoaded', () => {
    // Configuração do Socket.io com opções de reconexão
    const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
    });
    
    const errorMessage = document.getElementById('errorMessage');

    socket.on('connect', () => {
        console.log('Connected to server');
        errorMessage.textContent = ''; // Limpa mensagem de erro quando conectado
    });

    socket.on('connected', (data) => {
        console.log('Server confirmed connection:', data);
        errorMessage.textContent = ''; // Limpa mensagem de erro quando conectado
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        errorMessage.textContent = 'Erro de conexão com o servidor. Por favor, recarregue a página.';
    });

    socket.on('error', (error) => {
        console.error('Server error:', error);
        errorMessage.textContent = error.message || 'Ocorreu um erro no servidor.';
    });

    // Elementos do DOM
    const form = document.getElementById('bingoForm');
    const cardsContainer = document.getElementById('cardsContainer');
    const errorMessage = document.getElementById('errorMessage');
    const playerNameInput = document.getElementById('playerName');
    const createGameButton = document.getElementById('createGame');
    const playerList = document.getElementById('playerList');
    const cardLinks = document.getElementById('cardLinks');
    const restartButton = document.getElementById('restartButton');
    const startGameButton = document.getElementById('startGameButton');
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

    // Funções auxiliares
    function generateGameCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    function saveGameState() {
        socket.emit('updateGame', {
            gameCode,
            gameState: {
                players,
                generatedCards,
                gameCount,
                winners,
                bingoName: document.getElementById('bingoName').value,
                gameStarted
            }
        });
    }

    // Funções de atualização da UI
    function updateUIForRole() {
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = isAdmin ? 'block' : 'none';
        });
        startGameButton.style.display = isAdmin && players.length > 1 ? 'block' : 'none';
        restartButton.style.display = isAdmin ? 'block' : 'none';
        document.getElementById('backToConfig').style.display = isAdmin ? 'block' : 'none';

        if (!isAdmin && !gameStarted) {
            showPlayerView();
        }
    }

    function createPlayerElement(player, index) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-status">${player.status}</span>
            ${isAdmin ? `
                <div class="player-actions">
                    <button type="button" class="toggle-btn">${player.active ? 'Desativar' : 'Ativar'}</button>
                    <button type="button" class="remove-btn">Remover</button>
                </div>
            ` : ''}
        `;

        if (isAdmin) {
            playerDiv.querySelector('.toggle-btn').addEventListener('click', () => {
                players[index].active = !players[index].active;
                updatePlayerList();
                saveGameState();
            });

            playerDiv.querySelector('.remove-btn').addEventListener('click', () => {
                players.splice(index, 1);
                updatePlayerList();
                saveGameState();
            });
        }

        return playerDiv;
    }

    function updatePlayerList() {
        playerList.innerHTML = '';
        players.forEach((player, index) => {
            const playerElement = createPlayerElement(player, index);
            if (!player.active) {
                playerElement.classList.add('inactive');
            }
            playerList.appendChild(playerElement);
        });
        updateStartGameButtonVisibility();
        updateUIForRole();
        updateRankingTable();
    }

    // Event Listeners
    createGameButton.addEventListener('click', () => {
        const bingoName = document.getElementById('bingoName').value.trim();
        const adminName = document.getElementById('playerName').value.trim();

        if (!bingoName || !adminName) {
            errorMessage.textContent = 'Por favor, preencha todos os campos.';
            return;
        }

        gameCode = generateGameCode();
        socket.emit('createGame', { gameCode, adminName, bingoName });
        isAdmin = true;
        
        document.getElementById('adminSetup').style.display = 'none';
        document.getElementById('shareLink').style.display = 'block';
        
        const gameUrl = `${window.location.origin}?game=${gameCode}`;
        shareLinkDiv.innerHTML = `
            <p>Compartilhe este link com os jogadores:</p>
            <input type="text" value="${gameUrl}" readonly style="width: 100%; margin-bottom: 10px;">
            <button onclick="navigator.clipboard.writeText('${gameUrl}')">Copiar Link</button>
        `;
    });

    function joinGame() {
        const playerName = document.getElementById('newPlayerName').value.trim();
        if (playerName) {
            socket.emit('joinGame', { gameCode, playerName });
            document.getElementById('playerSetup').style.display = 'none';
        }
    }

    document.getElementById('joinGame').addEventListener('click', joinGame);

    // Socket event handlers
    socket.on('gameState', (gameState) => {
        players = gameState.players;
        generatedCards = gameState.generatedCards;
        gameCount = gameState.gameCount;
        winners = gameState.winners;
        gameStarted = gameState.gameStarted;
        document.getElementById('bingoName').value = gameState.bingoName;
        document.getElementById('bingoNameDisplay').textContent = gameState.bingoName;

        updatePlayerList();
        updateRankingTable();

        if (gameStarted) {
            document.getElementById('gameConfig').style.display = 'none';
            document.getElementById('gamePlay').style.display = 'block';
            showCardLinks();
        }
    });

    // Funções do jogo
    function generateColumnNumbers(min, max, count) {
        const numbers = [];
        for (let i = min; i <= max; i++) {
            numbers.push(i);
        }
        const shuffled = numbers.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    function generateCard() {
        const card = [
            generateColumnNumbers(1, 15, 5),
            generateColumnNumbers(16, 30, 5),
            generateColumnNumbers(31, 45, 5),
            generateColumnNumbers(46, 60, 5),
            generateColumnNumbers(61, 75, 5)
        ];

        card.forEach(column => column.sort((a, b) => a - b));
        card[2][2] = '★';
        return card;
    }

    function displayCard(card, playerName, index, totalCards) {
        const cardElement = document.createElement('div');
        cardElement.className = 'bingo-card';
        cardElement.id = `card-${index}`;

        const header = `
            <div class="card-title">${playerName} - Cartela ${index + 1}/${totalCards}</div>
            <div class="bingo-header">
                <div>B</div>
                <div>I</div>
                <div>N</div>
                <div>G</div>
                <div>O</div>
            </div>
        `;

        const numbers = document.createElement('div');
        numbers.className = 'bingo-numbers';

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const number = card[col][row];
                const cell = document.createElement('div');
                cell.className = `bingo-number${number === '★' ? ' free-space' : ''}`;
                cell.textContent = number;
                cell.addEventListener('click', () => {
                    if (number !== '★') {
                        cell.classList.toggle('marked');
                    }
                });
                numbers.appendChild(cell);
            }
        }

        cardElement.innerHTML = header;
        cardElement.appendChild(numbers);
        return cardElement;
    }

    // Inicialização
    function initializeGame() {
        const urlParams = new URLSearchParams(window.location.search);
        const loadedGameCode = urlParams.get('game');

        if (loadedGameCode) {
            console.log('Joining existing game:', loadedGameCode);
            gameCode = loadedGameCode;
            isAdmin = false;
            document.getElementById('adminSetup').style.display = 'none';
            document.getElementById('playerSetup').style.display = 'block';
        } else {
            console.log('Starting new game setup');
            isAdmin = true;
            document.getElementById('adminSetup').style.display = 'block';
            document.getElementById('playerSetup').style.display = 'none';
        }
        
        document.getElementById('gameConfig').style.display = 'block';
        document.getElementById('gamePlay').style.display = 'none';
    }

    initializeGame();
});

