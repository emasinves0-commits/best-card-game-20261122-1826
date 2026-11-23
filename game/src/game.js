// The state machine: turns, energy, SUIT SURGE, damage / block / gold, win and loss.
// One job only: the rules. It never touches the DOM or the network.
import { buildDeck, createRng, ENERGY_PER_TURN, HAND_SIZE, MAX_HP } from './cards.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_WIN = 'win';
export const PHASE_LOSS = 'loss';

export const SURGE_EFFECTS = {
  CUT: { label: 'CUT SURGE +3 damage', detail: '+3 damage' },
  LOCK: { label: 'LOCK SURGE +4 block', detail: '+4 block' },
  COIN: { label: 'COIN SURGE +3 gold, draw 1', detail: '+3 gold, draw 1' },
  WIRE: { label: 'WIRE SURGE rival discards 1', detail: 'rival discards 1' },
};

function freshSide(deck) {
  return { hp: MAX_HP, maxHp: MAX_HP, block: 0, gold: 0, deck, hand: [], discard: [], energyDebt: 0, dot: 0 };
}

/** A brand-new game. `seed` fixes every shuffle, so the same seed replays the same game. */
export function createGame(seed) {
  const rng = createRng(seed);
  const game = {
    seed,
    rng,
    phase: PHASE_TITLE,
    turn: 0,
    energy: ENERGY_PER_TURN,
    energyMax: ENERGY_PER_TURN,
    player: freshSide(buildDeck(seed)),
    rival: freshSide(buildDeck(seed ^ 0x9e3779b9)),
    playedSuits: [],
    surgedSuits: [],
    intent: null,
    log: [],
    surgeFlash: null,
    lastPlayed: null,
    stats: { cardsPlayed: 0, damageDealt: 0, goldEarned: 0, turnsPlayed: 0 },
    taunt: '',
  };
  return game;
}

export function addLog(game, text) {
  game.log.unshift(text);
  if (game.log.length > 4) game.log.length = 4;
}

/** Draw from `side`'s deck into its hand, reshuffling the discard when the deck runs dry. */
export function drawCards(game, side, count) {
  for (let i = 0; i < count; i += 1) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = side.discard;
      side.discard = [];
      // Reshuffle with the game's rng so the order stays deterministic per seed.
      for (let j = side.deck.length - 1; j > 0; j -= 1) {
        const k = Math.floor(game.rng() * (j + 1));
        const tmp = side.deck[j];
        side.deck[j] = side.deck[k];
        side.deck[k] = tmp;
      }
    }
    side.hand.push(side.deck.pop());
  }
}

function drawToHand(game, side) {
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
  drawToHand(game, game.player);
  addLog(game, `Turn ${game.turn} — you draw to ${game.player.hand.length}.`);
}

