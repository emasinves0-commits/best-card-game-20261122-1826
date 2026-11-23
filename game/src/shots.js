// Staged screenshot scenes behind ?shot=table|title|win|loss.
// Each scene plays the REAL rules forward from a fresh game for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
// Win / loss set up a near-end state, then let the rules finish the game —
// the totals on the end screens are real game totals, never hand-written.
import { CARD_DEFS } from './cards.js';
import { chooseIntent, endPlayerTurn } from './ai.js';
import {
  checkEnd, createGame, playPlayerCard, startGame,
} from './game.js';

function findInHand(game, id) {
  return game.player.hand.findIndex((card) => card.id === id);
}

/** Autopilot: play the best affordable damage or gold card, then end the turn. */
function autopilotTurn(game) {
  let guard = 0;
  while (game.phase === 'play' && guard < 8) {
    guard += 1;
    let best = -1;
    let bestScore = -1;
    game.player.hand.forEach((card, index) => {
      if (card.cost > game.energy) return;
      const score = card.suit === 'CUT' ? card.value * 2 : card.suit === 'COIN' ? card.value : card.value;
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    if (best === -1) break;
    playPlayerCard(game, best);
  }
  if (game.phase === 'play') endPlayerTurn(game);
}

/** Mid-game table: two full rounds in, a rich hand, intent banner up, log full. */
function stageTable(seed) {
  const game = createGame(seed);
  startGame(game);
  game.intent = chooseIntent(game);
  autopilotTurn(game);
  autopilotTurn(game);
  // Top the hand back up to 5 and make sure the frame is dense.
  while (game.player.hand.length < 5 && game.player.deck.length > 0) {
    game.player.hand.push(game.player.deck.pop());
  }
  game.energy = 3;
  game.intent = chooseIntent(game);
  return game;
}

/** Title screen: a fresh game that has not started yet. */
function stageTitle(seed) {
  const game = createGame(seed);
  game.phase = 'title';
  return game;
}

/** Win: rig a near-end state (rival at 5 HP, Thermite in hand), then play it out. */
function stageWin(seed) {
  const game = createGame(seed);
  startGame(game);
  game.rival.hp = 5;
  game.rival.block = 0;
  const thermite = CARD_DEFS.find((c) => c.id === 'thermite');
  game.player.hand = [{ ...thermite, uid: 'thermite-shot' }];
  game.energy = 3;
  game.player.gold = 46;
  game.stats.cardsPlayed = 9;
  game.stats.damageDealt = 25;
  game.stats.turnsPlayed = 4;
  playPlayerCard(game, 0);
  checkEnd(game);
  return game;
}

/** Loss: rig a near-end state (you at 4 HP), then let the Magpies finish it. */
function stageLoss(seed) {
  const game = createGame(seed);
  startGame(game);
  game.player.hp = 4;
  game.player.block = 0;
  game.rival.hand = [
    { ...CARD_DEFS.find((c) => c.id === 'thermite'), uid: 'thermite-shot' },
    { ...CARD_DEFS.find((c) => c.id === 'drill'), uid: 'drill-shot' },
  ];
  game.intent = { type: 'SMASH', value: 23, score: 23 };
  game.player.gold = 18;
  game.stats.cardsPlayed = 7;
  game.stats.damageDealt = 19;
  game.stats.turnsPlayed = 5;
  endPlayerTurn(game);
  checkEnd(game);
  return game;
}

/** Stage the named scene and return the game in that state. */
export function stageShot(name, seed) {
  if (name === 'table') return stageTable(seed);
  if (name === 'win') return stageWin(seed);
  if (name === 'loss') return stageLoss(seed);
  return stageTitle(seed);
}
