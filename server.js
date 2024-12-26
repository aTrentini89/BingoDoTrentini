const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve os arquivos estáticos da pasta atual
app.use(express.static(__dirname));

// Adiciona rota básica para teste
app.get('/health', (req, res) => {
  res.send('Server is running');
});

const games = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('createGame', (data) => {
    console.log('Creating game:', data);
    const { gameCode, adminName, bingoName } = data;
    games.set(gameCode, {
      bingoName,
      players: [{ name: adminName, active: true, status: 'Administrador' }],
      generatedCards: [],
      gameCount: 0,
      winners: [],
      gameStarted: false
    });
    socket.join(gameCode);
    io.to(gameCode).emit('gameState', games.get(gameCode));
  });

  socket.on('joinGame', (data) => {
    console.log('Player joining game:', data);
    const { gameCode, playerName } = data;
    const game = games.get(gameCode);
    if (game) {
      game.players.push({ name: playerName, active: true, status: 'Jogador' });
      socket.join(gameCode);
      io.to(gameCode).emit('gameState', game);
    } else {
      socket.emit('error', { message: 'Game not found' });
    }
  });

  socket.on('updateGame', (data) => {
    console.log('Updating game:', data);
    const { gameCode, gameState } = data;
    games.set(gameCode, gameState);
    io.to(gameCode).emit('gameState', gameState);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

