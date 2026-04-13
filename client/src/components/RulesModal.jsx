import React, { useState } from 'react';

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

const GullyRule = ({ children }) => (
  <li className="text-gray-300 text-sm leading-relaxed mb-1 flex gap-2">
    <span className="text-orange-400 mt-0.5 shrink-0">🃏</span>
    <span>{children}</span>
  </li>
);

export default function RulesModal({ onClose }) {
  const [tab, setTab] = useState('traditional');

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

        {/* Tab switcher */}
        <div className="flex gap-2 px-6 pt-4 pb-0">
          <button
            onClick={() => setTab('traditional')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm border transition
              ${tab === 'traditional'
                ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                : 'bg-felt-dark border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-300'}`}>
            ♠ Traditional
          </button>
          <button
            onClick={() => setTab('gully')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm border transition
              ${tab === 'gully'
                ? 'bg-orange-500/20 border-orange-400 text-orange-300'
                : 'bg-felt-dark border-gray-600 text-gray-400 hover:border-orange-400 hover:text-orange-300'}`}>
            🃏 Gully Spades
          </button>
        </div>

        {tab === 'traditional' && (
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
        )}

        {tab === 'gully' && (
          <div className="px-6 py-5">

            <Section title="What is Gully Spades?">
              <ul className="space-y-1">
                <GullyRule>A fast-paced variant where the number of cards dealt <strong className="text-white">changes every round</strong> in a pyramid pattern.</GullyRule>
                <GullyRule>Same trick-taking rules as Traditional Spades — Spades are always trump, follow suit if able.</GullyRule>
                <GullyRule>The key difference is in how rounds are structured and how bids are scored.</GullyRule>
              </ul>
            </Section>

            <Section title="Round Structure">
              <ul className="space-y-1">
                <GullyRule><strong className="text-white">Ascending phase:</strong> Round 1 deals 1 card each, Round 2 deals 2 cards each, and so on up to the maximum.</GullyRule>
                <GullyRule><strong className="text-white">Descending phase:</strong> After the peak, rounds go back down to 1 card.</GullyRule>
                <GullyRule>Maximum cards = floor(52 ÷ number of players). E.g., 4 players → 13 cards max → 25 total rounds (1→13→1).</GullyRule>
                <GullyRule>Total rounds = (2 × max cards) − 1.</GullyRule>
              </ul>
            </Section>

            <Section title="Bidding Rules">
              <ul className="space-y-1">
                <GullyRule>Each player bids <strong className="text-white">0 to hand size</strong> (no Nil concept — 0 is just a regular bid).</GullyRule>
                <GullyRule><strong className="text-orange-300">Key constraint:</strong> the running sum of all bids must NOT be divisible by the number of players at any point.</GullyRule>
                <GullyRule>If a bid would make the running sum divisible by the player count, that bid is <strong className="text-red-400">blocked</strong> — you must choose a different number.</GullyRule>
                <GullyRule>Invalid bids are highlighted in the bid panel so you can see which choices are allowed.</GullyRule>
                <GullyRule>This rule ensures someone is always under-bidding or over-bidding — keeping the game tense.</GullyRule>
              </ul>
            </Section>

            <Section title="Scoring">
              <ul className="space-y-1">
                <GullyRule><strong className="text-white">Exact bid:</strong> score = (bid × 11) + 10 points.</GullyRule>
                <GullyRule><strong className="text-red-400">Any miss</strong> (won more or fewer tricks than bid): <strong className="text-red-400">0 points</strong>.</GullyRule>
                <GullyRule>There are no partial points or penalties — it's all-or-nothing each round.</GullyRule>
                <GullyRule>
                  <span className="font-mono text-xs leading-loose">
                    Bid 0, win 0 → <span className="text-green-400">+10</span> &nbsp;·&nbsp;
                    Bid 1, win 1 → <span className="text-green-400">+21</span> &nbsp;·&nbsp;
                    Bid 2, win 2 → <span className="text-green-400">+32</span> &nbsp;·&nbsp;
                    Bid 3, win 2 → <span className="text-red-400">0</span>
                  </span>
                </GullyRule>
              </ul>
            </Section>

            <Section title="Winning the Game">
              <ul className="space-y-1">
                <GullyRule><strong className="text-white">Default:</strong> play all rounds, then the player with the highest score wins.</GullyRule>
                <GullyRule><strong className="text-white">Optional:</strong> the host can set a target of 100 or 200 pts — the game ends early after the round where someone first reaches that score.</GullyRule>
                <GullyRule>When all rounds finish (or the target is hit), the player with the most points wins outright — no tie-breaking extra rounds.</GullyRule>
              </ul>
            </Section>

            <Section title="Play Again">
              <ul className="space-y-1">
                <GullyRule>After the game ends, the host can start a rematch. Scores reset and the pyramid starts over from Round 1.</GullyRule>
                <GullyRule>New players can join using the same room code before the rematch begins.</GullyRule>
              </ul>
            </Section>

          </div>
        )}

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
