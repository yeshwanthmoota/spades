import React, { useState } from 'react';
import { cardImageUrl, isCardPlayable, sortHand } from '../utils/gameRules';

export default function PlayerHand({ hand, isMyTurn, leadSuit, spadesBroken, roomCode, onPlayCard }) {
  const [selected, setSelected] = useState(null);

  const sorted = sortHand(hand ?? []);

  function handleSelect(card) {
    if (!isMyTurn) return;
    const playable = isCardPlayable(card, hand, leadSuit, spadesBroken, isMyTurn);
    if (!playable) return;
    setSelected(prev =>
      prev && prev.suit === card.suit && prev.rank === card.rank ? null : card
    );
  }

  function handlePlay() {
    if (!selected) return;
    onPlayCard(roomCode, selected);
    setSelected(null);
  }

  return (
    <div className="flex flex-col items-center gap-3 pb-2">
      {/* Cards row */}
      <div className="flex flex-wrap justify-center gap-1">
        {sorted.map((card, i) => {
          const playable = isCardPlayable(card, hand, leadSuit, spadesBroken, isMyTurn);
          const isSelected = selected?.suit === card.suit && selected?.rank === card.rank;
          return (
            <button
              key={`${card.suit}-${card.rank}-${i}`}
              onClick={() => handleSelect(card)}
              disabled={!playable}
              className={`
                relative transition-all duration-150 rounded-md
                ${isSelected ? '-translate-y-4' : 'hover:-translate-y-1'}
                ${!playable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={playable ? `Play ${card.rank} of ${card.suit}` : 'Cannot play this card'}
            >
              <img
                src={cardImageUrl(card)}
                alt={`${card.rank} of ${card.suit}`}
                className={`w-14 h-auto rounded-md card-shadow ${isSelected ? 'ring-2 ring-yellow-400' : ''}`}
              />
            </button>
          );
        })}
      </div>

      {/* Play button */}
      {isMyTurn && (
        <button
          onClick={handlePlay}
          disabled={!selected}
          className="px-8 py-2 rounded-xl bg-yellow-400 text-black font-bold hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {selected ? `Play ${selected.rank} ♠♥♦♣`.split('♠♥♦♣')[0] + suitSymbol(selected.suit) : 'Select a card'}
        </button>
      )}
      {!isMyTurn && <p className="text-gray-500 text-sm">Waiting for your turn…</p>}
    </div>
  );
}

function suitSymbol(suit) {
  return { SPADES: '♠', HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣' }[suit] ?? '';
}
