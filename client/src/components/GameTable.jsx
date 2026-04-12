import React from 'react';
import PlayerHand from './PlayerHand';
import TrickArea from './TrickArea';
import BidPanel from './BidPanel';
import ScoreBoard from './ScoreBoard';
import { cardImageUrl, suitSymbol } from '../utils/gameRules';

/**
 * Arrange players around the table relative to "me" (always bottom).
 * Returns array of { player, position } where position is:
 *   'bottom' | 'top' | 'left' | 'right' | 'top-left' | 'top-right'
 */
function arrangeSeats(players, mySocketId) {
  const myIndex = players.findIndex(p => p.socketId === mySocketId);
  if (myIndex === -1) return players.map((p, i) => ({ player: p, position: i === 0 ? 'bottom' : 'top' }));

  // Rotate so "me" is first
  const rotated = [];
  for (let i = 0; i < players.length; i++) {
    rotated.push(players[(myIndex + i) % players.length]);
  }

  const n = rotated.length;
  const positions4 = ['bottom', 'left', 'top', 'right'];
  const positions5 = ['bottom', 'left', 'top-left', 'top-right', 'right'];
  const positions6 = ['bottom', 'left', 'top-left', 'top', 'top-right', 'right'];

  const posMap = n === 4 ? positions4 : n === 5 ? positions5 : positions6;

  return rotated.map((player, i) => ({ player, position: posMap[i] }));
}

function OpponentSlot({ player, isActive, currentTrickCard }) {
  const handCount = player.hand?.length ?? 0;
  return (
    <div className={`flex flex-col items-center gap-1 ${isActive ? 'ring-2 ring-yellow-400 rounded-xl p-1' : 'p-1'}`}>
      {/* Face-down cards fan */}
      <div className="flex relative h-12 mb-1">
        {Array.from({ length: Math.min(handCount, 5) }).map((_, i) => (
          <img
            key={i}
            src="https://deckofcardsapi.com/static/img/back.png"
            alt="card back"
            className="w-7 h-auto rounded-sm card-shadow absolute"
            style={{ left: `${i * 10}px`, zIndex: i }}
          />
        ))}
        {handCount > 5 && (
          <span className="absolute text-xs text-gray-300 bottom-0" style={{ left: `${5 * 10 + 4}px` }}>
            +{handCount - 5}
          </span>
        )}
      </div>

      {/* Card played in current trick */}
      {currentTrickCard && (
        <img
          src={cardImageUrl(currentTrickCard)}
          alt={`${currentTrickCard.rank} of ${currentTrickCard.suit}`}
          className="w-10 h-auto rounded card-shadow mb-1"
        />
      )}

      {/* Name + bid info */}
      <div className="text-center">
        <p className={`text-xs font-semibold truncate max-w-[80px] ${isActive ? 'text-yellow-300' : 'text-gray-300'}`}>
          {player.name}
        </p>
        <p className="text-xs text-gray-500">
          {player.bid !== null && player.bid !== undefined
            ? `${player.tricksWon}/${player.bid}`
            : '—'}
        </p>
      </div>
    </div>
  );
}

const POSITION_CLASSES = {
  top: 'absolute top-2 left-1/2 -translate-x-1/2',
  'top-left': 'absolute top-2 left-[20%]',
  'top-right': 'absolute top-2 right-[20%]',
  left: 'absolute left-2 top-1/2 -translate-y-1/2',
  right: 'absolute right-2 top-1/2 -translate-y-1/2',
  bottom: '', // handled separately
};

export default function GameTable({ gameState, mySocketId, roomCode, onSubmitBid, onPlayCard, errorMsg, onClearError }) {
  if (!gameState) return null;

  const { players, status, currentTurn, currentTrick, leadSuit, spadesBroken, winner } = gameState;

  const me = players.find(p => p.socketId === mySocketId);
  const isMyTurn = currentTurn === mySocketId;
  const seats = arrangeSeats(players, mySocketId);

  // Map playerId -> card played in current trick
  const trickCardByPlayer = {};
  if (currentTrick) {
    for (const { playerId, card } of currentTrick) {
      trickCardByPlayer[playerId] = card;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-felt-dark">
      <ScoreBoard gameState={gameState} mySocketId={mySocketId} />

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-red-700 text-white rounded-lg px-4 py-2 text-sm shadow-lg flex gap-3 items-center">
          {errorMsg}
          <button onClick={onClearError} className="underline text-xs">dismiss</button>
        </div>
      )}

      {/* Game over overlay */}
      {status === 'finished' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-felt rounded-2xl p-8 text-center shadow-2xl">
            <p className="text-5xl mb-3">🏆</p>
            <h2 className="text-3xl font-bold text-yellow-300">{winner} wins!</h2>
            <p className="text-gray-400 mt-2 mb-6">Final scores:</p>
            {[...players].sort((a, b) => b.score - a.score).map(p => (
              <div key={p.socketId} className="flex justify-between gap-8 text-sm mb-1 px-4">
                <span className={p.socketId === mySocketId ? 'text-yellow-300' : ''}>{p.name}</span>
                <span className="font-mono font-bold">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bidding overlay */}
      {status === 'bidding' && (
        <BidPanel
          gameState={gameState}
          mySocketId={mySocketId}
          roomCode={roomCode}
          onSubmitBid={onSubmitBid}
        />
      )}

      {/* Table area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Green felt table */}
        <div className="absolute inset-4 rounded-[3rem] bg-felt border-4 border-felt-dark shadow-inner flex items-center justify-center">
          {/* Trick area center */}
          <div className="w-64 h-48">
            <TrickArea
              currentTrick={currentTrick}
              players={players}
              spadesBroken={spadesBroken}
            />
          </div>
        </div>

        {/* Opponent seats */}
        {seats
          .filter(s => s.position !== 'bottom')
          .map(({ player, position }) => (
            <div key={player.socketId} className={POSITION_CLASSES[position]}>
              <OpponentSlot
                player={player}
                isActive={currentTurn === player.socketId}
                currentTrickCard={trickCardByPlayer[player.socketId]}
              />
            </div>
          ))}
      </div>

      {/* My seat — always at the bottom */}
      {me && (
        <div className={`pb-2 pt-1 flex flex-col items-center ${isMyTurn ? 'bg-yellow-900/20' : ''}`}>
          {/* My info bar */}
          <div className="flex items-center gap-4 mb-2 text-sm">
            <span className={`font-semibold ${isMyTurn ? 'text-yellow-300' : 'text-gray-300'}`}>
              {me.name} {isMyTurn && '← YOUR TURN'}
            </span>
            {me.bid !== null && me.bid !== undefined && (
              <span className="text-gray-400">{me.tricksWon}/{me.bid} tricks</span>
            )}
            <span className="text-gray-500 text-xs">Score: {me.score}</span>
          </div>

          {status === 'playing' && me.hand && (
            <PlayerHand
              hand={me.hand}
              isMyTurn={isMyTurn}
              leadSuit={leadSuit}
              spadesBroken={spadesBroken}
              roomCode={roomCode}
              onPlayCard={onPlayCard}
            />
          )}
        </div>
      )}
    </div>
  );
}
