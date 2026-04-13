// Pure game logic functions — no I/O, no side effects

const SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const RANK_VALUE = {};
RANKS.forEach((r, i) => { RANK_VALUE[r] = i; });

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealCards(numPlayers) {
  const deck = createDeck();
  // 2-3 players: 7 cards each (short-hand rule)
  // 4+ players:  deal evenly, remainder stays undealt
  const cardsPerPlayer = numPlayers <= 3 ? 7 : Math.floor(deck.length / numPlayers);
  const hands = [];
  for (let i = 0; i < numPlayers; i++) {
    hands.push(deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
  }
  return hands;
}

/**
 * validatePlay — checks whether playing `card` is legal.
 * Returns { valid: boolean, reason: string|null }
 */
function validatePlay(card, hand, leadSuit, spadesBroken) {
  // Card must be in the player's hand
  const inHand = hand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!inHand) return { valid: false, reason: 'Card not in hand' };

  // If there is a lead suit, player must follow suit if able
  if (leadSuit) {
    const hasSuit = hand.some(c => c.suit === leadSuit);
    if (hasSuit && card.suit !== leadSuit) {
      return { valid: false, reason: `Must follow suit (${leadSuit})` };
    }
    return { valid: true, reason: null };
  }

  // Player is leading
  if (card.suit === 'SPADES') {
    const hasOnlySpades = hand.every(c => c.suit === 'SPADES');
    if (!spadesBroken && !hasOnlySpades) {
      return { valid: false, reason: 'Spades not yet broken' };
    }
  }

  return { valid: true, reason: null };
}

/**
 * determineTrickWinner — given an array of { playerId, card },
 * returns the playerId of the winner.
 */
function determineTrickWinner(trick) {
  if (!trick || trick.length === 0) return null;

  const leadSuit = trick[0].card.suit;
  let winner = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const current = trick[i];
    const w = winner.card;
    const c = current.card;

    const wIsSpade = w.suit === 'SPADES';
    const cIsSpade = c.suit === 'SPADES';

    if (cIsSpade && !wIsSpade) {
      // Spade beats non-spade
      winner = current;
    } else if (cIsSpade && wIsSpade) {
      // Both spades — higher rank wins
      if (RANK_VALUE[c.rank] > RANK_VALUE[w.rank]) winner = current;
    } else if (c.suit === leadSuit && w.suit !== 'SPADES') {
      // Current follows lead, winner didn't play spade — compare
      if (RANK_VALUE[c.rank] > RANK_VALUE[w.rank]) winner = current;
    }
    // Otherwise current card loses
  }

  return winner.playerId;
}

/**
 * calculateScore — scoring rules:
 *
 *   NIL bid (bid === 0):
 *     win 0 tricks → +50 pts
 *     win ≥ 1 trick → −50 pts
 *
 *   Normal bid (bid ≥ 1):
 *     +10 pts per trick won
 *     −10 pts per undertrick (each trick short of bid)
 *     −20 pts per overtrick / bag (each trick won beyond bid)
 *
 * Examples (normal):
 *   bid 4, win 4 →  40 pts
 *   bid 4, win 3 →  20 pts  (30 − 1×10)
 *   bid 4, win 5 →  30 pts  (50 − 1×20)
 *   bid 4, win 6 →  20 pts  (60 − 2×20)
 */
function calculateScore(bid, tricksWon) {
  // Nil bid
  if (bid === 0) {
    return tricksWon === 0 ? 50 : -50;
  }
  const base = tricksWon * 10;
  if (tricksWon < bid) {
    return base - (bid - tricksWon) * 10;   // undertricks: −10 each
  } else {
    return base - (tricksWon - bid) * 20;   // bags: −20 each
  }
}

/**
 * isSpadesBroken — returns true if any spade has been played in trickHistory.
 * trickHistory is an array of completed tricks, each being an array of { playerId, card }.
 */
function isSpadesBroken(trickHistory) {
  for (const trick of trickHistory) {
    for (const play of trick) {
      if (play.card.suit === 'SPADES') return true;
    }
  }
  return false;
}

// ─── Bot helpers ─────────────────────────────────────────────────────────────

/**
 * botBid — estimate how many tricks a hand is likely to win.
 * Counts high cards and strong spades.
 */
function botBid(hand) {
  let estimate = 0;
  for (const card of hand) {
    if (card.rank === 'A') estimate += 1;
    else if (card.rank === 'K') estimate += 0.75;
    else if (card.rank === 'Q') estimate += 0.4;
    else if (card.suit === 'SPADES' && RANK_VALUE[card.rank] >= RANK_VALUE['9']) estimate += 0.35;
  }
  return Math.max(1, Math.round(estimate)); // never bid Nil as a bot
}

/**
 * botPlayCard — pick the best legal card to play conservatively.
 * Tries to follow suit with the lowest legal card; avoids wasting high cards.
 */
function botPlayCard(hand, leadSuit, spadesBroken) {
  // Get all valid cards
  const valid = hand.filter(c => validatePlay(c, hand, leadSuit, spadesBroken).valid);
  if (valid.length === 0) return hand[0]; // fallback (shouldn't happen)

  // Sort: prefer non-spades, then lowest rank
  const sorted = [...valid].sort((a, b) => {
    const aSpade = a.suit === 'SPADES' ? 1 : 0;
    const bSpade = b.suit === 'SPADES' ? 1 : 0;
    if (aSpade !== bSpade) return aSpade - bSpade;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });

  return sorted[0];
}

module.exports = {
  createDeck,
  dealCards,
  validatePlay,
  determineTrickWinner,
  calculateScore,
  isSpadesBroken,
  botBid,
  botPlayCard,
  SUITS,
  RANKS,
  RANK_VALUE,
};
