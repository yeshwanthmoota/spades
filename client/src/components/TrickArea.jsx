import React from 'react';
import { cardImageUrl } from '../utils/gameRules';

export default function TrickArea({ currentTrick, players, spadesBroken }) {
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* Spades broken indicator */}
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full font-semibold transition-all ${spadesBroken ? 'bg-purple-700 text-purple-200' : 'bg-gray-800 text-gray-500'}`}>
        ♠ {spadesBroken ? 'Broken' : 'Not broken'}
      </div>

      {/* Cards in the center */}
      <div className="flex flex-wrap gap-2 justify-center items-center max-w-xs">
        {currentTrick && currentTrick.length > 0 ? (
          currentTrick.map(({ playerId, card }, i) => {
            const player = players?.find(p => p.socketId === playerId);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <img
                  src={cardImageUrl(card)}
                  alt={`${card.rank} of ${card.suit}`}
                  className="w-14 h-auto rounded-md card-shadow"
                />
                <span className="text-xs text-gray-300 truncate max-w-[3.5rem]">
                  {player?.name ?? '?'}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-gray-600 text-sm">No cards played yet</p>
        )}
      </div>
    </div>
  );
}
