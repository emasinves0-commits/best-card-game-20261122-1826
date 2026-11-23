// Boot + ?shot= handling for VAULTBREAKERS.
// ?seed=N fixes the shuffle. ?shot=table|title|win|loss (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { createGame, playPlayerCard, startGame } from './game.js';
import { chooseIntent, endPlayerTurn } from './ai.js';
import { renderGame, playEffectCues } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import { playCardSnap, playDrawWhoosh, playWinFanfare, playLoseSting } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const root = document.getElementById('app');
const status = document.getElementById('status');

function announce(message) {
  if (status) status.textContent = message;
}

function runShot(name) {
  const game = stageShot(name, seed);
  window.__vb = game;
  let painted = 0;
  function paint() {
    renderGame(game, { root });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const game = createGame(seed);
  window.__vb = game;
  let before = null;

  function snapshot() {
    return { surgeFlash: game.surgeFlash, lastPlayed: game.lastPlayed, phase: game.phase };
  }

  function render() {
    renderGame(game, { root });
    playEffectCues(game, before);
    // A win or a loss lands with a flourish: fanfare on the transition only.
    if (before && game.phase === 'win' && before.phase !== 'win') playWinFanfare();
    if (before && game.phase === 'loss' && before.phase !== 'loss') playLoseSting();
    before = snapshot();
  }

  function start() {
    startGame(game);
    game.intent = chooseIntent(game);
    playDrawWhoosh();
    announce('Playing. Crack the vault before the Magpies do.');
    render();
  }

  createInput(root, {
    onPlayCard(index) {
      if (game.phase !== 'play') return;
      const ok = playPlayerCard(game, index);
      if (ok) {
        playCardSnap();
        render();
        if (game.phase === 'win') announce('Vault cracked! You win.');
        else if (game.phase === 'loss') announce('Busted! You lose.');
      }
    },
    onEndTurn() {
      if (game.phase !== 'play') return;
      endPlayerTurn(game);
      playDrawWhoosh();
      render();
    },
    onStart() {
      if (game.phase === 'title' || game.phase === 'win' || game.phase === 'loss') start();
    },
    onSpace() {
      if (game.phase === 'play') {
        endPlayerTurn(game);
        playDrawWhoosh();
        render();
      } else {
        start();
      }
    },
    onBackToTitle() {
      if (game.phase !== 'title') {
        const fresh = createGame(Math.floor(Math.random() * 4294967296));
        Object.assign(game, fresh);
        window.__vb = game;
        announce('Back at the title screen.');
        render();
      }
    },
  });

  announce('Vaultbreakers. Press Space or click Play to start.');
  render();
}

if (shot) runShot(shot);
else runGame();
