// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCmnvGXlab70lv6LPK9uMkny33V_sfCIHU",
    authDomain: "bingo-do-trentini.firebaseapp.com",
    databaseURL: "https://bingo-do-trentini-default-rtdb.firebaseio.com",
    projectId: "bingo-do-trentini",
    storageBucket: "bingo-do-trentini.firebasestorage.app",
    messagingSenderId: "800451986398",
    appId: "1:800451986398:web:f6315e4bfd070bc029934f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Game State
let players = [];
let generatedCards = [];
let gameCount = 0;
let winners = [];
let gameCode = '';
let isAdmin = false;
let openCardIndex = -1;
let gameStarted = false;
let gameState = null;
let drawnNumbers = new Set();
let drawingInterval = null;
let isAutomaticDrawing = false;

// Utils
function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateColumn(min, max, count, usedNumbers) {
    const available = new Set();
    for (let i = min; i <= max; i++) {
        if (!usedNumbers.has(i)) available.add(i);
    }
    
    const numbers = Array.from(available);
    const result = [];
    
    while (result.length < count && numbers.length > 0) {
        const index = Math.floor(Math.random() * numbers.length);
        result.push(numbers[index]);
        numbers.splice(index, 1);
    }
    
    return result.sort((a, b) => a - b);
}

function calculateSimilarity(card1, card2) {
    let commonNumbers = 0;
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
            if (card1[col][row] === card2[col][row]) commonNumbers++;
        }
    }
    return commonNumbers / 24;
}

function generateCards(playerCount) {
    const cards = [];
    const usedNumbersByColumn = Array(5).fill().map(() => new Set());
    const maxAttempts = 100;
    
    for (let i = 0; i < playerCount; i++) {
        let bestCard = null;
        let minMaxSimilarity = 1;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const candidateCard = [
                generateColumn(1, 15, 5, usedNumbersByColumn[0]),
                generateColumn(16, 30, 5, usedNumbersByColumn[1]),
                generateColumn(31, 45, 5, usedNumbersByColumn[2]),
                generateColumn(46, 60, 5, usedNumbersByColumn[3]),
                generateColumn(61, 75, 5, usedNumbersByColumn[4])
            ];
            
            candidateCard[2][2] = '★';
            
            let maxSimilarity = 0;
            for (const existingCard of cards) {
                const similarity = calculateSimilarity(candidateCard, existingCard);
                maxSimilarity = Math.max(maxSimilarity, similarity);
            }
            
            if (maxSimilarity < minMaxSimilarity) {
                minMaxSimilarity = maxSimilarity;
                bestCard = candidateCard;
            }
        }
        
        cards.push(bestCard);
        
        for (let col = 0; col < 5; col++) {
            bestCard[col].forEach(num => {
                if (num !== '★') usedNumbersByColumn[col].add(num);
            });
        }
    }
    
    return cards;
}

// Firebase Operations
function saveGameState() {
    const gameState = {
        players,
        generatedCards,
        gameCount,
        winners,
        bingoName: document.getElementById('bingoName').value,
        gameStarted,
        drawnNumbers: Array.from(drawnNumbers),
        isAutomaticDrawing
    };
    
    set(ref(db, `games/${gameCode}`), gameState);
    updateShareLink();
}

function startRealTimeSync() {
    onValue(ref(db, `games/${gameCode}`), (snapshot) => {
        const data = snapshot.val();
        if (data) updateFromFirebase(data);
    });
}

function updateFromFirebase(data) {
    players = data.players;
    generatedCards = data.generatedCards;
    gameCount = data.gameCount;
    winners = data.winners;
    gameStarted = data.gameStarted;
    drawnNumbers = new Set(data.drawnNumbers || []);
    isAutomaticDrawing = data.isAutomaticDrawing;
    
    updateUI();
}

// UI Updates
function updateUI() {
    updatePlayerList();
    updateRankingTable();
    updateDrawnNumbers();

    if (gameStarted) {
        document.getElementById('gameConfig').style.display = 'none';
        document.getElementById('gamePlay').style.display = 'block';
        showCardLinks();
    }
}

