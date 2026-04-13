// Client-side helpers — mirrors server logic for UI feedback only.
// The server is always authoritative.

const RANK_VALUE = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
  '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
};

/**
 * Returns true if the card can legally be played given current state.
 */
export function isCardPlayable(card, hand, leadSuit, spadesBroken, isMyTurn) {
  if (!isMyTurn) return false;

  if (leadSuit) {
    const hasSuit = hand.some(c => c.suit === leadSuit);
    if (hasSuit) return card.suit === leadSuit;
    return true; // can play anything if void in lead suit
  }

  // Leading the trick
  if (card.suit === 'SPADES') {
    const hasOnlySpades = hand.every(c => c.suit === 'SPADES');
    return spadesBroken || hasOnlySpades;
  }

  return true;
}

/**
 * Sort hand: group by suit (S last), then by rank ascending within suit.
 */
export function sortHand(hand) {
  const suitOrder = { CLUBS: 0, DIAMONDS: 1, HEARTS: 2, SPADES: 3 };
  return [...hand].sort((a, b) => {
    const sd = suitOrder[a.suit] - suitOrder[b.suit];
    if (sd !== 0) return sd;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
}

/**
 * Return the image URL for a card from deckofcardsapi.com.
 * RANK mapping: 10 -> 0, J -> J, Q -> Q, K -> K, A -> A, 2-9 -> digit
 * SUIT mapping: SPADES->S, HEARTS->H, DIAMONDS->D, CLUBS->C
 */
export function cardImageUrl(card) {
  if (!card || card.hidden) return 'https://deckofcardsapi.com/static/img/back.png';
  const rankMap = { '10': '0', J: 'J', Q: 'Q', K: 'K', A: 'A' };
  const rank = rankMap[card.rank] ?? card.rank;
  const suitMap = { SPADES: 'S', HEARTS: 'H', DIAMONDS: 'D', CLUBS: 'C' };
  const suit = suitMap[card.suit];
  return `https://deckofcardsapi.com/static/img/${rank}${suit}.png`;
}

export function suitSymbol(suit) {
  return { SPADES: '♠', HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣' }[suit] ?? suit;
}

export function suitColor(suit) {
  return suit === 'HEARTS' || suit === 'DIAMONDS' ? 'text-red-500' : 'text-white';
}

export function getGullyCardsForRound(roundNumber, numPlayers) {
  const maxCards = Math.floor(52 / numPlayers);
  return roundNumber <= maxCards ? roundNumber : 2 * maxCards - roundNumber;
}

export function getGullyTotalRounds(numPlayers) {
  return 2 * Math.floor(52 / numPlayers) - 1;
}

export function getInvalidGullyBids(submittedBids, numPlayers, handSize) {
  const previousSum = submittedBids.reduce((a, b) => a + b, 0);
  const invalid = [];
  for (let b = 0; b <= handSize; b++) {
    if ((previousSum + b) % numPlayers === 0) invalid.push(b);
  }
  return invalid;
}

export function calculateGullyScore(bid, tricksWon) {
  return bid === tricksWon ? bid * 11 + 10 : 0;
}
