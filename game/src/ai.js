// The Magpies: what the rival plans, and how it plays to that plan.
// One job only: decide the intent, then play cards that match it.
import { ENERGY_PER_TURN } from './cards.js';
import {
  checkEnd, dealDamage, drawCards, playRivalCard, rivalUpkeep, startPlayerTurn,
} from './game.js';

export const INTENT_SMASH = 'SMASH';
export const INTENT_FORTIFY = 'FORTIFY';
export const INTENT_SABOTAGE = 'SABOTAGE';
export const INTENT_LOOT = 'LOOT';

// The order the rival prefers when two plans score the same.
const INTENT_ORDER = [INTENT_SMASH, INTENT_FORTIFY, INTENT_SABOTAGE, INTENT_LOOT];

// Which suit serves which plan.
const PLAN_SUIT = {
  [INTENT_SMASH]: 'CUT',
  [INTENT_FORTIFY]: 'LOCK',
  [INTENT_SABOTAGE]: 'WIRE',
  [INTENT_LOOT]: 'COIN',
};

const INTENT_TEXT = {
  [INTENT_SMASH]: (value) => `RIVAL PLANS: SMASH ${value}`,
  [INTENT_FORTIFY]: (value) => `RIVAL PLANS: FORTIFY ${value}`,
  [INTENT_SABOTAGE]: () => 'RIVAL PLANS: SABOTAGE',
  [INTENT_LOOT]: () => 'RIVAL PLANS: LOOT',
};

/** Score each plan from the rival's actual hand, then take the strongest one. */
export function chooseIntent(game) {
  const totals = { [INTENT_SMASH]: 0, [INTENT_FORTIFY]: 0, [INTENT_SABOTAGE]: 0, [INTENT_LOOT]: 0 };
  for (const card of game.rival.hand) {
    if (card.suit === 'CUT') totals[INTENT_SMASH] += card.value;
    else if (card.suit === 'LOCK') totals[INTENT_FORTIFY] += card.value;
    else if (card.suit === 'WIRE') totals[INTENT_SABOTAGE] += card.value + 2;
    else if (card.suit === 'COIN') totals[INTENT_LOOT] += card.value;
  }
  // The rival threatens hardest with damage when the player is low...
  if (game.player.hp <= 10) totals[INTENT_SMASH] += 6;
  // ...and turtles when it is the one bleeding.
  if (game.rival.hp <= 10) totals[INTENT_FORTIFY] += 6;
  let bestType = INTENT_ORDER[0];
  for (const type of INTENT_ORDER) {
    if (totals[type] > totals[bestType]) bestType = type;
  }
  return { type: bestType, value: totals[bestType], score: totals[bestType] };
}

export function intentLabel(intent) {
  if (!intent) return 'RIVAL PLANS: ???';
  return INTENT_TEXT[intent.type](intent.value);
}

/** Does this card serve the declared plan? The rival plays on-plan cards first. */
function servesPlan(card, intent) {
  if (!intent) return true;
  return card.suit === PLAN_SUIT[intent.type];
}

/**
 * The full rival turn: upkeep (bug damage), draw to 5, block fades, then play
 * on-plan cards while energy lasts, then hand the turn back to the player and
 * pick the NEXT intent — which is what the banner shows during your turn.
 */
export function runRivalTurn(game) {
  game.playedSuits = [];
  game.surgedSuits = [];
  game.surgeFlash = null;
  game.rival.block = 0; // rival block expires at the start of its own next turn
  rivalUpkeep(game);
  if (game.phase !== 'play') return;
  const debt = Math.min(game.rival.energyDebt, ENERGY_PER_TURN);
  game.rival.energyDebt = 0;
  let energy = Math.max(0, ENERGY_PER_TURN - debt);
  drawCards(game, game.rival, 5 - game.rival.hand.length);
  const plan = game.intent ?? chooseIntent(game);
  // On-plan cards first (best value first), then anything affordable.
  const queue = game.rival.hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const aOnPlan = servesPlan(a.card, plan) ? 0 : 1;
      const bOnPlan = servesPlan(b.card, plan) ? 0 : 1;
      if (aOnPlan !== bOnPlan) return aOnPlan - bOnPlan;
      return b.card.value - a.card.value;
    });
  for (const pick of queue) {
    if (game.phase !== 'play') break;
    if (pick.card.cost > energy) continue;
    const live = game.rival.hand.indexOf(pick.card);
    if (live === -1) continue;
    energy -= pick.card.cost;
    playRivalCard(game, live);
  }
  if (game.phase !== 'play') return;
  // Plan the next turn now, so the player can read it and counter it.
  game.intent = chooseIntent(game);
  startPlayerTurn(game);
}

/** End the player's turn and hand control to the rival. */
export function endPlayerTurn(game) {
  if (game.phase !== 'play') return;
  runRivalTurn(game);
}
