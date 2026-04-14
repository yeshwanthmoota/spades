import React, { useState, useEffect } from 'react';
import PlayerHand from './PlayerHand';
import TrickArea from './TrickArea';
import BidPanel from './BidPanel';
import ScoreBoard from './ScoreBoard';
import RulesModal from './RulesModal';
import { cardImageUrl, getGullyCardsForRound, getGullyTotalRounds } from '../utils/gameRules';

// ─── Seat layout ─────────────────────────────────────────────────────────────

function arrangeSeats(players, mySocketId) {
  const myIndex = players.findIndex(p => p.socketId === mySocketId);
  if (myIndex === -1) return players.map((p, i) => ({ player: p, position: i === 0 ? 'bottom' : 'top' }));

  const rotated = [];
  for (let i = 0; i < players.length; i++) {
    rotated.push(players[(myIndex + i) % players.length]);
  }

  const maps = {
    2: ['bottom', 'top'],
    3: ['bottom', 'top-left', 'top-right'],
    4: ['bottom', 'left', 'top', 'right'],
    5: ['bottom', 'left', 'top-left', 'top-right', 'right'],
    6: ['bottom', 'left', 'top-left', 'top', 'top-right', 'right'],
    7: ['bottom', 'bottom-left', 'left', 'top-left', 'top-right', 'right', 'bottom-right'],
    8: ['bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right', 'right', 'bottom-right'],
  };
  const posMap = maps[rotated.length] ?? maps[6];
  return rotated.map((player, i) => ({ player, position: posMap[i] }));
}

