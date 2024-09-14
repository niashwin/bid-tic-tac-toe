import React, { useState, useEffect, useCallback } from 'react';

const BidTicTacToe = () => {
  const [gameState, setGameState] = useState(null);
  const [gameId, setGameId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [playerIndex, setPlayerIndex] = useState(null);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const socket = new WebSocket(`ws://${window.location.host}`);
    setWs(socket);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'GAME_CREATED':
          setGameId(data.gameId);
          setPasscode(data.passcode);
          break;
        case 'GAME_JOINED':
          setPasscode(data.passcode);
          break;
        case 'GAME_STATE':
          setGameState(data.gameState);
          setPlayerIndex(data.playerIndex);
          break;
        case 'ERROR':
          alert(data.message);
          break;
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  const createGame = useCallback(() => {
    ws.send(JSON.stringify({ type: 'CREATE_GAME' }));
  }, [ws]);

  const joinGame = useCallback(() => {
    ws.send(JSON.stringify({ type: 'JOIN_GAME', gameId }));
  }, [ws, gameId]);

  const makeMove = useCallback((type, data) => {
    ws.send(JSON.stringify({ type: 'MAKE_MOVE', gameId, passcode, moveType: type, ...data }));
  }, [ws, gameId, passcode]);

  if (!gameState) {
    return (
      <div style={{ padding: '1rem', maxWidth: '400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Bid Tic-Tac-Toe</h1>
        <button onClick={createGame} style={{ padding: '0.5rem', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>Create Game</button>
        <input
          type="text"
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          style={{ marginBottom: '0.5rem', padding: '0.25rem' }}
        />
        <button onClick={joinGame} style={{ padding: '0.5rem', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}>Join Game</button>
        {passcode && <p>Your passcode: {passcode}</p>}
      </div>
    );
  }

  const { board, players, currentPlayer, gamePhase, bids, positions, winner, message } = gameState;

  return (
    <div style={{ padding: '1rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Bid Tic-Tac-Toe</h1>
      
      {message && <div style={{ padding: '0.5rem', backgroundColor: '#f0f0f0', marginBottom: '1rem' }}>{message}</div>}
      
      <div style={{ marginBottom: '1rem' }}>
        <p>{players[0].name}: ${players[0].funds} ({players[0].mark}){playerIndex === 0 && ' (You)'}</p>
        <p>{players[1].name}: ${players[1].funds} ({players[1].mark}){playerIndex === 1 && ' (You)'}</p>
      </div>
      
      {gamePhase === 'initialBidding' && (
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Bid for X</h2>
          <input
            type="number"
            placeholder={`Player ${playerIndex + 1} Bid`}
            value={bids[`player${playerIndex + 1}`]}
            onChange={(e) => makeMove('INITIAL_BID', { bid: e.target.value })}
            style={{ marginBottom: '0.5rem', width: '100%', padding: '0.25rem' }}
          />
          <button onClick={() => makeMove('SUBMIT_INITIAL_BID')} style={{ padding: '0.5rem', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}>Submit Bid</button>
        </div>
      )}
      
      {gamePhase === 'playing' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
            {board.map((cell, index) => (
              <div key={index} style={{ border: '1px solid black', height: '4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                {cell}
              </div>
            ))}
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Place {players[currentPlayer].mark}</h2>
            <input
              type="number"
              placeholder="Bid"
              value={bids[`player${playerIndex + 1}`]}
              onChange={(e) => makeMove('PLACEMENT_BID', { bid: e.target.value })}
              style={{ marginBottom: '0.5rem', width: '100%', padding: '0.25rem' }}
            />
            <input
              type="number"
              placeholder="Position (1-10)"
              value={positions[`player${playerIndex + 1}`]}
              onChange={(e) => makeMove('PLACEMENT_POSITION', { position: e.target.value })}
              style={{ marginBottom: '0.5rem', width: '100%', padding: '0.25rem' }}
            />
            <button onClick={() => makeMove('SUBMIT_PLACEMENT')} style={{ padding: '0.5rem', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}>Submit</button>
          </div>
        </>
      )}
      
      {gamePhase === 'gameOver' && (
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Game Over</h2>
          <p>{winner === 'Tie' ? "It's a tie!" : `${winner} wins!`}</p>
        </div>
      )}

      <p>Game ID: {gameId}</p>
      <p>Your passcode: {passcode}</p>
    </div>
  );
};

export default BidTicTacToe;