function updateShareLink() {
    const shareUrl = `${window.location.origin}${window.location.pathname}?game=${gameCode}`;
    document.getElementById('shareLink').innerHTML = 
        `<p>Compartilhe este link: <a href="${shareUrl}" target="_blank">${shareUrl}</a></p>`;
    history.pushState(null, '', `?game=${gameCode}`);
}

function updatePlayerList() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    players.forEach((player, index) => {
        const playerElement = createPlayerElement(player, index);
        if (!player.active) playerElement.classList.add('inactive');
        playerList.appendChild(playerElement);
    });
    updateStartGameButtonVisibility();
    updateUIForRole();
}

function createPlayerElement(player, index) {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';
    playerDiv.innerHTML = `
        <span class="player-name">${player.name}</span>
        <span class="player-status">${player.status}</span>
        ${isAdmin ? `
            <div class="player-actions">
                <button type="button" class="toggle-btn">
                    ${player.active ? 'Desativar' : 'Ativar'}
                </button>
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

// Game Logic
function startGame() {
    gameCount++;
    const activePlayers = players.filter(p => p.active);
    generatedCards = generateCards(activePlayers.length);
    drawnNumbers.clear();

    const autoDrawing = document.getElementById('autoDrawing').value === 'true';
    if (autoDrawing) {
        startAutomaticDrawing();
    } else {
        document.getElementById('drawNumberButton').style.display = 
            isAdmin ? 'block' : 'none';
    }

    updateGamePlay();
    gameStarted = true;
    saveGameState();
}

function drawNumber() {
    if (drawnNumbers.size >= 75) {
        stopAutomaticDrawing();
        return;
    }

    let number;
    do {
        number = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.has(number));

    drawnNumbers.add(number);
    announceNumber(number);
    updateDrawnNumbers();
    saveGameState();
    checkWinningCards();
}

function startAutomaticDrawing() {
    if (drawingInterval) return;
    const interval = parseInt(document.getElementById('drawingInterval').value) * 1000;
    drawingInterval = setInterval(drawNumber, interval);
    isAutomaticDrawing = true;
    saveGameState();
}

function stopAutomaticDrawing() {
    if (drawingInterval) {
        clearInterval(drawingInterval);
        drawingInterval = null;
    }
    isAutomaticDrawing = false;
    saveGameState();
}

function announceNumber(number) {
    const announcement = document.createElement('div');
    announcement.className = 'number-announcement';
    announcement.textContent = `Número sorteado: ${number}`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 4000);
}

function updateDrawnNumbers() {
    const drawnNumbersList = document.getElementById('drawnNumbersList');
    drawnNumbersList.innerHTML = '';
    Array.from(drawnNumbers).sort((a, b) => a - b).forEach(number => {
        const numberDiv = document.createElement('div');
        numberDiv.className = 'drawn-number';
        numberDiv.textContent = number;
        drawnNumbersList.appendChild(numberDiv);
    });
}

function checkWinningCards() {
    const activeCards = document.querySelectorAll('.bingo-card');
    activeCards.forEach(card => {
        const numbers = card.querySelectorAll('.bingo-number');
        if (checkWinningPattern(numbers)) {
            stopAutomaticDrawing();
            announceWinner(card.querySelector('.card-title').textContent.split(' - ')[0]);
        }
    });
}

