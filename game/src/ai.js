// The Magpies: readable rival intent + the rival's turn.
// One job only: decide what the rival plans, then play cards that match that plan.
import { ENERGY_PER_TURN } from './cards.js';
import {
  checkEnd, dealDamage, drawCards, playRivalCard, rivalUpkeep, startPlayerTurn,
} from './game.js';

export const INTENT_SMASH = 'SMASH';
export const INTENT_FORTIFY = 'FORTIFY';
export const INTENT_SABOTAGE = 'SABOTAGE';
export const INTENT_LOOT = 'LOOT';

/** Score each intent from the rival's actual hand, then pick the strongest plan. */
export function chooseIntent(game) {
  const hand = game.rival.hand;
  let smash = 0;
  let fortify = 0;
  let sabotage = 0;
  let loot = 0;
  for (const card of hand) {
    if (card.suit === 'CUT') smash += card.value;
    else if (card.suit === 'LOCK') fortify += card.value;
    else if (card.suit === 'WIRE') sabotage += card.value + 2;
    else if (card.suit === 'COIN') loot += card.value;
  }
  // The rival threatens hardest with damage when the player is low.
  if (game.player.hp <= 10) smash += 6;
  // ...and turtles when it is the one bleeding.
  if (game.rival.hp <= 10) fortify += 6;
  const scored = [
    { type: INTENT_SMASH, score: smash, value: smash },
    { type: INTENT_FORTIFY, score: fortify, value: fortify },
    { type: INTENT_SABOTAGE, score: sabotage, value: sabotage },
    { type: INTENT_LOOT, score: loot, value: loot },
  ];
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { type: best.type, value: best.value, score: best.score };
}

export function intentLabel(intent) {
  if (!intent) return 'RIVAL PLANS: ???';
  if (intent.type === INTENT_SMASH) return `RIVAL PLANS: SMASH ${intent.value}`;
  if (intent.type === INTENT_FORTIFY) return `RIVAL PLANS: FORTIFY ${intent.value}`;
  if (intent.type === INTENT_SABOTAGE) return 'RIVAL PLANS: SABOTAGE';
  return 'RIVAL PLANS: LOOT';
}

/** Does this card serve the declared intent? The rival plays on-plan cards first. */
function cardMatchesIntent(card, intent) {
  if (!intent) return true;
  if (intent.type === INTENT_SMASH) return card.suit === 'CUT';
  if (intent.type === INTENT_FORTIFY) return card.suit === 'LOCK';
  if (intent.type === INTENT_SABOTAGE) return card.suit === 'WIRE';
  if (intent.type === INTENT_LOOT) return card.suit === 'COIN';
  return true;
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
  const energyDebt = Math.min(game.rival.energyDebt, ENERGY_PER_TURN);
  game.rival.energyDebt = 0;
  let energy = Math.max(0, ENERGY_PER_TURN - energyDebt);
  drawCards(game, game.rival, 5 - game.rival.hand.length);
  const intent = game.intent ?? chooseIntent(game);
  // Play on-plan cards first (best value first), then anything affordable.
  const order = game.rival.hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const aOn = cardMatchesIntent(a.card, intent) ? 0 : 1;
      const bOn = cardMatchesIntent(b.card, intent) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      return b.card.value - a.card.value;
    });
  for (const pick of order) {
    if (game.phase !== 'play') break;
    if (pick.card.cost > energy) continue;
    const liveIndex = game.rival.hand.indexOf(pick.card);
    if (liveIndex === -1) continue;
    energy -= pick.card.cost;
    playRivalCard(game, liveIndex);
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
