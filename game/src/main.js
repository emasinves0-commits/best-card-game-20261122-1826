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

const query = new URLSearchParams(window.location.search);
const shotName = query.get('shot');
const seedRaw = Number.parseInt(query.get('seed') ?? '', 10);
const seed = Number.isInteger(seedRaw) ? seedRaw : Math.floor(Math.random() * 4294967296);

const root = document.getElementById('app');
const status = document.getElementById('status');

function say(message) {
  if (status) status.textContent = message;
}

/** Stage one screenshot scene: paint twice, then signal the shot is ready. */
function stageScene(name) {
  const game = stageShot(name, seed);
  window.__vb = game;
  let paints = 0;
  const paintOnce = () => {
    renderGame(game, { root });
    paints += 1;
    if (paints < 2) requestAnimationFrame(paintOnce);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paintOnce);
}

/** The interactive game: render after every action, with sound cues on change. */
function playGame() {
  const game = createGame(seed);
  window.__vb = game;
  let previous = null;

  const remember = () => ({ surgeFlash: game.surgeFlash, lastPlayed: game.lastPlayed, phase: game.phase });

  function paint() {
    renderGame(game, { root });
    playEffectCues(game, previous);
    // A win or a loss lands with a flourish: fanfare on the transition only.
    if (previous && game.phase === 'win' && previous.phase !== 'win') playWinFanfare();
    if (previous && game.phase === 'loss' && previous.phase !== 'loss') playLoseSting();
    previous = remember();
  }

  function begin() {
    startGame(game);
    game.intent = chooseIntent(game);
    playDrawWhoosh();
    say('Playing. Crack the vault before the Magpies do.');
    paint();
  }

  function restart() {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    Object.assign(game, fresh);
    window.__vb = game;
    say('Back at the title screen.');
    paint();
  }

  createInput(root, {
    onPlayCard(index) {
      if (game.phase !== 'play') return;
      if (!playPlayerCard(game, index)) return;
      playCardSnap();
      paint();
      if (game.phase === 'win') say('Vault cracked! You win.');
      else if (game.phase === 'loss') say('Busted! You lose.');
    },
    onEndTurn() {
      if (game.phase !== 'play') return;
      endPlayerTurn(game);
      playDrawWhoosh();
      paint();
    },
    onStart() {
      if (game.phase === 'title' || game.phase === 'win' || game.phase === 'loss') begin();
    },
    onSpace() {
      if (game.phase === 'play') {
        endPlayerTurn(game);
        playDrawWhoosh();
        paint();
      } else {
        begin();
      }
    },
    onBackToTitle() {
      if (game.phase !== 'title') restart();
    },
  });

  say('Vaultbreakers. Press Space or click Play to start.');
  paint();
}

if (shotName) stageScene(shotName);
else playGame();
