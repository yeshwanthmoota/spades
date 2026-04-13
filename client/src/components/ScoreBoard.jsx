import React, { useState } from 'react';

function scoreColor(score) {
  if (score > 0)  return 'text-green-400';
  if (score < 0)  return 'text-red-400';
  return 'text-gray-400';
}

// Show the per-hand earned points with colour coding
function handEarned(bid, tricksWon) {
  let pts;
  if (bid === 0) {
    pts = tricksWon === 0 ? 50 : -50;
  } else {
    const base = tricksWon * 10;
    pts = tricksWon < bid
      ? base - (bid - tricksWon) * 10
      : base - (tricksWon - bid) * 20;
  }
  const color = pts > 0 ? 'text-green-400' : pts < 0 ? 'text-red-400' : 'text-gray-400';
  const sign  = pts >= 0 ? '+' : '';
  return <span className={`font-mono ${color}`}>{sign}{pts}</span>;
}

export default function ScoreBoard({ gameState, mySocketId }) {
  const [open, setOpen] = useState(false);
  if (!gameState) return null;

  const { players, targetScore, handHistory, status, winner } = gameState;

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed top-3 right-3 z-40 bg-felt-dark border border-gray-600 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-felt transition"
      >
        Scores
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="bg-felt rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-center mb-1">
              <h2 className="text-2xl font-bold">Scores</h2>
              <span className="text-gray-400 text-sm">First to {targetScore} pts</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">+10 per trick won · −10 per undertrick · −10 per bag</p>

            {/* Current totals */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 mb-2 text-xs font-semibold text-gray-500 border-b border-gray-700 pb-2">
              <span>Player</span>
              <span className="text-center">Bid</span>
              <span className="text-center">Won</span>
              <span className="text-center">±</span>
              <span className="text-center">Total</span>
            </div>
            {players.map(p => {
              const deviation = p.bid !== null ? Math.abs(p.tricksWon - p.bid) : null;
              return (
                <div key={p.socketId}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 py-1.5 text-sm rounded
                    ${p.socketId === mySocketId ? 'text-yellow-300' : ''}`}>
                  <span className="font-semibold">{p.name}{p.socketId === mySocketId ? ' ★' : ''}</span>
                  <span className="text-center font-mono">{p.bid ?? '—'}</span>
                  <span className="text-center font-mono">{p.tricksWon}</span>
                  {/* Deviation indicator */}
                  <span className="text-center font-mono text-xs">
                    {deviation === null ? '—'
                      : deviation === 0
                        ? <span className="text-green-400">✔</span>
                        : <span className="text-red-400">−{deviation}</span>}
                  </span>
                  <span className={`text-center font-mono font-bold ${scoreColor(p.score)}`}>
                    {p.score}
                  </span>
                </div>
              );
            })}

            {/* Hand history */}
            {handHistory && handHistory.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Hand History</h3>
                {handHistory.map((hand, i) => (
                  <div key={i} className="mb-3 bg-felt-dark/50 rounded-lg p-2">
                    <p className="text-xs text-gray-500 mb-1 font-semibold">Hand {i + 1}</p>
                    {hand.map(p => (
                      <div key={p.name} className="flex justify-between text-xs text-gray-300 px-1 py-0.5">
                        <span>{p.name}</span>
                        <span className="flex items-center gap-1">
                          {p.bid} bid / {p.tricksWon} won
                          <span className="mx-1 text-gray-600">→</span>
                          {handEarned(p.bid, p.tricksWon)}
                          <span className="text-gray-500 ml-1">({p.score} total)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {status === 'finished' && winner && (
              <div className="mt-4 bg-yellow-400 text-black rounded-xl p-3 text-center font-bold text-lg">
                🏆 {winner} wins!
              </div>
            )}

            <button onClick={() => setOpen(false)}
              className="mt-5 w-full py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-felt-dark transition text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
