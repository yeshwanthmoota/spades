import React from 'react';
import { cardImageUrl, sortHand, getInvalidGullyBids } from '../utils/gameRules';

export default function BidPanel({ gameState, mySocketId, roomCode, onSubmitBid }) {
  const me = gameState?.players?.find(p => p.socketId === mySocketId);
  const isMyTurn = gameState?.currentTurn === mySocketId;
  const alreadyBid = me?.bid !== null && me?.bid !== undefined;
  const hand = sortHand(me?.hand?.filter(c => !c.hidden) ?? []);
  const handSize = hand.length;
  const isGully = gameState?.gameMode === 'gully';

  if (!gameState || gameState.status !== 'bidding') return null;

  // For Gully: the hook rule applies only to the last bidder.
  // All others bid freely; the last bidder may not bid the one value that
  // would make the total sum equal the number of cards dealt this round.
  const submittedBids = isGully
    ? gameState.players.filter(p => p.bid !== null && p.bid !== undefined).map(p => p.bid)
    : [];
  const isLastGullyBidder = isGully && submittedBids.length === gameState.players.length - 1;
  const invalidBids = isGully ? getInvalidGullyBids(submittedBids, gameState.players.length, handSize) : [];

  const bidOptions = [0, ...Array.from({ length: handSize }, (_, i) => i + 1)];

  return (
    <div className="flex flex-col items-center pb-2 pt-1 w-full px-2">
      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-1 mb-3">
        {hand.map((card, i) => (
          <img key={`${card.suit}-${card.rank}-${i}`} src={cardImageUrl(card)}
            alt={`${card.rank} of ${card.suit}`} className="w-14 h-auto rounded-md card-shadow" />
        ))}
      </div>

      <div className="bg-felt rounded-2xl px-4 py-3 w-full max-w-md border border-white/5 shadow-2xl">
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

        {isMyTurn && !alreadyBid ? (
          <>
            {isLastGullyBidder && invalidBids.length > 0 && (
              <p className="text-xs text-orange-300 mb-2 text-center">
                You're last to bid — cannot bid <span className="font-bold text-orange-200">{invalidBids[0]}</span> (would make total equal tricks available)
              </p>
            )}
            <div className="grid grid-cols-5 gap-2">
              {bidOptions.map(n => {
                const isInvalid = isGully && invalidBids.includes(n);
                return (
                  <button key={n} onClick={() => !isInvalid && onSubmitBid(roomCode, n)}
                    disabled={isInvalid}
                    title={isInvalid ? `Bid ${n} not allowed — total would equal the ${handSize} tricks available` : undefined}
                    className={`py-3 rounded-xl font-bold text-lg border active:scale-95 transition-all duration-100
                      ${isInvalid
                        ? 'bg-gray-800/40 border-gray-700 text-gray-600 cursor-not-allowed opacity-40'
                        : !isGully && n === 0
                          ? 'bg-purple-900/60 border-purple-500 text-purple-300 hover:bg-purple-600 hover:text-white hover:border-purple-400'
                          : 'bg-felt-dark border-white/10 hover:bg-yellow-400 hover:text-black hover:border-yellow-400'
                      }`}>
                    {!isGully && n === 0 ? 'NIL' : n}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-center text-gray-400 text-sm py-1">
            {alreadyBid ? `You bid ${me.bid} — waiting for others…` : 'Waiting for your turn to bid…'}
          </p>
        )}
      </div>
    </div>
  );
}
