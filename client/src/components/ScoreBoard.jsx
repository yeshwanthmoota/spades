import React, { useState } from 'react';
import { getGullyCardsForRound, getGullyTotalRounds } from '../utils/gameRules';

function handEarned(bid, tricksWon, isGully) {
  if (isGully) return bid === tricksWon ? bid * 11 + 10 : 0;
  if (bid === 0) return tricksWon === 0 ? 50 : -50;
  const base = tricksWon * 10;
  return tricksWon < bid
    ? base - (bid - tricksWon) * 10
    : base - (tricksWon - bid) * 20;
}

function PtsCell({ pts }) {
  const color = pts > 0 ? 'text-green-400' : pts < 0 ? 'text-red-400' : 'text-gray-500';
  return <span className={`font-mono tabular-nums ${color}`}>{pts > 0 ? `+${pts}` : pts}</span>;
}

function DevCell({ bid, tricksWon, isGully }) {
  if (bid === null || bid === undefined) return <span className="text-gray-600">—</span>;
  const dev = tricksWon - bid;
  if (dev === 0) return <span className="text-green-400">✓</span>;
  if (isGully)   return <span className="text-red-400">✗</span>;
  return dev > 0
    ? <span className="text-orange-400 font-mono tabular-nums">+{dev}</span>
    : <span className="text-red-400 font-mono tabular-nums">{dev}</span>;
}

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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="bg-felt rounded-2xl p-5 w-full max-w-xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">Scores</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isGully
                    ? 'Exact bid: (bid×11)+10 pts · Miss: 0 pts'
                    : 'Exact: bid×10 · Bags +1 over: −20 · Undertrick: −10'}
                </p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-800 rounded-full px-2.5 py-1 shrink-0 ml-3 mt-0.5">
                {isGully ? `All ${totalRounds} rounds` : `First to ${targetScore} pts`}
              </span>
            </div>

            {/* ── Current Scores ─────────────────────────────────────── */}
            <div className="rounded-xl overflow-hidden border border-white/5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-800/70 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-semibold">Player</th>
                    <th className="text-right px-3 py-2 font-semibold w-12">Bid</th>
                    <th className="text-right px-3 py-2 font-semibold w-12">Won</th>
                    <th className="text-right px-3 py-2 font-semibold w-10">±</th>
                    <th className="text-right px-3 py-2 font-semibold w-16">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p, idx) => {
                    const isMe = p.socketId === mySocketId;
                    return (
                      <tr
                        key={p.socketId}
                        className={`border-t border-white/5
                          ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''}
                          ${isMe ? 'bg-yellow-400/10' : ''}`}
                        style={isMe ? { borderLeft: '2px solid #facc15' } : {}}
                      >
                        <td className={`px-3 py-2.5 font-semibold ${isMe ? 'text-yellow-300' : 'text-white'}`}>
                          {p.name}{isMe ? ' ★' : ''}
                        </td>
                        <td className="text-right px-3 py-2.5 font-mono tabular-nums text-gray-300">
                          {p.bid ?? '—'}
                        </td>
                        <td className="text-right px-3 py-2.5 font-mono tabular-nums text-gray-300">
                          {p.tricksWon}
                        </td>
                        <td className="text-right px-3 py-2.5">
                          <DevCell bid={p.bid} tricksWon={p.tricksWon} isGully={isGully} />
                        </td>
                        <td className={`text-right px-3 py-2.5 font-mono font-bold tabular-nums
                          ${p.score > 0 ? 'text-green-400' : p.score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {p.score > 0 ? `+${p.score}` : p.score}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-600 mt-1.5 text-right">
              {isGully ? '✓ exact · ✗ missed' : '✓ exact · +N bags · −N under'}
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
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-800/60 text-gray-400 font-semibold">
                              <th className="text-left px-3 py-1.5 font-semibold text-gray-300">
                                Hand {i + 1}
                                {isGully && (
                                  <span className="text-gray-500 font-normal ml-1.5">
                                    · {roundCards} card{roundCards !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </th>
                              <th className="text-right px-3 py-1.5 font-semibold w-10">Bid</th>
                              <th className="text-right px-3 py-1.5 font-semibold w-10">Won</th>
                              <th className="text-right px-3 py-1.5 font-semibold w-12">Pts</th>
                              <th className="text-right px-3 py-1.5 font-semibold w-16">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hand.map((p, pi) => {
                              const pts = handEarned(p.bid, p.tricksWon, isGully);
                              const isMe = players.find(pl => pl.name === p.name)?.socketId === mySocketId;
                              return (
                                <tr
                                  key={p.name}
                                  className={`border-t border-white/5
                                    ${pi % 2 === 1 ? 'bg-white/[0.015]' : ''}
                                    ${isMe ? 'bg-yellow-400/5' : ''}`}
                                >
                                  <td className={`px-3 py-1.5 font-medium ${isMe ? 'text-yellow-300' : 'text-gray-300'}`}>
                                    {p.name}
                                  </td>
                                  <td className="text-right px-3 py-1.5 font-mono tabular-nums text-gray-400">{p.bid}</td>
                                  <td className="text-right px-3 py-1.5 font-mono tabular-nums text-gray-400">{p.tricksWon}</td>
                                  <td className="text-right px-3 py-1.5"><PtsCell pts={pts} /></td>
                                  <td className={`text-right px-3 py-1.5 font-mono font-semibold tabular-nums
                                    ${p.score > 0 ? 'text-green-400' : p.score < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                    {p.score > 0 ? `+${p.score}` : p.score}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Winner */}
            {status === 'finished' && winner && (
              <div className="mt-4 bg-yellow-400 text-black rounded-xl p-3 text-center font-bold text-lg">
                🏆 {winner} wins!
              </div>
            )}

            <button onClick={() => setOpen(false)}
              className="mt-4 w-full py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-felt-dark transition text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
