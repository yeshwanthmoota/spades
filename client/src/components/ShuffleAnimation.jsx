import React, { useEffect, useState } from 'react';

const BACK = 'https://deckofcardsapi.com/static/img/back.png';

// Each card flies to a different screen corner/edge representing a player seat
const TRAJECTORIES = [
  { label: 'bottom', style: 'translate(0px, 260px)' },
  { label: 'top',    style: 'translate(0px, -260px)' },
  { label: 'left',   style: 'translate(-320px, 0px)' },
  { label: 'right',  style: 'translate(320px, 0px)' },
  { label: 'top-l',  style: 'translate(-220px, -200px)' },
  { label: 'top-r',  style: 'translate(220px, -200px)' },
];

export default function ShuffleAnimation({ numPlayers = 4, onDone }) {
  // Phase: 'shuffle' → 'deal' → 'done'
  const [phase, setPhase] = useState('shuffle');
  const [dealtCards, setDealtCards] = useState([]);

  // How many cards to animate (one per player)
  const seats = TRAJECTORIES.slice(0, numPlayers);

  useEffect(() => {
    // Brief shuffle wobble, then start dealing
    const t1 = setTimeout(() => setPhase('deal'), 600);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== 'deal') return;

    // Stagger cards flying out
    seats.forEach((_, i) => {
      setTimeout(() => {
        setDealtCards(prev => [...prev, i]);
      }, i * 120);
    });

    // After all cards have flown, signal parent
    const total = 600 + seats.length * 120 + 400;
    const t2 = setTimeout(() => {
      setPhase('done');
      onDone?.();
    }, total);

    return () => clearTimeout(t2);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-felt-dark/80 backdrop-blur-sm pointer-events-none">
      {/* Deck stack */}
      <div className={`relative transition-transform duration-300 ${phase === 'shuffle' ? 'animate-shuffle-deck' : ''}`}>
        {/* Stack of backs */}
        {[4, 3, 2, 1, 0].map(offset => (
          <img
            key={offset}
            src={BACK}
            alt="deck"
            className="absolute w-20 h-auto rounded-lg"
            style={{
              top:    `-${offset * 1.5}px`,
              left:   `-${offset * 1}px`,
              zIndex: offset,
              opacity: 1,
            }}
          />
        ))}

        {/* Flying cards */}
        {seats.map((seat, i) => (
          <img
            key={seat.label}
            src={BACK}
            alt="dealt card"
            className="absolute w-20 h-auto rounded-lg card-shadow"
            style={{
              top: 0, left: 0,
              zIndex: 10 + i,
              transition: `transform 0.45s cubic-bezier(0.25,0.8,0.25,1) ${i * 0.01}s, opacity 0.45s ease ${i * 0.01}s`,
              transform: dealtCards.includes(i) ? seat.style : 'translate(0,0)',
              opacity:   dealtCards.includes(i) ? 0 : 1,
            }}
          />
        ))}
      </div>

      <p className="absolute bottom-24 text-gray-400 text-sm animate-pulse">Dealing cards…</p>
    </div>
  );
}
