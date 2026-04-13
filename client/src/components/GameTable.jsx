import React from 'react';
import PlayerHand from './PlayerHand';
import TrickArea from './TrickArea';
import BidPanel from './BidPanel';
import ScoreBoard from './ScoreBoard';
import { cardImageUrl } from '../utils/gameRules';

/**
 * Arrange players around the table relative to "me" (always bottom).
 */
function arrangeSeats(players, mySocketId) {
  const myIndex = players.findIndex(p => p.socketId === mySocketId);
  if (myIndex === -1) return players.map((p, i) => ({ player: p, position: i === 0 ? 'bottom' : 'top' }));

  const rotated = [];
  for (let i = 0; i < players.length; i++) {
    rotated.push(players[(myIndex + i) % players.length]);
  }

  const n = rotated.length;
  const positions2 = ['bottom', 'top'];
  const positions3 = ['bottom', 'top-left', 'top-right'];
  const positions4 = ['bottom', 'left', 'top', 'right'];
  const positions5 = ['bottom', 'left', 'top-left', 'top-right', 'right'];
  const positions6 = ['bottom', 'left', 'top-left', 'top', 'top-right', 'right'];
  const posMap = n === 2 ? positions2 : n === 3 ? positions3 : n === 4 ? positions4 : n === 5 ? positions5 : positions6;

  return rotated.map((player, i) => ({ player, position: posMap[i] }));
}

// Initials avatar fallback
function Avatar({ name, isActive, size = 'md' }) {
  const initials = name?.slice(0, 2).toUpperCase() ?? '??';
  const sz = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm';
  return (
    <div className={`
      ${sz} rounded-full flex items-center justify-center font-bold
      bg-felt-center border-2 select-none shrink-0
      ${isActive ? 'active-ring border-blue-400' : 'border-gray-600'}
    `}>
      {initials}
    </div>
  );
}


function OpponentSlot({ player, isActive, currentTrickCard }) {
  const handCount = player.hand?.length ?? 0;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[72px]">
      {/* Avatar with active ring */}
      <Avatar name={player.name} isActive={isActive} />

      {/* Name + bid progress */}
      <p className={`text-xs font-semibold truncate max-w-[80px] text-center leading-tight
        ${isActive ? 'text-blue-300' : 'text-gray-300'}`}>
        {player.name}
      </p>
      <p className={`text-xs font-mono ${isActive ? 'text-yellow-300' : 'text-gray-500'}`}>
        {player.bid !== null && player.bid !== undefined
          ? `${player.tricksWon}/${player.bid}`
          : '—'}
      </p>

      {/* Face-down card fan */}
      <div className="relative flex h-10 mt-1" style={{ width: `${Math.min(handCount, 5) * 10 + 18}px` }}>
        {Array.from({ length: Math.min(handCount, 5) }).map((_, i) => (
          <img
            key={i}
            src="https://deckofcardsapi.com/static/img/back.png"
            alt="card back"
            className="w-7 h-auto rounded card-shadow absolute"
            style={{ left: `${i * 10}px`, zIndex: i }}
          />
        ))}
      </div>
      {handCount > 5 && (
        <span className="text-xs text-gray-500 -mt-1">{handCount} cards</span>
      )}

      {/* Card played in current trick */}
      {currentTrickCard && (
        <img
          src={cardImageUrl(currentTrickCard)}
          alt={`${currentTrickCard.rank} of ${currentTrickCard.suit}`}
          className="w-10 h-auto rounded card-shadow mt-1 ring-1 ring-white/30"
        />
      )}
    </div>
  );
}

const POSITION_CLASSES = {
  top:         'absolute top-3 left-1/2 -translate-x-1/2',
  'top-left':  'absolute top-3 left-[18%]',
  'top-right': 'absolute top-3 right-[18%]',
  left:        'absolute left-3 top-1/2 -translate-y-1/2',
  right:       'absolute right-3 top-1/2 -translate-y-1/2',
  bottom:      '',
};

export default function GameTable({ gameState, mySocketId, roomCode, onSubmitBid, onPlayCard, errorMsg, onClearError }) {
  if (!gameState) return null;

  const { players, status, currentTurn, currentTrick, leadSuit, spadesBroken, winner } = gameState;

  const me = players.find(p => p.socketId === mySocketId);
  const isMyTurn = currentTurn === mySocketId;
  const activeName = players.find(p => p.socketId === currentTurn)?.name ?? '';
  const seats = arrangeSeats(players, mySocketId);

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

      {/* Table */}
      <div className="flex-1 relative overflow-hidden">
        {/* Navy felt table */}
        <div className="absolute inset-4 rounded-[3rem] bg-felt border-2 border-white/5 shadow-inner flex flex-col items-center justify-center gap-2">

          {/* ── Turn indicator banner ── */}
          {status === 'playing' && (
            <div className={`
              px-4 py-1.5 rounded-full text-sm font-semibold border
              ${isMyTurn
                ? 'bg-blue-600/80 border-blue-400 text-white animate-pulse'
                : 'bg-felt-center/80 border-white/10 text-gray-300'}
            `}>
              {isMyTurn ? '⭐ Your turn' : `${activeName}'s turn`}
            </div>
          )}

          {/* Trick area */}
          <div className="w-64 h-44">
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

      {/* My seat — bottom */}
      {me && (
        <div className={`pb-2 pt-1 flex flex-col items-center transition-colors ${isMyTurn ? 'bg-blue-900/20' : ''}`}>
          {/* My info bar */}
          <div className="flex items-center gap-3 mb-2">
            <Avatar name={me.name} isActive={isMyTurn} size="sm" />
            <div>
              <p className={`text-sm font-semibold leading-tight ${isMyTurn ? 'text-blue-300' : 'text-gray-300'}`}>
                {me.name}
                {isMyTurn && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">YOUR TURN</span>}
              </p>
              <p className="text-xs text-gray-500">
                {me.bid !== null && me.bid !== undefined
                  ? `${me.tricksWon}/${me.bid} tricks · ${me.score} pts`
                  : `${me.score} pts`}
              </p>
            </div>
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
