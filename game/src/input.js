// Mouse + keyboard input for VAULTBREAKERS.
// One job only: turn clicks and keys into game actions. It never changes the rules.
import { setMuted, isMuted } from './audio.js';

export const ACTION_END_TURN = 1;

/**
 * Wire up the table: card clicks, the End Turn button, PLAY / Play Again,
 * and the keys 1–5 (quick-play), Space (end turn / start), M (mute), Esc (title).
 * `handlers` is { onPlayCard(index), onEndTurn(), onStart(), onBackToTitle() }.
 * Returns a detach function.
 */
export function createInput(root, handlers) {
  function onClick(event) {
    const cardNode = event.target.closest('.card');
    if (cardNode && cardNode.dataset.index !== undefined && Number(cardNode.dataset.index) >= 0) {
      handlers.onPlayCard(Number(cardNode.dataset.index));
      return;
    }
    if (event.target.closest('#end-turn')) {
      handlers.onEndTurn();
      return;
    }
    if (event.target.closest('#play-btn')) {
      handlers.onStart();
    }
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      handlers.onBackToTitle();
      return;
    }
    if (event.key === 'm' || event.key === 'M') {
      setMuted(!isMuted());
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      handlers.onSpace();
      return;
    }
    const digit = Number.parseInt(event.key, 10);
    if (digit >= 1 && digit <= 5) handlers.onPlayCard(digit - 1);
  }

  function onHover(event) {
    const cardNode = event.target.closest('.card');
    if (!cardNode) return;
    cardNode.classList.add('hovered');
  }

  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  root.addEventListener('mouseover', onHover);

  return function detachInput() {
    root.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    root.removeEventListener('mouseover', onHover);
  };
}
