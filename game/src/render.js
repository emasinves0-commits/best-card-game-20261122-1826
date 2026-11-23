// DOM rendering, animations, HUD, banners and confetti for VAULTBREAKERS.
// One job only: paint the state on screen. It never changes the rules.
import { SUITS } from './cards.js';
import { intentLabel } from './ai.js';
import { ratingFor } from './game.js';
import {
  playBlockShimmer, playCoinChime, playDamageThud, playSurgeFanfare,
} from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSS = 'loss';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function hpBar(side, label) {
  const wrap = el('div', 'hp-wrap');
  const name = el('div', 'hp-name', label);
  const bar = el('div', 'hp-bar');
  const fill = el('div', 'hp-fill');
  const pct = Math.max(0, (side.hp / side.maxHp) * 100);
  fill.style.width = `${pct}%`;
  fill.classList.toggle('hp-low', side.hp <= 10);
  bar.appendChild(fill);
  const nums = el('div', 'hp-nums', `${side.hp} / ${side.maxHp} HP`);
  if (side.block > 0) nums.appendChild(el('span', 'block-badge', `🛡 ${side.block} BLOCK`));
  wrap.append(name, bar, nums);
  return wrap;
}

function energyPips(energy, max) {
  const wrap = el('div', 'energy-pips');
  wrap.appendChild(el('span', 'energy-label', 'ENERGY'));
  for (let i = 0; i < max; i += 1) {
    const pip = el('span', `energy-pip${i < energy ? ' on' : ''}`, '●');
    wrap.appendChild(pip);
  }
  return wrap;
}

function comboMeter(game) {
  const wrap = el('div', 'combo-meter');
  wrap.appendChild(el('span', 'combo-label', 'COMBO'));
  for (const key of Object.keys(SUITS)) {
    const suit = SUITS[key];
    const played = game.playedSuits.includes(key);
    const surged = game.surgedSuits.includes(key);
    const chip = el('span', `combo-chip${played ? ' played' : ''}${surged ? ' surged' : ''}`, suit.icon);
    chip.style.setProperty('--suit-color', suit.color);
    chip.title = `${suit.name}: ${played ? (surged ? 'SURGE!' : 'played') : 'not played'}`;
    wrap.appendChild(chip);
  }
  return wrap;
}

/** One face-up card. `index` is its position in the hand (for quick-play keys). */
export function createCardElement(card, index, playable) {
  const suit = SUITS[card.suit];
  const node = el('div', `card suit-${card.suit}${playable ? ' playable' : ' unplayable'}`);
  node.dataset.index = String(index);
  node.style.setProperty('--suit-color', suit.color);
  node.style.setProperty('--suit-dark', suit.dark);
  const cost = el('div', 'card-cost', String(card.cost));
  const icon = el('div', 'card-icon', suit.icon);
  const value = el('div', 'card-value', String(card.value));
  const name = el('div', 'card-name', card.name);
  const suitName = el('div', 'card-suit', `${suit.icon} ${suit.name}`);
  const text = el('div', 'card-text', card.text);
  const key = el('div', 'card-key', String(index + 1));
  node.append(cost, icon, value, name, suitName, text, key);
  return node;
}

export function createCardBackElement() {
  const node = el('div', 'card card-back');
  node.appendChild(el('div', 'card-back-mark', '◆'));
  node.appendChild(el('div', 'card-back-word', 'MAGPIES'));
  return node;
}

function playLog(game) {
  const wrap = el('div', 'play-log');
  wrap.appendChild(el('div', 'log-title', 'PLAY LOG'));
  if (game.log.length === 0) wrap.appendChild(el('div', 'log-line', 'No plays yet.'));
  for (const line of game.log) wrap.appendChild(el('div', 'log-line', line));
  return wrap;
}

