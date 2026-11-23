// Card definitions, deck construction and the seeded shuffle for VAULTBREAKERS.
// One job only: what a card IS and how a fresh deck is built. No rules live here.
export const SUITS = {
  CUT: { key: 'CUT', name: 'CUT', icon: '◆', color: '#e5484d', dark: '#8f1d22', blurb: 'Damage' },
  LOCK: { key: 'LOCK', name: 'LOCK', icon: '■', color: '#3b82f6', dark: '#1d4ed8', blurb: 'Block' },
  COIN: { key: 'COIN', name: 'COIN', icon: '●', color: '#f5b301', dark: '#92690a', blurb: 'Gold + Draw' },
  WIRE: { key: 'WIRE', name: 'WIRE', icon: '⚡', color: '#a855f7', dark: '#6b21a8', blurb: 'Sabotage' },
};

// cost / value, in the brief's own numbers. value means damage, block, gold or
// sabotage strength depending on the suit; effect text spells it out on the card.
export const CARD_DEFS = [
  { id: 'crowbar', name: 'Crowbar', suit: 'CUT', cost: 1, value: 5, text: 'Deal 5 damage.' },
  { id: 'prybar', name: 'Pry Bar', suit: 'CUT', cost: 1, value: 4, text: 'Deal 4 damage.' },
  { id: 'drill', name: 'Drill', suit: 'CUT', cost: 2, value: 9, text: 'Deal 9 damage.' },
  { id: 'sledge', name: 'Sledge', suit: 'CUT', cost: 2, value: 8, text: 'Deal 8 damage.' },
  { id: 'thermite', name: 'Thermite', suit: 'CUT', cost: 3, value: 14, text: 'Deal 14 damage.' },
  { id: 'breach', name: 'Breach Charge', suit: 'CUT', cost: 3, value: 13, text: 'Deal 13 damage.' },
  { id: 'safedoor', name: 'Safe Door', suit: 'LOCK', cost: 1, value: 6, text: 'Gain 6 block.' },
  { id: 'deadbolt', name: 'Deadbolt', suit: 'LOCK', cost: 1, value: 5, text: 'Gain 5 block.' },
  { id: 'reinforced', name: 'Reinforced', suit: 'LOCK', cost: 1, value: 7, text: 'Gain 7 block.' },
  { id: 'riotshield', name: 'Riot Shield', suit: 'LOCK', cost: 2, value: 10, text: 'Gain 10 block.' },
  { id: 'barricade', name: 'Barricade', suit: 'LOCK', cost: 2, value: 9, text: 'Gain 9 block.' },
  { id: 'vaultseal', name: 'Vault Seal', suit: 'LOCK', cost: 3, value: 15, text: 'Gain 15 block.' },
  { id: 'goldbar', name: 'Gold Bar', suit: 'COIN', cost: 1, value: 4, text: '+4 gold.' },
  { id: 'tipoff', name: 'Tip-Off', suit: 'COIN', cost: 1, value: 2, text: 'Draw 1 card. +2 gold.' },
  { id: 'insidejob', name: 'Inside Job', suit: 'COIN', cost: 1, value: 2, text: 'Draw 2 cards.' },
  { id: 'fenceit', name: 'Fence It', suit: 'COIN', cost: 2, value: 8, text: '+8 gold.' },
  { id: 'payoff', name: 'Payoff', suit: 'COIN', cost: 2, value: 6, text: '+6 gold. Draw 1 card.' },
  { id: 'stash', name: 'Stash', suit: 'COIN', cost: 3, value: 12, text: '+12 gold.' },
  { id: 'cutlines', name: 'Cut Lines', suit: 'WIRE', cost: 1, value: 1, text: 'Rival −1 energy next turn.' },
  { id: 'jammer', name: 'Jammer', suit: 'WIRE', cost: 1, value: 1, text: 'Rival discards 1 card.' },
  { id: 'blackout', name: 'Blackout', suit: 'WIRE', cost: 2, value: 2, text: 'Rival −2 energy next turn.' },
  { id: 'bugplant', name: 'Bug Plant', suit: 'WIRE', cost: 2, value: 3, text: 'Rival takes 3 at its turn start.' },
  { id: 'shortcircuit', name: 'Short Circuit', suit: 'WIRE', cost: 2, value: 4, text: 'Rival block → 0, then 4 damage.' },
  { id: 'static', name: 'Static', suit: 'WIRE', cost: 3, value: 2, text: 'Rival discards 2 cards.' },
];

export const DECK_SIZE = 24;
export const HAND_SIZE = 5;
export const ENERGY_PER_TURN = 3;
export const MAX_HP = 30;

/** mulberry32 — small, deterministic, seedable. The same seed always deals the same deck. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates over a copy, driven by the seeded rng. */
export function seededShuffle(deck, rng) {
  const shuffled = deck.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled;
}

/** A fresh 24-card deck: one copy of every definition, shuffled by seed. */
export function buildDeck(seed) {
  const rng = createRng(seed);
  return seededShuffle(CARD_DEFS.map((def) => ({ ...def, uid: def.id })), rng);
}

/** A one-off card instance (same def, unique uid) for draws that need a fresh copy. */
export function makeCard(def, uid) {
  return { ...def, uid };
}

export function suitOf(card) {
  return SUITS[card.suit];
}