function checkWinningPattern(numbers) {
    // Verifica linhas
    for (let i = 0; i < 5; i++) {
        const row = Array.from(numbers).slice(i * 5, (i + 1) * 5);
        if (row.every(cell => cell.classList.contains('marked') || 
            cell.classList.contains('free-space'))) {
            return true;
        }
    }

    // Verifica colunas
    for (let i = 0; i < 5; i++) {
        const column = Array.from(numbers).filter((_, index) => index % 5 === i);
        if (column.every(cell => cell.classList.contains('marked') || 
            cell.classList.contains('free-space'))) {
            return true;
        }
    }

    // Verifica diagonais
    const mainDiagonal = [numbers[0], numbers[6], numbers[12], numbers[18], numbers[24]];
    const secondaryDiagonal = [numbers[4], numbers[8], numbers[12], numbers[16], numbers[20]];

    return mainDiagonal.every(cell => cell.classList.contains('marked') || 
           cell.classList.contains('free-space')) ||
           secondaryDiagonal.every(cell => cell.classList.contains('marked') || 
           cell.classList.contains('free-space'));
}

function announceWinner(playerName) {
    const announcement = document.createElement('div');
    announcement.className = 'number-announcement';
    announcement.style.background = '#FFD700';
    announcement.style.color = '#000';
    announcement.textContent = `BINGO! ${playerName} venceu!`;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
        announcement.remove();
        if (isAdmin) selectWinner(playerName);
    }, 5000);
}

function selectWinner(playerName) {
    const activePlayerCount = players.filter(p => p.active).length;
    winners.push({ 
        round: gameCount, 
        name: playerName, 
        playerCount: activePlayerCount 
    });
    updateRankingTable();
    document.getElementById('winnerSelection').style.display = 'none';
    startGame();
    saveGameState();
}

function updateRankingTable() {
    const tableBody = document.getElementById('rankingTableBody');
    tableBody.innerHTML = '';

    const playerStats = players.map(player => ({
        name: player.name,
        wins: winners.filter(w => w.name === player.name).length,
        chipsWon: winners.filter(w => w.name === player.name)
            .reduce((sum, w) => sum + w.playerCount, 0)
    }));

    playerStats
        .sort((a, b) => b.wins - a.wins || b.chipsWon - a.chipsWon)
        .forEach((stat, index) => {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = index + 1;
            row.insertCell(1).textContent = stat.name;
            row.insertCell(2).textContent = stat.wins;
            row.insertCell(3).textContent = stat.chipsWon;
        });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const autoDrawingSelect = document.getElementById('autoDrawing');
    const drawingIntervalGroup = document.getElementById('drawingIntervalGroup');

    autoDrawingSelect.addEventListener('change', (e) => {
        drawingIntervalGroup.style.display = e.target.value === 'true' ? 'block' : 'none';
    });

    document.getElementById('createGame').addEventListener('click', () => {
        const bingoName = document.getElementById('bingoName').value.trim();
        const adminName = document.getElementById('playerName').value.trim();

        if (!bingoName || !adminName) {
            document.getElementById('errorMessage').textContent = 
                'Por favor, preencha todos os campos.';
            return;
        }

        players = [{ name: adminName, active: true, status: 'Administrador' }];
        saveGameState();
        document.getElementById('adminSetup').style.display = 'none';
        document.getElementById('shareLink').style.display = 'block';
        updatePlayerList();
    });

    document.getElementById('joinGame').addEventListener('click', () => {
        const playerName = document.getElementById('newPlayerName').value.trim();
        if (!playerName) return;

        if (players.some(p => p.name === playerName)) {
            document.getElementById('errorMessage').textContent = 
                'Este nome já está em uso. Por favor, escolha outro.';
            return;
        }

        players.push({ name: playerName, active: true, status: 'Jogador' });
        updatePlayerList();
        saveGameState();
        document.getElementById('playerSetup').style.display = 'none';
    });

    document.getElementById('startGameButton').addEventListener('click', (e) => {
        e.preventDefault();
        const activePlayers = players.filter(p => p.active);
        if (activePlayers.length === 0) {
            document.getElementById('errorMessage').textContent = 
                'É necessário ter pelo menos um jogadorativo para iniciar o jogo.';
            return;
        }
        startGame();
    });

    document.getElementById('drawNumberButton').addEventListener('click', drawNumber);

    document.getElementById('restartButton').addEventListener('click', () => {
        stopAutomaticDrawing();
        document.getElementById('winnerSelection').style.display = 'block';
        document.getElementById('winnerButtons').innerHTML = '';
        players.forEach((player) => {
            if (player.active) {
                const button = document.createElement('button');
                button.textContent = player.name;
                button.addEventListener('click', () => selectWinner(player.name));
                document.getElementById('winnerButtons').appendChild(button);
            }
        });
    });

    document.getElementById('backToConfig').addEventListener('click', () => {
        stopAutomaticDrawing();
        document.getElementById('gamePlay').style.display = 'none';
        document.getElementById('gameConfig').style.display = 'block';
        document.getElementById('cardsContainer').innerHTML = '';
    });

    // Initialize game on load
    initializeGame();
});