// Top bar is fixed h-12 (48px). Top players sit below it with top-20 (80px) for clearance.
// Left/right players are vertically centred; bottom players are at the bottom edge.
const POSITION_CLASSES = {
  top:            'absolute top-20 left-1/2 -translate-x-1/2',
  'top-left':     'absolute top-20 left-[18%]',
  'top-right':    'absolute top-20 right-[18%]',
  left:           'absolute left-2 top-1/2 -translate-y-1/2',
  right:          'absolute right-2 top-1/2 -translate-y-1/2',
  'bottom-left':  'absolute bottom-2 left-[18%]',
  'bottom-right': 'absolute bottom-2 right-[18%]',
  bottom:         '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, isActive, size = 'md' }) {
  const initials = name?.slice(0, 2).toUpperCase() ?? '??';
  const sz = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold bg-felt-center border-2 select-none shrink-0
      ${isActive ? 'active-ring border-blue-400' : 'border-gray-600'}`}>
      {initials}
    </div>
  );
}

function OpponentSlot({ player, isActive, currentTrickCard }) {
  const handCount = player.hand?.length ?? 0;
  const isDisconnected = player.disconnected === true;
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[64px]">
      <div className="relative">
        <Avatar name={player.name} isActive={isActive} />
        {isDisconnected && (
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
            BOT
          </span>
        )}
      </div>
      <p className={`text-xs font-semibold truncate max-w-[72px] text-center leading-tight
        ${isDisconnected ? 'text-orange-400' : isActive ? 'text-blue-300' : 'text-gray-300'}`}>
        {player.name}
        {isDisconnected && <span className="text-orange-500"> ⚙</span>}
      </p>
      <p className={`text-xs font-mono ${isActive ? 'text-yellow-300' : 'text-gray-500'}`}>
        {player.bid !== null && player.bid !== undefined ? `${player.tricksWon}/${player.bid}` : '—'}
      </p>
      {/* Face-down fan */}
      <div className="relative flex h-9 mt-0.5" style={{ width: `${Math.min(handCount, 5) * 9 + 16}px` }}>
        {Array.from({ length: Math.min(handCount, 5) }).map((_, i) => (
          <img key={i} src="https://deckofcardsapi.com/static/img/back.png" alt="card"
            className="w-6 h-auto rounded card-shadow absolute" style={{ left: `${i * 9}px`, zIndex: i }} />
        ))}
      </div>
      {handCount > 5 && <span className="text-xs text-gray-600">{handCount} cards</span>}
      {currentTrickCard && (
        <img src={cardImageUrl(currentTrickCard)} alt={`${currentTrickCard.rank} of ${currentTrickCard.suit}`}
          className="w-9 h-auto rounded card-shadow mt-1 ring-1 ring-white/30" />
      )}
    </div>
  );
}

// ─── Rematch overlay ──────────────────────────────────────────────────────────

function RematchOverlay({ gameState, mySocketId, roomCode, onVote, onStartRematch }) {
  const { winner, players, rematchVotes = [] } = gameState;
  const me = players.find(p => p.socketId === mySocketId);
  const isHost = me?.isHost;
  const myVoted = rematchVotes.includes(mySocketId);
  const canStart = isHost && players.length >= 2;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-felt rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10 text-center">
        <p className="text-4xl mb-2">🏆</p>
        <h2 className="text-2xl font-bold text-yellow-300 mb-1">{winner} wins!</h2>
        <p className="text-gray-400 text-sm mb-4">Final scores</p>

        {/* Scores */}
        <div className="mb-5 space-y-1">
          {[...players].sort((a, b) => b.score - a.score).map(p => (
            <div key={p.socketId} className="flex justify-between text-sm px-2">
              <span className={p.socketId === mySocketId ? 'text-yellow-300 font-semibold' : 'text-gray-300'}>
                {p.name}{p.socketId === mySocketId ? ' (you)' : ''}
              </span>
              <span className="font-mono font-bold">{p.score}</span>
            </div>
          ))}
        </div>

        {/* Rematch vote status */}
        <div className="flex justify-center gap-3 flex-wrap mb-5">
          {players.map(p => (
            <div key={p.socketId} className="flex flex-col items-center text-xs gap-0.5">
              <div className="relative">
                <Avatar name={p.name} isActive={false} size="sm" />
                {p.disconnected && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                    BOT
                  </span>
                )}
              </div>
              <span className={`truncate max-w-[56px] ${p.disconnected ? 'text-orange-400' : 'text-gray-400'}`}>{p.name}</span>
              <span>{rematchVotes.includes(p.socketId)
                ? <span className="text-green-400">✔ Ready</span>
                : <span className="text-gray-600">…</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Vote buttons */}
        {!myVoted ? (
          <div className="flex gap-3 mb-3">
            <button onClick={() => onVote(roomCode, false)}
              className="flex-1 py-2 rounded-xl border border-gray-600 text-gray-300 hover:bg-red-900/30 transition text-sm font-semibold">
              Leave
            </button>
            <button onClick={() => onVote(roomCode, true)}
              className="flex-1 py-2 rounded-xl bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition text-sm">
              Play Again ♠
            </button>
          </div>
        ) : (
          <p className="text-green-400 text-sm mb-3">You're ready! Waiting for others…</p>
        )}

        {/* Host start button */}
        {isHost && (
          <button onClick={() => onStartRematch(roomCode)} disabled={!canStart}
            className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm">
            Start New Game ({players.length} players)
          </button>
        )}
        <p className="text-gray-600 text-xs mt-2">Share code <span className="font-mono text-gray-400">{roomCode}</span> to invite more players</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GameTable({
  gameState, mySocketId, roomCode,
  onSubmitBid, onPlayCard, onVoteRematch, onStartRematch,
  errorMsg, onClearError,
}) {
  const [showRules, setShowRules] = useState(false);
  const [countdown, setCountdown] = useState(0);
  if (!gameState) return null;

  const { players, status, currentTurn, currentTrick, leadSuit, spadesBroken, gameMode, roundNumber } = gameState;
  const isRoundEnd = status === 'round_end';

  // Countdown timer shown during round_end pause
  useEffect(() => {
    if (!isRoundEnd) { setCountdown(0); return; }
    setCountdown(10);
    const interval = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(interval); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(interval);
  }, [isRoundEnd, roundNumber]);
  const me = players.find(p => p.socketId === mySocketId);
  const isMyTurn = currentTurn === mySocketId;
  const activeName = players.find(p => p.socketId === currentTurn)?.name ?? '';
  const seats = arrangeSeats(players, mySocketId);

  const trickCardByPlayer = {};
  if (currentTrick) for (const { playerId, card } of currentTrick) trickCardByPlayer[playerId] = card;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-felt-dark">
      {/* Portrait phone hint — shown only on narrow screens shorter than 600px */}
      <div className="sm:hidden landscape:hidden fixed bottom-2 left-1/2 -translate-x-1/2 z-50
        bg-black/80 text-gray-300 text-xs rounded-full px-4 py-1.5 pointer-events-none
        [display:none] [@media(max-width:600px)and(orientation:portrait)]:block">
        Rotate for best experience ↻
      </div>

      {/* Rules modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* ── Fixed top bar ────────────────────────────────────────────────────── */}
      {/* Background strip */}
      <div className="fixed top-0 left-0 right-0 h-12 z-30 bg-felt-dark border-b border-white/5 pointer-events-none" />

      {/* Rules — left */}
      <button onClick={() => setShowRules(true)}
        className="fixed top-0 left-0 h-12 z-40 flex items-center px-4 text-sm font-semibold hover:bg-white/5 transition border-r border-white/5">
        ♠ Rules
      </button>

      {/* Room code — centre */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 h-12 z-40 flex items-center gap-2 px-4 pointer-events-none">
        <span className="text-gray-500 text-xs tracking-wide">ROOM</span>
        <span className="font-mono font-bold text-yellow-300 tracking-widest text-sm">{roomCode}</span>
      </div>

      {/* Scores — right (rendered by ScoreBoard which sits in the same bar) */}
      <ScoreBoard gameState={gameState} mySocketId={mySocketId} />

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-red-700 text-white rounded-lg px-4 py-2 text-sm shadow-lg flex gap-3 items-center">
          {errorMsg}
          <button onClick={onClearError} className="underline text-xs">dismiss</button>
        </div>
      )}

      {/* Game over + rematch overlay */}
      {status === 'finished' && (
        <RematchOverlay
          gameState={gameState}
          mySocketId={mySocketId}
          roomCode={roomCode}
          onVote={onVoteRematch}
          onStartRematch={onStartRematch}
        />
      )}

      {/* Table — pt-12 offsets the fixed top bar (h-12) */}
      <div className="flex-1 relative overflow-hidden pt-12">
        <div className="absolute inset-4 rounded-[3rem] bg-felt border-2 border-white/5 shadow-inner flex flex-col items-center justify-center gap-2">

          {/* Turn banner */}
          {status === 'playing' && (
            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border
              ${isMyTurn
                ? 'bg-blue-600/80 border-blue-400 text-white animate-pulse'
                : 'bg-felt-center/80 border-white/10 text-gray-300'}`}>
              {isMyTurn ? '⭐ Your turn' : `${activeName}'s turn`}
            </div>
          )}

          {/* Gully round indicator */}
          {gameMode === 'gully' && status !== 'finished' && (
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 border border-orange-400/50 text-orange-300">
              Round {roundNumber} of {getGullyTotalRounds(players.length)} · {getGullyCardsForRound(roundNumber, players.length)} card{getGullyCardsForRound(roundNumber, players.length) !== 1 ? 's' : ''}
              {' · '}{roundNumber <= Math.floor(52 / players.length) ? '↑ ascending' : '↓ descending'}
            </div>
          )}

          {/* Round-end countdown banner */}
          {isRoundEnd && (
            <div className="px-5 py-2 rounded-full text-sm font-semibold bg-green-700/60 border border-green-400/50 text-green-200">
              Round complete! Next round in {countdown}s…
            </div>
          )}

          {/* Trick area — show lastTrick during round_end so cards stay visible */}
          <div className="w-64 h-44">
            <TrickArea
              currentTrick={isRoundEnd ? (gameState.lastTrick ?? []) : currentTrick}
              players={players}
              spadesBroken={spadesBroken}
            />
          </div>
        </div>

        {/* Opponent seats */}
        {seats.filter(s => s.position !== 'bottom').map(({ player, position }) => (
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
        <div className={`pb-2 pt-1 flex flex-col items-center transition-colors ${isMyTurn && status === 'playing' ? 'bg-blue-900/20' : ''}`}>
          {status === 'playing' && (
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
          )}

          {status === 'bidding' && (
            <BidPanel gameState={gameState} mySocketId={mySocketId} roomCode={roomCode} onSubmitBid={onSubmitBid} />
          )}

          {isRoundEnd && (
            <p className="text-gray-500 text-sm pb-2">Scores updated — next round starting shortly…</p>
          )}

          {status === 'playing' && me.hand && (
            <PlayerHand
              hand={me.hand} isMyTurn={isMyTurn} leadSuit={leadSuit}
              spadesBroken={spadesBroken} roomCode={roomCode} onPlayCard={onPlayCard}
            />
          )}
        </div>
      )}
    </div>
  );
}
