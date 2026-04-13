import React from 'react';

const Section = ({ title, children }) => (
  <div className="mb-5">
    <h3 className="text-yellow-300 font-bold text-base mb-2 border-b border-white/10 pb-1">{title}</h3>
    {children}
  </div>
);

const Rule = ({ children }) => (
  <li className="text-gray-300 text-sm leading-relaxed mb-1 flex gap-2">
    <span className="text-yellow-500 mt-0.5 shrink-0">♠</span>
    <span>{children}</span>
  </li>
);

export default function RulesModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-felt rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-felt flex items-center justify-between px-6 py-4 border-b border-white/10 z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">♠</span>
            <h2 className="text-xl font-bold">Spades — Rules</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none transition">×</button>
        </div>

        <div className="px-6 py-5">

          <Section title="The Basics">
            <ul className="space-y-1">
              <Rule>Standard 52-card deck. <strong className="text-white">Spades are always trump</strong> — they beat every other suit.</Rule>
              <Rule>Cards rank <strong className="text-white">Ace (high)</strong> down to <strong className="text-white">2 (low)</strong> within each suit.</Rule>
              <Rule>2–8 players. If 2 or 3 players are in the game, each player receives <strong className="text-white">7 cards</strong>. With 4–8 players, cards are dealt as evenly as possible — any leftovers stay undealt.</Rule>
            </ul>
          </Section>

          <Section title="Bidding">
            <ul className="space-y-1">
              <Rule>Before play begins, every player bids how many tricks they expect to win.</Rule>
              <Rule>Minimum bid is <strong className="text-white">1</strong>. You can only bid up to the number of cards in your hand.</Rule>
              <Rule>Bidding starts with the player to the left of the dealer and goes clockwise.</Rule>
              <Rule>You can see your full hand before placing your bid.</Rule>
            </ul>
          </Section>

          <Section title="Playing a Trick">
            <ul className="space-y-1">
              <Rule>The player to the left of the dealer leads the first trick.</Rule>
              <Rule><strong className="text-white">Follow suit:</strong> if you have cards in the led suit, you must play one of them.</Rule>
              <Rule>If you have no cards in the led suit, you may play <strong className="text-white">any card</strong> — including a spade (which will trump the trick) or a discard.</Rule>
              <Rule><strong className="text-white">Breaking spades:</strong> spades cannot be led until a spade has been played on a previous trick (<em>spades are broken</em>), unless your entire hand consists only of spades.</Rule>
              <Rule>The highest card of the led suit wins the trick — unless one or more spades were played, in which case the highest spade wins.</Rule>
              <Rule>The winner of each trick leads the next one.</Rule>
            </ul>
          </Section>

          <Section title="Scoring">
            <ul className="space-y-1">
              <Rule>Each trick you win is worth <strong className="text-white">+10 pts</strong>.</Rule>
              <Rule>Each trick you fall <strong className="text-white">short</strong> of your bid costs <strong className="text-red-400">−10 pts</strong> per missing trick.</Rule>
              <Rule>Each trick you win <strong className="text-white">beyond</strong> your bid (a bag) costs <strong className="text-red-400">−20 pts</strong> — overbidding is punished harder than underbidding.</Rule>
              <Rule>Scores can go negative if you miss badly.</Rule>
              <Rule>
                <span className="font-mono text-xs leading-loose">
                  Bid 4, win 4 → <span className="text-green-400">+40</span> &nbsp;·&nbsp;
                  Bid 4, win 3 → <span className="text-yellow-300">+20</span> &nbsp;·&nbsp;
                  Bid 4, win 5 → <span className="text-yellow-300">+30</span> &nbsp;·&nbsp;
                  Bid 4, win 6 → <span className="text-yellow-300">+20</span> &nbsp;·&nbsp;
                  Bid 4, win 0 → <span className="text-red-400">−40</span>
                </span>
              </Rule>
            </ul>
          </Section>

          <Section title="Nil Bid">
            <ul className="space-y-1">
              <Rule>You may bid <strong className="text-purple-300">NIL</strong> — a declaration that you will win <strong className="text-white">zero tricks</strong> this hand.</Rule>
              <Rule>Succeed (win 0 tricks) → <strong className="text-green-400">+50 pts</strong>.</Rule>
              <Rule>Fail (win 1 or more tricks) → <strong className="text-red-400">−50 pts</strong>.</Rule>
              <Rule>High risk, high reward — useful when you have a weak hand or want to catch up quickly.</Rule>
            </ul>
          </Section>

          <Section title="Winning the Game">
            <ul className="space-y-1">
              <Rule>The first player to reach <strong className="text-white">200 points</strong> wins.</Rule>
              <Rule>If two or more players hit 200 in the same round, they all play one more round to break the tie.</Rule>
            </ul>
          </Section>

          <Section title="Play Again">
            <ul className="space-y-1">
              <Rule>After a game ends, players can vote to play again. The host starts the new game once at least 2 players are ready.</Rule>
              <Rule>Players who leave are removed. New players can join using the same room code.</Rule>
              <Rule>Scores reset to 0 for each new game. Up to 8 players per room.</Rule>
            </ul>
          </Section>

        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
