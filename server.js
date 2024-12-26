const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuração do Socket.io com debugging
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    agent: false,
    reconnection: true,
    rejectUnauthorized: false
});

// Adicione este log após a configuração do Socket.IO
console.log('Socket.IO configurado com as seguintes opções:', io.opts);

// Configuração para servir arquivos estáticos
app.use(express.static('public'));
app.use('/styles', express.static(path.join(__dirname, 'src/styles')));
app.use('/js', express.static(path.join(__dirname, 'src/js')));

// Adiciona headers CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const games = new Map();

io.on('connection', (socket) => {
    console.log('Novo cliente conectado:', socket.id);

    // Envia confirmação de conexão
    socket.emit('connected', { status: 'ok', socketId: socket.id });

    socket.on('createGame', (data) => {
        try {
            console.log('Creating game:', data);
            const { gameCode, adminName, bingoName } = data;
            
            if (!gameCode || !adminName || !bingoName) {
                socket.emit('error', { message: 'Dados inválidos para criar o jogo' });
                return;
            }

            const gameData = {
                bingoName,
                players: [{ name: adminName, active: true, status: 'Administrador' }],
                generatedCards: [],
                gameCount: 0,
                winners: [],
                gameStarted: false
            };

            games.set(gameCode, gameData);
            socket.join(gameCode);
            
            // Emite o estado inicial do jogo
            io.to(gameCode).emit('gameState', gameData);
            
            // Emite confirmação de criação do jogo
            socket.emit('gameCreated', { 
                success: true, 
                gameCode,
                message: 'Jogo criado com sucesso!'
            });

            console.log(`Game ${gameCode} created successfully`);
        } catch (error) {
            console.error('Error creating game:', error);
            socket.emit('error', { message: 'Erro ao criar o jogo: ' + error.message });
        }
    });

    socket.on('joinGame', (data) => {
        try {
            console.log('Player joining game:', data);
            const { gameCode, playerName } = data;
            const game = games.get(gameCode);
            
            if (!game) {
                socket.emit('error', { message: 'Jogo não encontrado' });
                return;
            }

            game.players.push({ name: playerName, active: true, status: 'Jogador' });
            socket.join(gameCode);
            io.to(gameCode).emit('gameState', game);
            
            console.log(`Player ${playerName} joined game ${gameCode}`);
        } catch (error) {
            console.error('Error joining game:', error);
            socket.emit('error', { message: 'Erro ao entrar no jogo: ' + error.message });
        }
    });

    socket.on('updateGame', (data) => {
        try {
            console.log('Updating game:', data);
            const { gameCode, gameState } = data;
            games.set(gameCode, gameState);
            io.to(gameCode).emit('gameState', gameState);
        } catch (error) {
            console.error('Error updating game:', error);
            socket.emit('error', { message: 'Erro ao atualizar o jogo: ' + error.message });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Cliente desconectado:', socket.id, 'Razão:', reason);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

