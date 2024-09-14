const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Game state
let games = {};

// Generate a random 6-digit passcode
function generatePasscode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'CREATE_GAME':
        const gameId = generatePasscode();
        const playerPasscode = generatePasscode();
        games[gameId] = {
          players: [{ ws, passcode: playerPasscode }],
          gameState: {
            board: Array(9).fill(null),
            players: [
              { funds: 100, mark: '', name: 'Player 1' },
              { funds: 100, mark: '', name: 'Player 2' },
            ],
            currentPlayer: 0,
            gamePhase: 'waitingForPlayer',
            bids: { player1: '', player2: '' },
            positions: { player1: '', player2: '' },
            winner: null,
            message: '',
          },
        };
        ws.send(JSON.stringify({ type: 'GAME_CREATED', gameId, passcode: playerPasscode }));
        break;

      case 'JOIN_GAME':
        const game = games[data.gameId];
        if (game && game.players.length === 1) {
          const playerPasscode = generatePasscode();
          game.players.push({ ws, passcode: playerPasscode });
          game.gameState.gamePhase = 'initialBidding';
          ws.send(JSON.stringify({ type: 'GAME_JOINED', passcode: playerPasscode }));
          game.players.forEach((player, index) => {
            player.ws.send(JSON.stringify({ type: 'GAME_STATE', gameState: game.gameState, playerIndex: index }));
          });
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not found or already full' }));
        }
        break;

      case 'MAKE_MOVE':
        const currentGame = games[data.gameId];
        if (currentGame && currentGame.players.find(p => p.passcode === data.passcode)) {
          // Implement game logic here (initial bidding, placement bidding, etc.)
          // Update currentGame.gameState based on the move
          // Send updated game state to both players
          currentGame.players.forEach((player, index) => {
            player.ws.send(JSON.stringify({ type: 'GAME_STATE', gameState: currentGame.gameState, playerIndex: index }));
          });
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid game or passcode' }));
        }
        break;
    }
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});