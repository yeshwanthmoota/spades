import React from 'react';
import { useSocket } from './hooks/useSocket';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';

export default function App() {
  const {
    connected,
    roomCode,
    gameState,
    errorMsg,
    mySocketId,
    createRoom,
    joinRoom,
    startGame,
    submitBid,
    playCard,
    clearError,
  } = useSocket();

  const inGame = gameState && gameState.status !== 'lobby';

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 animate-pulse text-lg">Connecting to server…</div>
      </div>
    );
  }

  if (inGame) {
    return (
      <GameTable
        gameState={gameState}
        mySocketId={mySocketId}
        roomCode={roomCode}
        onSubmitBid={submitBid}
        onPlayCard={playCard}
        errorMsg={errorMsg}
        onClearError={clearError}
      />
    );
  }

  return (
    <Lobby
      roomCode={roomCode}
      gameState={gameState}
      mySocketId={mySocketId}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
      onStartGame={startGame}
      errorMsg={errorMsg}
      onClearError={clearError}
    />
  );
}
