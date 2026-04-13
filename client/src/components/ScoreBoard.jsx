import React, { useState } from 'react';
import { getGullyCardsForRound, getGullyTotalRounds } from '../utils/gameRules';

function handEarned(bid, tricksWon, isGully) {
  if (isGully) {
    return bid === tricksWon ? bid * 11 + 10 : 0;
  }
  if (bid === 0) return tricksWon === 0 ? 50 : -50;
  const base = tricksWon * 10;
  return tricksWon < bid
    ? base - (bid - tricksWon) * 10
    : base - (tricksWon - bid) * 20;
}

function PtsCell({ pts }) {
  const color = pts > 0 ? 'text-green-400' : pts < 0 ? 'text-red-400' : 'text-gray-500';
  return (
    <span className={`font-mono tabular-nums ${color}`}>
      {pts > 0 ? `+${pts}` : pts}
    </span>
  );
}

function DeviationCell({ bid, tricksWon, isGully }) {
  if (bid === null || bid === undefined) return <span className="text-gray-600">—</span>;
  const dev = tricksWon - bid;
  if (dev === 0) return <span className="text-green-400 font-bold">✓</span>;
  if (isGully)   return <span className="text-red-400 font-bold">✗</span>;
  // Traditional: +N = bags (orange), -N = undertricks (red)
  return dev > 0
    ? <span className="text-orange-400 font-mono tabular-nums">+{dev}</span>
    : <span className="text-red-400 font-mono tabular-nums">{dev}</span>;
}

// Column layout shared by the main table and hand history rows
const COL = 'grid-cols-[1fr_2.5rem_2.5rem_2.5rem_3.5rem]';

export default function ScoreBoard({ gameState, mySocketId }) {
  const [open, setOpen] = useState(false);
  if (!gameState) return null;

  const { players, targetScore, handHistory, status, winner } = gameState;
  const isGully = gameState.gameMode === 'gully';
  const totalRounds = isGully ? getGullyTotalRounds(players.length) : null;

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed top-3 right-3 z-40 bg-felt-dark border border-gray-600 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-felt transition"
      >
        Scores
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-felt rounded-2xl p-5 w-full max-w-xl shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">Scores</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isGully
                    ? 'Exact bid: (bid×11)+10 pts · Miss: 0 pts'
                    : 'Exact: bid×10 · Bags (over): −20 each · Under: −10 each'}
                </p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-800 rounded-full px-2.5 py-1 shrink-0 ml-3 mt-0.5">
                {isGully ? `All ${totalRounds} rounds` : `First to ${targetScore} pts`}
              </span>
            </div>

            {/* ── Current Scores Table ────────────────────────────────── */}
            <div className="rounded-xl overflow-hidden border border-white/5">
              {/* Header row */}
              <div className={`grid ${COL} bg-gray-800/70 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide`}>
                <span>Player</span>
                <span className="text-right">Bid</span>
                <span className="text-right">Won</span>
                <span className="text-right">±</span>
                <span className="text-right">Score</span>
              </div>

              {sortedPlayers.map((p, idx) => {
                const isMe = p.socketId === mySocketId;
                return (
                  <div
                    key={p.socketId}
                    className={`grid ${COL} px-3 py-2.5 text-sm items-center border-t border-white/5
                      ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''}
                      ${isMe ? 'bg-yellow-400/10 border-l-2 border-yellow-400' : ''}`}
                  >
                    <span className={`font-semibold truncate ${isMe ? 'text-yellow-300' : 'text-white'}`}>
                      {p.name}{isMe ? ' ★' : ''}
                    </span>
                    <span className="text-right font-mono tabular-nums text-gray-300">{p.bid ?? '—'}</span>
                    <span className="text-right font-mono tabular-nums text-gray-300">{p.tricksWon}</span>
                    <span className="text-right">
                      <DeviationCell bid={p.bid} tricksWon={p.tricksWon} isGully={isGully} />
                    </span>
                    <span className={`text-right font-mono font-bold tabular-nums
                      ${p.score > 0 ? 'text-green-400' : p.score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {p.score > 0 ? `+${p.score}` : p.score}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ± legend */}
            <p className="text-xs text-gray-600 mt-1.5 text-right">
              {isGully
                ? '✓ exact bid · ✗ missed'
                : '✓ exact · +N over (bags) · −N under'}
            </p>

            {/* ── Hand History ────────────────────────────────────────── */}
            {handHistory && handHistory.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Hand History</h3>
                <div className="space-y-2">
                  {handHistory.map((hand, i) => {
                    const roundCards = isGully ? getGullyCardsForRound(i + 1, players.length) : null;
                    return (
                      <div key={i} className="rounded-xl overflow-hidden border border-white/5">
                        {/* Hand header */}
                        <div className={`grid ${COL} px-3 py-1.5 bg-gray-800/60 text-xs font-semibold`}>
                          <span className="text-gray-300">
                            Hand {i + 1}
                            {isGully && (
                              <span className="text-gray-500 font-normal ml-2">
                                · {roundCards} card{roundCards !== 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                          <span className="text-right text-gray-500">Bid</span>
                          <span className="text-right text-gray-500">Won</span>
                          <span className="text-right text-gray-500">Pts</span>
                          <span className="text-right text-gray-500">Total</span>
                        </div>

                        {/* Player rows */}
                        {hand.map((p, pi) => {
                          const pts = handEarned(p.bid, p.tricksWon, isGully);
                          const isMe = players.find(pl => pl.name === p.name)?.socketId === mySocketId;
                          return (
                            <div
                              key={p.name}
                              className={`grid ${COL} px-3 py-1.5 text-xs items-center border-t border-white/5
                                ${pi % 2 === 1 ? 'bg-white/[0.015]' : ''}
                                ${isMe ? 'bg-yellow-400/5' : ''}`}
                            >
                              <span className={`font-medium truncate ${isMe ? 'text-yellow-300' : 'text-gray-300'}`}>
                                {p.name}
                              </span>
                              <span className="text-right font-mono tabular-nums text-gray-400">{p.bid}</span>
                              <span className="text-right font-mono tabular-nums text-gray-400">{p.tricksWon}</span>
                              <span className="text-right"><PtsCell pts={pts} /></span>
                              <span className={`text-right font-mono font-semibold tabular-nums
                                ${p.score > 0 ? 'text-green-400' : p.score < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {p.score > 0 ? `+${p.score}` : p.score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Winner banner ───────────────────────────────────────── */}
            {status === 'finished' && winner && (
              <div className="mt-4 bg-yellow-400 text-black rounded-xl p-3 text-center font-bold text-lg">
                🏆 {winner} wins!
              </div>
            )}

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-felt-dark transition text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