function confetti(container) {
  const colors = ['#f5b301', '#e5484d', '#3b82f6', '#a855f7', '#ffffff'];
  for (let i = 0; i < 90; i += 1) {
    const piece = el('div', 'confetti-piece');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 1.2}s`;
    piece.style.animationDuration = `${2 + Math.random() * 1.6}s`;
    container.appendChild(piece);
  }
}

/** Paint the whole table from `game`. Called after every state change. */
export function renderGame(game, ui) {
  const { root } = ui;
  root.innerHTML = '';

  const table = el('div', 'table');

  // ---- Top bar: objective, turn, deck / discard, gold, mute state ----
  const topbar = el('div', 'topbar');
  topbar.appendChild(el('div', 'objective', '🎯 OBJECTIVE: Crack the vault before the Magpies do'));
  const counts = el('div', 'counts');
  counts.appendChild(el('span', 'count-chip', `TURN ${Math.max(1, game.turn)}`));
  counts.appendChild(el('span', 'count-chip gold-chip', `⬤ GOLD ${game.player.gold}`));
  counts.appendChild(el('span', 'count-chip', `DECK ${game.player.deck.length}`));
  counts.appendChild(el('span', 'count-chip', `DISCARD ${game.player.discard.length}`));
  topbar.appendChild(counts);
  table.appendChild(topbar);

  // ---- Rival row: HP bar + face-down hand ----
  const rivalRow = el('div', 'rival-row');
  const rivalInfo = el('div', 'side-info');
  rivalInfo.appendChild(el('div', 'side-title rival-title', '🐦 THE MAGPIES — RIVAL CREW'));
  rivalInfo.appendChild(hpBar(game.rival, 'CREW'));
  rivalInfo.appendChild(el('div', 'side-sub', `Hand ${game.rival.hand.length} · Deck ${game.rival.deck.length}`));
  rivalRow.appendChild(rivalInfo);
  const rivalHand = el('div', 'rival-hand');
  for (let i = 0; i < Math.max(3, game.rival.hand.length); i += 1) rivalHand.appendChild(createCardBackElement());
  rivalRow.appendChild(rivalHand);
  table.appendChild(rivalRow);

  // ---- Middle: intent banner, surge banner, last played card, play log ----
  const mid = el('div', 'mid-row');
  const banners = el('div', 'banners');
  const intent = el('div', 'intent-banner', intentLabel(game.intent));
  intent.classList.toggle('intent-sabotage', game.intent && game.intent.type === 'SABOTAGE');
  banners.appendChild(intent);
  if (game.surgeFlash) {
    const surge = el('div', 'surge-banner', `⚡ SURGE! ${game.surgeFlash.label} ⚡`);
    banners.appendChild(surge);
  }
  const hint = el('div', 'hint', 'Click a card to play it · 1–5 quick-play · Space = End Turn · M = mute');
  banners.appendChild(hint);
  mid.appendChild(banners);
  const centre = el('div', 'centre-spot');
  if (game.lastPlayed) {
    centre.appendChild(el('div', 'centre-label', game.lastPlayed.actor === 'player' ? 'YOU PLAYED' : 'MAGPIES PLAYED'));
    centre.appendChild(createCardElement(game.lastPlayed, -1, false));
  } else {
    centre.appendChild(el('div', 'centre-empty', 'Your played card lands here'));
  }
  mid.appendChild(centre);
  mid.appendChild(playLog(game));
  table.appendChild(mid);

  // ---- Player row: HP bar, energy, combo meter, End Turn ----
  const playerRow = el('div', 'player-row');
  const playerInfo = el('div', 'side-info');
  playerInfo.appendChild(el('div', 'side-title player-title', '🔓 VAULTBREAKERS — YOU'));
  playerInfo.appendChild(hpBar(game.player, 'CREW'));
  playerRow.appendChild(playerInfo);
  playerRow.appendChild(energyPips(game.energy, game.energyMax));
  playerRow.appendChild(comboMeter(game));
  const endBtn = el('button', 'end-turn-btn', 'END TURN ⏎');
  endBtn.id = 'end-turn';
  endBtn.disabled = game.phase !== 'play';
  playerRow.appendChild(endBtn);
  table.appendChild(playerRow);

  // ---- Player hand, fanned across the bottom ----
  const hand = el('div', 'player-hand');
  game.player.hand.forEach((card, index) => {
    const playable = game.phase === 'play' && card.cost <= game.energy;
    hand.appendChild(createCardElement(card, index, playable));
  });
  if (game.player.hand.length === 0) hand.appendChild(el('div', 'hand-empty', 'Hand empty — end your turn to draw.'));
  table.appendChild(hand);

  root.appendChild(table);

  // ---- Overlays ----
  if (game.phase === 'title') root.appendChild(renderTitleOverlay(game));
  if (game.phase === 'win') root.appendChild(renderEndOverlay(game, true));
  if (game.phase === 'loss') root.appendChild(renderEndOverlay(game, false));
}

function renderTitleOverlay(game) {
  const overlay = el('div', 'overlay title-overlay');
  const panel = el('div', 'panel title-panel');
  panel.appendChild(el('div', 'title-kicker', 'A HEIST CARD DUEL'));
  panel.appendChild(el('h1', 'game-title', 'VAULTBREAKERS'));
  panel.appendChild(el('div', 'title-sub', 'Two crews. One vault. Crack it first.'));
  const rules = el('div', 'rules-panel');
  rules.appendChild(el('div', 'rules-title', 'HOW TO PLAY'));
  const lines = [
    '◆ CUT (red) deals damage · ■ LOCK (blue) gains block · ● COIN (gold) earns gold · ⚡ WIRE (purple) sabotages the Magpies.',
    'Both crews have 30 HP. You get 3 energy a turn and draw to 5 cards.',
    'Play 2 cards of one suit in a turn to trigger a SUIT SURGE — bonus damage, block, gold or sabotage.',
    'Read the RIVAL PLANS banner: the Magpies always play what it says. Block the smash, or race them.',
    'Gold is your score. Drop the Magpies to 0 HP to crack the vault.',
  ];
  for (const line of lines) rules.appendChild(el('div', 'rule-line', line));
  panel.appendChild(rules);
  // Deck preview strip: one card of each suit, face up.
  const preview = el('div', 'deck-preview');
  preview.appendChild(el('div', 'preview-label', 'YOUR DECK — 24 CARDS · 4 SUITS'));
  const strip = el('div', 'preview-strip');
  const sampleIds = ['thermite', 'vaultseal', 'stash', 'blackout'];
  for (const id of sampleIds) {
    const def = { id, name: '', suit: '', cost: 0, value: 0, text: '' };
    const found = [
      { id: 'thermite', name: 'Thermite', suit: 'CUT', cost: 3, value: 14, text: 'Deal 14 damage.' },
      { id: 'vaultseal', name: 'Vault Seal', suit: 'LOCK', cost: 3, value: 15, text: 'Gain 15 block.' },
      { id: 'stash', name: 'Stash', suit: 'COIN', cost: 3, value: 12, text: '+12 gold.' },
      { id: 'blackout', name: 'Blackout', suit: 'WIRE', cost: 2, value: 2, text: 'Rival −2 energy next turn.' },
    ].find((c) => c.id === id);
    strip.appendChild(createCardElement(found ?? def, -1, false));
  }
  preview.appendChild(strip);
  panel.appendChild(preview);
  const playBtn = el('button', 'play-btn', '▶  PLAY — CRACK THE VAULT');
  playBtn.id = 'play-btn';
  panel.appendChild(playBtn);
  panel.appendChild(el('div', 'title-foot', 'Click a card to play it · Space ends your turn · 1–5 quick-play · M mute · Esc title'));
  overlay.appendChild(panel);
  return overlay;
}

function renderEndOverlay(game, won) {
  const overlay = el('div', 'overlay end-overlay');
  const panel = el('div', `panel end-panel${won ? ' win-panel' : ' loss-panel'}`);
  if (won) confetti(panel);
  panel.appendChild(el('div', 'end-kicker', won ? 'THE VAULT IS OPEN' : 'THE ALARM SCREAMS'));
  panel.appendChild(el('h1', 'end-title', won ? 'VAULT CRACKED!' : 'BUSTED!'));
  panel.appendChild(el('div', 'end-sub', won
    ? `You cracked the vault and walked out with the gold. Rating: ${ratingFor(game)}`
    : game.taunt || 'The Magpies keep the vault.'));
  const stats = el('div', 'end-stats');
  const rows = [
    ['💰 LOOT (GOLD)', String(game.player.gold)],
    ['🃏 CARDS PLAYED', String(game.stats.cardsPlayed)],
    ['⚔️ DAMAGE DEALT', String(game.stats.damageDealt)],
    ['🔁 TURNS', String(game.stats.turnsPlayed)],
    ['❤️ YOUR HP LEFT', `${game.player.hp} / ${game.player.maxHp}`],
    ['🐦 MAGPIES HP LEFT', `${game.rival.hp} / ${game.rival.maxHp}`],
  ];
  for (const [label, value] of rows) {
    const row = el('div', 'stat-row');
    row.appendChild(el('span', 'stat-label', label));
    row.appendChild(el('span', 'stat-value', value));
    stats.appendChild(row);
  }
  panel.appendChild(stats);
  const againBtn = el('button', 'play-btn', won ? '↻  PLAY AGAIN' : '↻  TRY AGAIN');
  againBtn.id = 'play-btn';
  panel.appendChild(againBtn);
  panel.appendChild(el('div', 'title-foot', 'Press Space or click Play Again to run it back'));
  overlay.appendChild(panel);
  return overlay;
}

/** Little sound + shake cues after a play, keyed off what just happened. */
export function playEffectCues(game, before) {
  if (!before) return;
  if (game.surgeFlash && (!before.surgeFlash || before.surgeFlash.label !== game.surgeFlash.label)) {
    playSurgeFanfare();
  }
  if (game.lastPlayed) {
    const card = game.lastPlayed;
    if (card.suit === 'COIN') playCoinChime();
    else if (card.suit === 'LOCK') playBlockShimmer();
    else if (card.suit === 'CUT') playDamageThud();
  }
}
