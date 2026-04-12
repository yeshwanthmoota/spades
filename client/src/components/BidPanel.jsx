import React, { useState } from 'react';

export default function BidPanel({ gameState, mySocketId, roomCode, onSubmitBid }) {
  const [bid, setBid] = useState(1);

  const me = gameState?.players?.find(p => p.socketId === mySocketId);
  const isMyTurn = gameState?.currentTurn === mySocketId;
  const alreadyBid = me?.bid !== null && me?.bid !== undefined;
  const handSize = me?.hand?.filter(c => !c.hidden)?.length ?? 0;
  const maxBid = handSize || 13;

  if (!gameState || gameState.status !== 'bidding') return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-felt rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-2xl font-bold mb-1 text-center">Bidding</h2>
        <p className="text-gray-400 text-sm text-center mb-5">
          Minimum bid: 1. You have {handSize} cards.
        </p>

        {/* Show all bids so far */}
        <div className="space-y-1 mb-5">
          {gameState.players.map(p => (
            <div key={p.socketId} className="flex justify-between text-sm px-2">
              <span className={p.socketId === mySocketId ? 'text-yellow-300 font-semibold' : ''}>
                {p.name}{p.socketId === mySocketId ? ' (you)' : ''}
              </span>
              <span>
                {p.bid !== null && p.bid !== undefined
                  ? <span className="text-green-400 font-mono">{p.bid}</span>
                  : gameState.currentTurn === p.socketId
                    ? <span className="text-yellow-300 animate-pulse">bidding…</span>
                    : <span className="text-gray-600">—</span>}
              </span>
            </div>
          ))}
        </div>

        {isMyTurn && !alreadyBid ? (
          <>
            <div className="flex items-center gap-4 justify-center mb-5">
              <button
                onClick={() => setBid(b => Math.max(1, b - 1))}
                className="w-10 h-10 rounded-full bg-felt-dark text-xl font-bold hover:bg-black/40 transition"
              >−</button>
              <span className="text-5xl font-bold font-mono w-16 text-center">{bid}</span>
              <button
                onClick={() => setBid(b => Math.min(maxBid, b + 1))}
                className="w-10 h-10 rounded-full bg-felt-dark text-xl font-bold hover:bg-black/40 transition"
              >+</button>
            </div>
            <button
              onClick={() => onSubmitBid(roomCode, bid)}
              className="w-full py-3 rounded-xl bg-yellow-400 text-black font-bold text-lg hover:bg-yellow-300 transition"
            >
              Bid {bid}
            </button>
          </>
        ) : (
          <p className="text-center text-gray-400">
            {alreadyBid ? `You bid ${me.bid} — waiting for others…` : 'Waiting for your turn…'}
          </p>
        )}
      </div>
    </div>
  );
}
