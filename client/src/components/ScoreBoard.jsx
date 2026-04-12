import React, { useState } from 'react';

export default function ScoreBoard({ gameState, mySocketId }) {
  const [open, setOpen] = useState(false);

  if (!gameState) return null;

  const { players, targetScore, handHistory, status, winner } = gameState;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed top-3 right-3 z-40 bg-felt-dark border border-gray-600 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-felt transition"
      >
        Scores
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="bg-felt rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Scores</h2>
              <span className="text-gray-400 text-sm">Target: {targetScore}</span>
            </div>

            {/* Current totals */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 mb-4 text-sm font-semibold text-gray-400 border-b border-gray-700 pb-2">
              <span>Player</span>
              <span className="text-center">Bid</span>
              <span className="text-center">Won</span>
              <span className="text-center">Score</span>
            </div>
            {players.map(p => (
              <div key={p.socketId}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 py-1 text-sm rounded ${p.socketId === mySocketId ? 'text-yellow-300' : ''}`}>
                <span>{p.name}{p.socketId === mySocketId ? ' ★' : ''}</span>
                <span className="text-center font-mono">{p.bid ?? '—'}</span>
                <span className="text-center font-mono">{p.tricksWon}</span>
                <span className="text-center font-mono font-bold">{p.score}</span>
              </div>
            ))}

            {/* Hand history */}
            {handHistory && handHistory.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Hand History</h3>
                {handHistory.map((hand, i) => (
                  <div key={i} className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Hand {i + 1}</p>
                    {hand.map(p => (
                      <div key={p.name} className="flex justify-between text-xs text-gray-300 px-1">
                        <span>{p.name}</span>
                        <span>{p.bid} bid / {p.tricksWon} won → {p.score} pts</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Game over banner */}
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
