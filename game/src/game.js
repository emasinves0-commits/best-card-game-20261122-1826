// The rules engine: turns, energy, SUIT SURGE, damage / block / gold, win and loss.
// This module owns the game state and nothing else — no DOM, no network, no sound.
import {
  buildDeck, createRng, seededShuffle, ENERGY_PER_TURN, HAND_SIZE, MAX_HP,
} from './cards.js';
import {
  loadStreakRecord, streakStartBonus, applyStreakWin, applyStreakLoss,
} from './streak.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_WIN = 'win';
export const PHASE_LOSS = 'loss';

// What a surge does, per suit. The label is what the banner and the log show.
export const SURGE_EFFECTS = {
  CUT: { label: 'CUT SURGE +3 damage', detail: '+3 damage' },
  LOCK: { label: 'LOCK SURGE +4 block', detail: '+4 block' },
  COIN: { label: 'COIN SURGE +3 gold, draw 1', detail: '+3 gold, draw 1' },
  WIRE: { label: 'WIRE SURGE rival discards 1', detail: 'rival discards 1' },
};

// How a COIN card pays out, keyed by card id. Each handler gets (game, side).
const COIN_PLAYS = {
  goldbar: (game, side) => gainGold(game, side, 4),
  tipoff: (game, side) => { drawCards(game, side, 1); gainGold(game, side, 2); },
  insidejob: (game, side) => drawCards(game, side, 2),
  fenceit: (game, side) => gainGold(game, side, 8),
  payoff: (game, side) => { gainGold(game, side, 6); drawCards(game, side, 1); },
  stash: (game, side) => gainGold(game, side, 12),
};

// How a WIRE card sabotages, keyed by card id. Each handler gets
// (game, actor, foe, card) and returns the log fragment after the actor's name.
const WIRE_PLAYS = {
  cutlines: (game, actor, foe) => { foe.energyDebt += 1; return 'cut lines: rival −1 energy.'; },
  jammer: (game, actor, foe) => { dropCards(game, foe, 1); return 'jammed: rival discards 1.'; },
  blackout: (game, actor, foe) => { foe.energyDebt += 2; return 'blackout: rival −2 energy.'; },
  bugplant: (game, actor, foe, card) => { foe.dot += card.value; return 'planted a bug (3/turn).'; },
  shortcircuit: (game, actor, foe, card) => {
    foe.block = 0;
    const dealt = dealDamage(game, foe, card.value);
    if (actor === 'player') game.stats.damageDealt += dealt;
    return `short-circuited: block wiped, ${card.value} damage.`;
  },
  static: (game, actor, foe) => { dropCards(game, foe, 2); return 'static: rival discards 2.'; },
};

const RIVAL_TAUNTS = [
  'The Magpies keep the vault. Better luck next crew.',
  'Heard the alarms from three blocks away. Amateur hour.',
  'We cracked it while you were still reading the manual.',
];

// One side of the table: health, block, gold, and the three card piles.
function newCrew(deck) {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    block: 0,
    gold: 0,
    deck,
    hand: [],
    discard: [],
    energyDebt: 0,
    dot: 0,
  };
}

/** A brand-new game. `seed` fixes every shuffle, so one seed always replays one game. */
export function createGame(seed) {
  const game = {
    seed,
    rng: createRng(seed),
    phase: PHASE_TITLE,
    turn: 0,
    energy: ENERGY_PER_TURN,
    energyMax: ENERGY_PER_TURN,
    player: newCrew(buildDeck(seed)),
    rival: newCrew(buildDeck(seed ^ 0x9e3779b9)),
    playedSuits: [],
    surgedSuits: [],
    intent: null,
    log: [],
    surgeFlash: null,
    lastPlayed: null,
    stats: { cardsPlayed: 0, damageDealt: 0, goldEarned: 0, turnsPlayed: 0 },
    taunt: '',
    streakRecord: loadStreakRecord(),
  };
  return game;
}

/** Newest log line first; the play log only ever shows the last four. */
export function addLog(game, text) {
  game.log.unshift(text);
  if (game.log.length > 4) game.log.splice(4);
}

/** Move `count` cards from a side's hand into its discard pile. */
function dropCards(game, side, count) {
  for (let i = 0; i < count && side.hand.length > 0; i += 1) {
    side.discard.push(side.hand.pop());
  }
}

/** Draw from `side`'s deck into its hand, reshuffling the discard when the deck runs dry. */
export function drawCards(game, side, count) {
  for (let i = 0; i < count; i += 1) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = seededShuffle(side.discard, game.rng);
      side.discard = [];
    }
    side.hand.push(side.deck.pop());
  }
}

/** Fill a side's hand back up to the standard hand size. */
function topUpHand(game, side) {
  const missing = HAND_SIZE - side.hand.length;
  if (missing > 0) drawCards(game, side, missing);
}

/** Block fades at the start of that side's own next turn. */
export function startPlayerTurn(game) {
  game.turn += 1;
  game.stats.turnsPlayed = game.turn;
  game.energy = ENERGY_PER_TURN;
  game.playedSuits = [];
  game.surgedSuits = [];
  game.surgeFlash = null;
  game.player.block = 0;
  topUpHand(game, game.player);
  addLog(game, `Turn ${game.turn} — you draw to ${game.player.hand.length}.`);
}