/** Begin a game from the title screen: both sides draw, rival intent is set. */
export function startGame(game) {
  game.phase = PHASE_PLAY;
  game.turn = 0;
  game.player.gold = 0;
  game.rival.gold = 0;
  game.stats = { cardsPlayed: 0, damageDealt: 0, goldEarned: 0, turnsPlayed: 0 };
  game.log = [];
  drawToHand(game, game.rival);
  startPlayerTurn(game);
  game.intent = null; // set by ai.js after the rival's first turn is planned
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

function rivalDiscard(game, count) {
  for (let i = 0; i < count && game.rival.hand.length > 0; i += 1) {
    const card = game.rival.hand.pop();
    game.rival.discard.push(card);
  }
}

/** Apply one card's effect. `actor` is 'player' or 'rival'; the other side is the target. */
export function applyCardEffect(game, actor, card) {
  const me = actor === 'player' ? game.player : game.rival;
  const foe = actor === 'player' ? game.rival : game.player;
  const who = actor === 'player' ? 'You' : 'Magpies';
  switch (card.suit) {
    case 'CUT': {
      const dealt = dealDamage(game, foe, card.value);
      if (actor === 'player') game.stats.damageDealt += dealt;
      addLog(game, `${who} hit ${card.name} for ${card.value} (${dealt} through).`);
      break;
    }
    case 'LOCK': {
      me.block += card.value;
      addLog(game, `${who} raised ${card.value} block (${card.name}).`);
      break;
    }
    case 'COIN': {
      if (card.id === 'goldbar') gainGold(game, me, 4);
      else if (card.id === 'tipoff') { drawCards(game, me, 1); gainGold(game, me, 2); }
      else if (card.id === 'insidejob') drawCards(game, me, 2);
      else if (card.id === 'fenceit') gainGold(game, me, 8);
      else if (card.id === 'payoff') { gainGold(game, me, 6); drawCards(game, me, 1); }
      else if (card.id === 'stash') gainGold(game, me, 12);
      addLog(game, `${who} played ${card.name} (+gold).`);
      break;
    }
    case 'WIRE': {
      if (card.id === 'cutlines') { foe.energyDebt += 1; addLog(game, `${who} cut lines: rival −1 energy.`); }
      else if (card.id === 'jammer') { discardFrom(game, foe, 1); addLog(game, `${who} jammed: rival discards 1.`); }
      else if (card.id === 'blackout') { foe.energyDebt += 2; addLog(game, `${who} blackout: rival −2 energy.`); }
      else if (card.id === 'bugplant') { foe.dot += card.value; addLog(game, `${who} planted a bug (3/turn).`); }
      else if (card.id === 'shortcircuit') {
        foe.block = 0;
        const dealt = dealDamage(game, foe, card.value);
        if (actor === 'player') game.stats.damageDealt += dealt;
        addLog(game, `${who} short-circuited: block wiped, ${card.value} damage.`);
      } else if (card.id === 'static') { discardFrom(game, foe, 2); addLog(game, `${who} static: rival discards 2.`); }
      break;
    }
    default:
      break;
  }
}

function discardFrom(game, side, count) {
  for (let i = 0; i < count && side.hand.length > 0; i += 1) {
    side.discard.push(side.hand.pop());
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
    discardFrom(game, foe, 1);
  }
  game.surgeFlash = { suit: card.suit, label: effect.label, actor };
  addLog(game, `SURGE! ${effect.label}`);
  return effect;
}

/** Play the player's card at `handIndex`. Returns false when it cannot be played. */
export function playPlayerCard(game, handIndex) {
  if (game.phase !== PHASE_PLAY) return false;
  const card = game.player.hand[handIndex];
  if (!card || card.cost > game.energy) return false;
  game.player.hand.splice(handIndex, 1);
  game.energy -= card.cost;
  game.stats.cardsPlayed += 1;
  game.lastPlayed = { ...card, actor: 'player' };
  applyCardEffect(game, 'player', card);
  maybeSurge(game, 'player', card);
  game.playedSuits.push(card.suit);
  game.player.discard.push(card);
  checkEnd(game);
  return true;
}

/** The rival plays one card from its hand (used by ai.js). */
export function playRivalCard(game, handIndex) {
  const card = game.rival.hand[handIndex];
  if (!card) return false;
  game.rival.hand.splice(handIndex, 1);
  game.lastPlayed = { ...card, actor: 'rival' };
  applyCardEffect(game, 'rival', card);
  maybeSurge(game, 'rival', card);
  game.playedSuits.push(card.suit);
  game.rival.discard.push(card);
  checkEnd(game);
  return true;
}

export function ratingFor(game) {
  if (game.player.hp >= 20) return 'CLEAN';
  if (game.player.hp >= 10) return 'LOUD';
  return 'SLOPPY';
}

const TAUNTS = [
  'The Magpies keep the vault. Better luck next crew.',
  'Heard the alarms from three blocks away. Amateur hour.',
  'We cracked it while you were still reading the manual.',
];

export function checkEnd(game) {
  if (game.phase !== PHASE_PLAY) return;
  if (game.rival.hp <= 0) {
    game.phase = PHASE_WIN;
    addLog(game, 'VAULT CRACKED! The gold is yours.');
  } else if (game.player.hp <= 0) {
    game.phase = PHASE_LOSS;
    game.taunt = TAUNTS[Math.floor(game.rng() * TAUNTS.length)];
    addLog(game, 'BUSTED! The Magpies walk away with the vault.');
  }
}

/** Rival upkeep at the start of its turn: lingering bug damage, then energy debt. */
export function rivalUpkeep(game) {
  if (game.rival.dot > 0) {
    const dealt = dealDamage(game, game.rival, game.rival.dot);
    addLog(game, `Bug Plant bites the Magpies for ${dealt}.`);
  }
  checkEnd(game);
}
