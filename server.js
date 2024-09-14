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

// Check for a winner
function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
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
          const playerIndex = currentGame.players.findIndex(p => p.passcode === data.passcode);
          const { gameState } = currentGame;

          if (gameState.gamePhase === 'initialBidding') {
            gameState.bids[`player${playerIndex + 1}`] = data.bid;
            if (gameState.bids.player1 !== '' && gameState.bids.player2 !== '') {
              const bid1 = parseInt(gameState.bids.player1);
              const bid2 = parseInt(gameState.bids.player2);
              if (bid1 > bid2) {
                gameState.players[0].mark = 'X';
                gameState.players[1].mark = 'O';
                gameState.players[0].funds -= bid1;
              } else if (bid2 > bid1) {
                gameState.players[0].mark = 'O';
                gameState.players[1].mark = 'X';
                gameState.players[1].funds -= bid2;
              } else {
                // Tie, decide randomly
                const randomOwner = Math.random() < 0.5 ? 0 : 1;
                gameState.players[randomOwner].mark = 'X';
                gameState.players[1 - randomOwner].mark = 'O';
              }
              gameState.gamePhase = 'playing';
              gameState.message = `${gameState.players[0].mark === 'X' ? gameState.players[0].name : gameState.players[1].name} won the bid for X.`;
              gameState.bids = { player1: '', player2: '' };
            }
          } else if (gameState.gamePhase === 'playing') {
            if (data.moveType === 'PLACEMENT_BID') {
              gameState.bids[`player${playerIndex + 1}`] = data.bid;
            } else if (data.moveType === 'PLACEMENT_POSITION') {
              gameState.positions[`player${playerIndex + 1}`] = data.position;
            } else if (data.moveType === 'SUBMIT_PLACEMENT') {
              const bid1 = parseInt(gameState.bids.player1);
              const bid2 = parseInt(gameState.bids.player2);
              const pos1 = parseInt(gameState.positions.player1);
              const pos2 = parseInt(gameState.positions.player2);

              const effectiveBid1 = pos1 === 10 ? Math.floor(bid1 / 2) : bid1;
              const effectiveBid2 = pos2 === 10 ? Math.floor(bid2 / 2) : bid2;

              let winningPlayer, winningBid, winningPosition;

              if (effectiveBid1 > effectiveBid2 || (effectiveBid1 === effectiveBid2 && gameState.players[gameState.currentPlayer].mark === gameState.players[0].mark)) {
                winningPlayer = 0;
                winningBid = bid1;
                winningPosition = pos1;
              } else {
                winningPlayer = 1;
                winningBid = bid2;
                winningPosition = pos2;
              }

              gameState.players[winningPlayer].funds -= winningBid;

              if (winningPosition !== 10 && gameState.board[winningPosition - 1] === null) {
                gameState.board[winningPosition - 1] = gameState.players[gameState.currentPlayer].mark;
                const winner = checkWinner(gameState.board);
                if (winner) {
                  gameState.winner = winner;
                  gameState.gamePhase = 'gameOver';
                  gameState.message = `${winner} wins!`;
                } else if (!gameState.board.includes(null)) {
                  gameState.gamePhase = 'gameOver';
                  gameState.message = "It's a tie!";
                }
              } else if (winningPosition === 10) {
                gameState.message = `${gameState.players[winningPlayer].name} placed the mark off-board.`;
              } else {
                gameState.message = `The chosen position is already occupied. ${gameState.players[winningPlayer].name} loses their bid.`;
              }

              gameState.currentPlayer = 1 - gameState.currentPlayer;
              gameState.bids = { player1: '', player2: '' };
              gameState.positions = { player1: '', player2: '' };
            }
          }

          currentGame.players.forEach((player, index) => {
            player.ws.send(JSON.stringify({ type: 'GAME_STATE', gameState: gameState, playerIndex: index }));
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