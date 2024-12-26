const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve os arquivos estáticos da pasta atual
app.use(express.static(__dirname));

const games = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('createGame', (data) => {
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
    const { gameCode, playerName } = data;
    const game = games.get(gameCode);
    if (game) {
      game.players.push({ name: playerName, active: true, status: 'Jogador' });
      socket.join(gameCode);
      io.to(gameCode).emit('gameState', game);
    }
  });

  socket.on('updateGame', (data) => {
    const { gameCode, gameState } = data;
    games.set(gameCode, gameState);
    io.to(gameCode).emit('gameState', gameState);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