// Game Initialization
function initializeGame() {
    const urlParams = new URLSearchParams(window.location.search);
    const loadedGameCode = urlParams.get('game');

    if (loadedGameCode) {
        gameCode = loadedGameCode;
        isAdmin = localStorage.getItem(`bingoAdmin_${gameCode}`) === 'true';
        document.getElementById('adminSetup').style.display = 'none';
        document.getElementById('playerSetup').style.display = 'block';
        startRealTimeSync();
    } else {
        gameCode = generateGameCode();
        localStorage.setItem(`bingoAdmin_${gameCode}`, 'true');
        isAdmin = true;
        document.getElementById('adminSetup').style.display = 'block';
        document.getElementById('playerSetup').style.display = 'none';
    }
}

// UI Helpers
function updateStartGameButtonVisibility() {
    const startGameButton = document.getElementById('startGameButton');
    startGameButton.style.display = (players.length > 1 && isAdmin) ? 'block' : 'none';
}

function updateUIForRole() {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = isAdmin ? 'block' : 'none';
    });

    if (!isAdmin && !gameStarted) {
        document.getElementById('adminSetup').style.display = 'none';
        document.getElementById('playerSetup').style.display = 'block';
        document.getElementById('newPlayerName').value = '';
        document.getElementById('shareLink').style.display = 'none';
        document.getElementById('rankingTable').style.display = 'block';
    }

    document.getElementById('drawNumberButton').style.display = 
        isAdmin && gameStarted ? 'block' : 'none';
    document.getElementById('restartButton').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('backToConfig').style.display = isAdmin ? 'block' : 'none';
}

function updateGamePlay() {
    const cardLinks = document.getElementById('cardLinks');
    const cardsContainer = document.getElementById('cardsContainer');
    
    cardLinks.innerHTML = '';
    cardsContainer.innerHTML = '';
    
    const activePlayers = players.filter(p => p.active);
    activePlayers.forEach((player, index) => {
        // Create card link
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = player.name;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPlayerCard(index);
        });
        cardLinks.appendChild(link);

        // Create bingo card
        const cardElement = createBingoCard(generatedCards[index], player.name, index, activePlayers.length);
        cardElement.style.display = 'none';
        cardsContainer.appendChild(cardElement);
    });

    document.getElementById('gameConfig').style.display = 'none';
    document.getElementById('gamePlay').style.display = 'block';
    updateDrawnNumbers();
}

function createBingoCard(card, playerName, index, totalCards) {
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
            
            if (number !== '★') {
                if (drawnNumbers.has(number)) {
                    cell.classList.add('marked');
                }
                cell.addEventListener('click', () => {
                    cell.classList.toggle('marked');
                    checkWinningCards();
                });
            }
            
            numbers.appendChild(cell);
        }
    }

    cardElement.innerHTML = header;
    cardElement.appendChild(numbers);
    return cardElement;
}

function showPlayerCard(index) {
    const cardElement = document.getElementById(`card-${index}`);
    const previousCard = document.getElementById(`card-${openCardIndex}`);

    if (openCardIndex === index) {
        cardElement.style.display = 'none';
        openCardIndex = -1;
    } else {
        if (previousCard) {
            previousCard.style.display = 'none';
        }
        cardElement.style.display = 'block';
        openCardIndex = index;
    }
}