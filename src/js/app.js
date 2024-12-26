document.addEventListener('DOMContentLoaded', () => {
    const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: false
    });
    
    socket.connect();

    let socketConnected = false;
    const errorMessage = document.getElementById('errorMessage');
    const createGameButton = document.getElementById('createGame');
    const bingoNameInput = document.getElementById('bingoName');
    const playerNameInput = document.getElementById('playerName');
    const adminSetup = document.getElementById('adminSetup');
    const playerSetup = document.getElementById('playerSetup');
    const shareLinkDiv = document.getElementById('shareLink');
    const playerList = document.getElementById('playerList');
    const cardLinks = document.getElementById('cardLinks');
    const restartButton = document.getElementById('restartButton');
    const startGameButton = document.getElementById('startGameButton');
    const cardsContainer = document.getElementById('cardsContainer');

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
        console.error('Erro de conexão:', error);
        socketConnected = false;
        createGameButton.disabled = true;
        errorMessage.style.color = '#ff3e3e';
        errorMessage.textContent = 'Erro de conexão com o servidor. Tentando reconectar...';
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Tentativa de reconexão:', attemptNumber);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconectado após', attemptNumber, 'tentativas');
        errorMessage.textContent = 'Conexão restabelecida!';
        setTimeout(() => {
            errorMessage.textContent = '';
        }, 3000);
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

    function joinGame() {
        const playerName = document.getElementById('newPlayerName').value.trim();
        if (playerName) {
            socket.emit('joinGame', { gameCode, playerName });
            document.getElementById('playerSetup').style.display = 'none';
        }
    }

    document.getElementById('joinGame').addEventListener('click', joinGame);

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

    function showPlayerView() {
        adminSetup.style.display = 'none';
        playerSetup.style.display = 'block';
        document.getElementById('newPlayerName').value = '';
        shareLinkDiv.style.display = 'none';
        document.getElementById('rankingTable').style.display = 'block';
    }

    function updateStartGameButtonVisibility() {
        startGameButton.style.display = (players.length > 1) ? 'block' : 'none';
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

    function showCardLinks() {
        cardLinks.style.display = 'flex';
        cardsContainer.innerHTML = '';
        document.getElementById('restartButton').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('backToConfig').style.display = isAdmin ? 'block' : 'none';

        const rankingTable = document.getElementById('rankingTable').cloneNode(true);
        rankingTable.style.marginTop = '20px';
        cardLinks.appendChild(rankingTable);

        players.forEach((player, index) => {
            if (player.active) {
                const cardElement = displayCard(generatedCards[index], player.name, index, players.filter(p => p.active).length);
                cardElement.style.display = 'none';
                cardsContainer.appendChild(cardElement);
            }
        });
    }

    function updateRankingTable() {
        const tableBody = document.getElementById('rankingTableBody');
        tableBody.innerHTML = '';

        const playerStats = players.map(player => {
            const wins = winners.filter(w => w.name === player.name).length;
            const chipsWon = winners.filter(w => w.name === player.name).reduce((sum, w) => sum + w.playerCount, 0);
            return { name: player.name, wins, chipsWon };
        });

        playerStats.sort((a, b) => b.wins - a.wins || b.chipsWon - a.chipsWon);

        playerStats.forEach((stat, index) => {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = index + 1;
            row.insertCell(1).textContent = stat.name;
            row.insertCell(2).textContent = stat.wins;
            row.insertCell(3).textContent = stat.chipsWon;
        });
    }

    startGameButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (players.filter(p => p.active).length > 0) {
            generateCards();
        } else {
            errorMessage.textContent = 'É necessário ter pelo menos um jogador ativo para iniciar o jogo.';
        }
    });

    function generateCards() {
        gameCount++;
        const bingoName = document.getElementById('bingoName').value;

        if (!bingoName || players.length === 0) {
            errorMessage.textContent = 'Por favor, preencha o nome do bingo e adicione pelo menos um jogador.';
            return;
        }

        generatedCards = players.filter(p => p.active).map(() => generateCard());

        cardLinks.innerHTML = '';
        players.forEach((player, index) => {
            if (player.active) {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = player.name;
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    showPlayerCard(index);
                });
                cardLinks.appendChild(link);
            }
        });

        errorMessage.textContent = '';
        document.getElementById('gameConfig').style.display = 'none';
        document.getElementById('gamePlay').style.display = 'block';
        showCardLinks();
        updateRankingTable();
        gameStarted = true;
        saveGameState();
    }

    function showPlayerCard(index) {
        const cardElement = document.getElementById(`card-${index}`);

        if (openCardIndex === index) {
            cardElement.style.display = 'none';
            openCardIndex = -1;
        } else {
            if (openCardIndex !== -1) {
                document.getElementById(`card-${openCardIndex}`).style.display = 'none';
            }

            cardElement.style.display = 'block';
            openCardIndex = index;
        }
    }

    restartButton.addEventListener('click', () => {
        document.getElementById('winnerSelection').style.display = 'block';
        document.getElementById('winnerButtons').innerHTML = '';
        players.forEach((player, index) => {
            if (player.active) {
                const button = document.createElement('button');
                button.textContent = player.name;
                button.addEventListener('click', () => selectWinner(player.name));
                document.getElementById('winnerButtons').appendChild(button);
            }
        });
        cardsContainer.innerHTML = '';
    });

    function selectWinner(winnerName) {
        const activePlayerCount = players.filter(p => p.active).length;
        winners.push({ round: gameCount, name: winnerName, playerCount: activePlayerCount });
        updateRankingTable();
        document.getElementById('winnerSelection').style.display = 'none';
        generateCards();
        showCardLinks();
        saveGameState();
    }

    document.getElementById('backToConfig').addEventListener('click', () => {
        document.getElementById('gamePlay').style.display = 'none';
        document.getElementById('gameConfig').style.display = 'block';
        cardsContainer.innerHTML = '';
    });

    function initializeGame() {
        const urlParams = new URLSearchParams(window.location.search);
        const loadedGameCode = urlParams.get('game');

        if (loadedGameCode) {
            console.log('Joining existing game:', loadedGameCode);
            gameCode = loadedGameCode;
            isAdmin = false;
            adminSetup.style.display = 'none';
            playerSetup.style.display = 'block';
        } else {
            console.log('Starting new game setup');
            isAdmin = true;
            adminSetup.style.display = 'block';
            playerSetup.style.display = 'none';
        }
        
        document.getElementById('gameConfig').style.display = 'block';
        document.getElementById('gamePlay').style.display = 'none';
    }

    initializeGame();
});

