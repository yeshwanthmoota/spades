import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import ShuffleAnimation from './components/ShuffleAnimation';

export default function App() {
  const {
    connected, roomCode, gameState, errorMsg, mySocketId,
    createRoom, joinRoom, startGame, submitBid, playCard,
    voteRematch, startRematch, clearError,
  } = useSocket();

  const [showShuffle, setShowShuffle] = useState(false);
  const prevStatusRef = useRef(null);
  const prevRoundRef  = useRef(null);

  // Trigger shuffle animation on every new hand deal
  useEffect(() => {
    if (!gameState) return;
    const { status, roundNumber } = gameState;
    const prevStatus = prevStatusRef.current;
    const prevRound  = prevRoundRef.current;

    const newHand =
      (prevStatus === 'lobby'   && status === 'bidding') ||
      (prevStatus === 'playing' && status === 'bidding') ||
      (status === 'bidding' && prevRound !== null && roundNumber !== prevRound);

    if (newHand) setShowShuffle(true);

    prevStatusRef.current = status;
    prevRoundRef.current  = roundNumber;
  }, [gameState?.status, gameState?.roundNumber]);

  const inGame = gameState && gameState.status !== 'lobby';

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 animate-pulse text-lg">Connecting to server…</div>
      </div>
    );
  }

  return (
    <>
      {showShuffle && (
        <ShuffleAnimation
          numPlayers={gameState?.players?.length ?? 4}
          onDone={() => setShowShuffle(false)}
        />
      )}

      {inGame ? (
        <GameTable
          gameState={gameState}
          mySocketId={mySocketId}
          roomCode={roomCode}
          onSubmitBid={submitBid}
          onPlayCard={playCard}
          onVoteRematch={voteRematch}
          onStartRematch={startRematch}
          errorMsg={errorMsg}
          onClearError={clearError}
        />
      ) : (
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
      )}
    </>
  );
}
