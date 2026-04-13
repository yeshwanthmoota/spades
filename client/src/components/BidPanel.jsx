import React from 'react';
import { cardImageUrl, sortHand } from '../utils/gameRules';

export default function BidPanel({ gameState, mySocketId, roomCode, onSubmitBid }) {
  const me = gameState?.players?.find(p => p.socketId === mySocketId);
  const isMyTurn = gameState?.currentTurn === mySocketId;
  const alreadyBid = me?.bid !== null && me?.bid !== undefined;
  const hand = sortHand(me?.hand?.filter(c => !c.hidden) ?? []);
  const handSize = hand.length;

  if (!gameState || gameState.status !== 'bidding') return null;

  // Build bid options: 1 up to handSize only (can't win more tricks than cards held)
  const bidOptions = Array.from({ length: handSize }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center pb-2 pt-1 w-full px-2">

      {/* Cards — always visible so the player can study their hand before bidding */}
      <div className="flex flex-wrap justify-center gap-1 mb-3">
        {hand.map((card, i) => (
          <img
            key={`${card.suit}-${card.rank}-${i}`}
            src={cardImageUrl(card)}
            alt={`${card.rank} of ${card.suit}`}
            className="w-14 h-auto rounded-md card-shadow"
          />
        ))}
      </div>

      {/* Bid panel */}
      <div className="bg-felt rounded-2xl px-4 py-3 w-full max-w-md border border-white/5 shadow-2xl">

        {/* Header + other players' bids */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold">
            {isMyTurn && !alreadyBid ? 'Bid on number of tricks:' : 'Bidding in progress'}
          </h2>
          <div className="flex gap-3 flex-wrap">
            {gameState.players.map(p => (
              <div key={p.socketId} className="flex flex-col items-center text-xs">
                <span className={`font-semibold truncate max-w-[56px] ${p.socketId === mySocketId ? 'text-yellow-300' : 'text-gray-300'}`}>
                  {p.name}
                </span>
                <span className="font-mono mt-0.5">
                  {p.bid !== null && p.bid !== undefined
                    ? <span className="text-green-400 font-bold">{p.bid}</span>
                    : gameState.currentTurn === p.socketId
                      ? <span className="text-yellow-300 animate-pulse">…</span>
                      : <span className="text-gray-600">—</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bid number grid — only shown when it's your turn */}
        {isMyTurn && !alreadyBid ? (
          <div className="grid grid-cols-5 gap-2">
            {bidOptions.map(n => (
              <button
                key={n}
                onClick={() => onSubmitBid(roomCode, n)}
                className="
                  py-3 rounded-xl font-bold text-lg
                  bg-felt-dark border border-white/10
                  hover:bg-yellow-400 hover:text-black hover:border-yellow-400
                  active:scale-95 transition-all duration-100
                "
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-1">
            {alreadyBid
              ? `You bid ${me.bid} — waiting for others…`
              : 'Waiting for your turn to bid…'}
          </p>
        )}
      </div>
    </div>
  );
}