/** Begin a game from the title screen: both sides draw, rival intent is set later. */
export function startGame(game) {
  game.phase = PHASE_PLAY;
  game.turn = 0;
  // A running streak buys starting gold: +2 per win in a row, capped at +10.
  game.player.gold = streakStartBonus(game.streakRecord.streak);
  game.rival.gold = 0;
  game.stats = { cardsPlayed: 0, damageDealt: 0, goldEarned: 0, turnsPlayed: 0 };
  game.log = [];
  topUpHand(game, game.rival);
  startPlayerTurn(game);
  game.intent = null; // set by ai.js after the rival's first turn is planned
  if (game.player.gold > 0) addLog(game, `Streak bonus: +${game.player.gold} gold to start.`);
  addLog(game, 'The vault hums. Crack it before the Magpies do.');
}

/** Damage first eats block, then HP. Returns the HP damage actually dealt. */
export function dealDamage(game, target, amount) {
  let left = amount;
  if (target.block > 0) {
    const absorbed = Math.min(target.block, left);
    target.block -= absorbed;
    left -= absorbed;
  }
  if (left > 0) target.hp = Math.max(0, target.hp - left);
  return left;
}

export function gainGold(game, side, amount) {
  side.gold += amount;
  if (side === game.player) game.stats.goldEarned += amount;
}

/** Apply one card's effect. `actor` is 'player' or 'rival'; the other side is the target. */
export function applyCardEffect(game, actor, card) {
  const me = actor === 'player' ? game.player : game.rival;
  const foe = actor === 'player' ? game.rival : game.player;
  const who = actor === 'player' ? 'You' : 'Magpies';
  if (card.suit === 'CUT') {
    const dealt = dealDamage(game, foe, card.value);
    if (actor === 'player') game.stats.damageDealt += dealt;
    addLog(game, `${who} hit ${card.name} for ${card.value} (${dealt} through).`);
  } else if (card.suit === 'LOCK') {
    me.block += card.value;
    addLog(game, `${who} raised ${card.value} block (${card.name}).`);
  } else if (card.suit === 'COIN') {
    COIN_PLAYS[card.id](game, me);
    addLog(game, `${who} played ${card.name} (+gold).`);
  } else if (card.suit === 'WIRE') {
    const fragment = WIRE_PLAYS[card.id](game, actor, foe, card);
    addLog(game, `${who} ${fragment}`);
  }
}

/** Fire a SUIT SURGE when a second card of the same suit lands in one turn. */
export function maybeSurge(game, actor, card) {
  if (game.surgedSuits.includes(card.suit)) return null;
  if (!game.playedSuits.includes(card.suit)) return null;
  game.surgedSuits.push(card.suit);
  const me = actor === 'player' ? game.player : game.rival;
  const foe = actor === 'player' ? game.rival : game.player;
  const effect = SURGE_EFFECTS[card.suit];
  if (card.suit === 'CUT') {
    const dealt = dealDamage(game, foe, 3);
    if (actor === 'player') game.stats.damageDealt += dealt;
  } else if (card.suit === 'LOCK') {
    me.block += 4;
  } else if (card.suit === 'COIN') {
    gainGold(game, me, 3);
    drawCards(game, me, 1);
  } else if (card.suit === 'WIRE') {
    dropCards(game, foe, 1);
  }
  game.surgeFlash = { suit: card.suit, label: effect.label, actor };
  addLog(game, `SURGE! ${effect.label}`);
  return effect;
}

/** Resolve a card play shared by both sides: effect, surge, bookkeeping, end check. */
function resolvePlay(game, actor, card) {
  game.lastPlayed = { ...card, actor };
  applyCardEffect(game, actor, card);
  maybeSurge(game, actor, card);
  game.playedSuits.push(card.suit);
  const side = actor === 'player' ? game.player : game.rival;
  side.discard.push(card);
  checkEnd(game);
}

/** Play the player's card at `handIndex`. Returns false when it cannot be played. */
export function playPlayerCard(game, handIndex) {
  if (game.phase !== PHASE_PLAY) return false;
  const card = game.player.hand[handIndex];
  if (!card || card.cost > game.energy) return false;
  game.player.hand.splice(handIndex, 1);
  game.energy -= card.cost;
  game.stats.cardsPlayed += 1;
  resolvePlay(game, 'player', card);
  return true;
}

/** The rival plays one card from its hand (used by ai.js). */
export function playRivalCard(game, handIndex) {
  const card = game.rival.hand[handIndex];
  if (!card) return false;
  game.rival.hand.splice(handIndex, 1);
  resolvePlay(game, 'rival', card);
  return true;
}

export function ratingFor(game) {
  if (game.player.hp >= 20) return 'CLEAN';
  if (game.player.hp >= 10) return 'LOUD';
  return 'SLOPPY';
}

export function checkEnd(game) {
  if (game.phase !== PHASE_PLAY) return;
  if (game.rival.hp <= 0) {
    game.phase = PHASE_WIN;
    // A win banks one more in a row (and may set a new best).
    game.streakRecord = applyStreakWin(game.streakRecord);
    addLog(game, 'VAULT CRACKED! The gold is yours.');
  } else if (game.player.hp <= 0) {
    game.phase = PHASE_LOSS;
    // A loss breaks the run. The best stands.
    game.streakRecord = applyStreakLoss(game.streakRecord);
    game.taunt = RIVAL_TAUNTS[Math.floor(game.rng() * RIVAL_TAUNTS.length)];
    addLog(game, 'BUSTED! The Magpies walk away with the vault.');
  }
}

/** Rival upkeep at the start of its turn: lingering bug damage, then the end check. */
export function rivalUpkeep(game) {
  if (game.rival.dot > 0) {
    const dealt = dealDamage(game, game.rival, game.rival.dot);
    addLog(game, `Bug Plant bites the Magpies for ${dealt}.`);
  }
  checkEnd(game);
}
