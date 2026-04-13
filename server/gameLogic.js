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
 * calculateScore — 10 pts per bid + 1 pt per overtrick, or 0 if failed.
 * Returns the points earned THIS HAND (not cumulative).
 */
function calculateScore(bid, tricksWon) {
  if (bid === 0) return 0; // shouldn't happen since min bid is 1, but guard
  if (tricksWon < bid) return 0;
  return bid * 10 + (tricksWon - bid);
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

module.exports = {
  createDeck,
  dealCards,
  validatePlay,
  determineTrickWinner,
  calculateScore,
  isSpadesBroken,
  SUITS,
  RANKS,
  RANK_VALUE,
};
