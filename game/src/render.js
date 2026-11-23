// Painting the table: DOM, animations, HUD, banners and confetti.
// One job only: paint the state on screen. It never changes the rules.
import { SUITS } from './cards.js';
import { intentLabel } from './ai.js';
import { ratingFor } from './game.js';
import { streakLine, streakBonusLine } from './streak.js';
import {
  playBlockShimmer, playCoinChime, playDamageThud, playSurgeFanfare,
} from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSS = 'loss';

/** Tiny DOM builder: tag + class + optional text, nothing more. */
function mk(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/** A crew's health bar with its number and any block badge. */
function healthBar(side, label) {
  const wrap = mk('div', 'hp-wrap');
  wrap.appendChild(mk('div', 'hp-name', label));
  const bar = mk('div', 'hp-bar');
  const fill = mk('div', 'hp-fill');
  fill.style.width = `${Math.max(0, (side.hp / side.maxHp) * 100)}%`;
  fill.classList.toggle('hp-low', side.hp <= 10);
  bar.appendChild(fill);
  wrap.appendChild(bar);
  const nums = mk('div', 'hp-nums', `${side.hp} / ${side.maxHp} HP`);
  if (side.block > 0) nums.appendChild(mk('span', 'block-badge', `🛡 ${side.block} BLOCK`));
  wrap.appendChild(nums);
  return wrap;
}

/** The row of energy pips beside the player's health. */
function energyRow(energy, max) {
  const wrap = mk('div', 'energy-pips');
  wrap.appendChild(mk('span', 'energy-label', 'ENERGY'));
  for (let i = 0; i < max; i += 1) {
    wrap.appendChild(mk('span', `energy-pip${i < energy ? ' on' : ''}`, '●'));
  }
  return wrap;
}

/** The combo meter: one chip per suit, lit when played, blazing on a surge. */
function comboRow(game) {
  const wrap = mk('div', 'combo-meter');
  wrap.appendChild(mk('span', 'combo-label', 'COMBO'));
  for (const key of Object.keys(SUITS)) {
    const suit = SUITS[key];
    const played = game.playedSuits.includes(key);
    const surged = game.surgedSuits.includes(key);
    const chip = mk('span', `combo-chip${played ? ' played' : ''}${surged ? ' surged' : ''}`, suit.icon);
    chip.style.setProperty('--suit-color', suit.color);
    chip.title = `${suit.name}: ${played ? (surged ? 'SURGE!' : 'played') : 'not played'}`;
    wrap.appendChild(chip);
  }
  return wrap;
}

/** One face-up card. `index` is its position in the hand (for quick-play keys). */
export function createCardElement(card, index, playable) {
  const suit = SUITS[card.suit];
  const node = mk('div', `card suit-${card.suit}${playable ? ' playable' : ' unplayable'}`);
  node.dataset.index = String(index);
  node.style.setProperty('--suit-color', suit.color);
  node.style.setProperty('--suit-dark', suit.dark);
  node.appendChild(mk('div', 'card-cost', String(card.cost)));
  node.appendChild(mk('div', 'card-icon', suit.icon));
  node.appendChild(mk('div', 'card-value', String(card.value)));
  node.appendChild(mk('div', 'card-name', card.name));
  node.appendChild(mk('div', 'card-suit', `${suit.icon} ${suit.name}`));
  node.appendChild(mk('div', 'card-text', card.text));
  node.appendChild(mk('div', 'card-key', String(index + 1)));
  return node;
}

export function createCardBackElement() {
  const node = mk('div', 'card card-back');
  node.appendChild(mk('div', 'card-back-mark', '◆'));
  node.appendChild(mk('div', 'card-back-word', 'MAGPIES'));
  return node;
}

/** The play log: the last four events, newest first. */
function logPanel(game) {
  const wrap = mk('div', 'play-log');
  wrap.appendChild(mk('div', 'log-title', 'PLAY LOG'));
  if (game.log.length === 0) wrap.appendChild(mk('div', 'log-line', 'No plays yet.'));
  for (const line of game.log) wrap.appendChild(mk('div', 'log-line', line));
  return wrap;
}

/** Ninety falling pieces for the win screen. */
function confetti(container) {
  const colors = ['#f5b301', '#e5484d', '#3b82f6', '#a855f7', '#ffffff'];
  for (let i = 0; i < 90; i += 1) {
    const piece = mk('div', 'confetti-piece');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 1.2}s`;
    piece.style.animationDuration = `${2 + Math.random() * 1.6}s`;
    container.appendChild(piece);
  }
}

// ---- Table sections: each builds one row of the table. ----

function topBar(game) {
  const bar = mk('div', 'topbar');
  bar.appendChild(mk('div', 'objective', '🎯 OBJECTIVE: Crack the vault before the Magpies do'));
  const counts = mk('div', 'counts');
  counts.appendChild(mk('span', 'count-chip', `TURN ${Math.max(1, game.turn)}`));
  counts.appendChild(mk('span', 'count-chip gold-chip', `⬤ GOLD ${game.player.gold}`));
  counts.appendChild(mk('span', 'count-chip streak-chip', `🔥 STREAK ${game.streakRecord.streak}`));
  counts.appendChild(mk('span', 'count-chip', `DECK ${game.player.deck.length}`));
  counts.appendChild(mk('span', 'count-chip', `DISCARD ${game.player.discard.length}`));
  bar.appendChild(counts);
  return bar;
}

function rivalRow(game) {
  const row = mk('div', 'rival-row');
  const info = mk('div', 'side-info');
  info.appendChild(mk('div', 'side-title rival-title', '🐦 THE MAGPIES — RIVAL CREW'));
  info.appendChild(healthBar(game.rival, 'CREW'));
  info.appendChild(mk('div', 'side-sub', `Hand ${game.rival.hand.length} · Deck ${game.rival.deck.length}`));
  row.appendChild(info);
  const hand = mk('div', 'rival-hand');
  for (let i = 0; i < Math.max(3, game.rival.hand.length); i += 1) hand.appendChild(createCardBackElement());
  row.appendChild(hand);
  return row;
}

function middleRow(game) {
  const row = mk('div', 'mid-row');
  const banners = mk('div', 'banners');
  const intent = mk('div', 'intent-banner', intentLabel(game.intent));
  intent.classList.toggle('intent-sabotage', game.intent && game.intent.type === 'SABOTAGE');
  banners.appendChild(intent);
  if (game.surgeFlash) {
    banners.appendChild(mk('div', 'surge-banner', `⚡ SURGE! ${game.surgeFlash.label} ⚡`));
  }
  banners.appendChild(mk('div', 'hint', 'Click a card to play it · 1–5 quick-play · Space = End Turn · M = mute'));
  row.appendChild(banners);
  const centre = mk('div', 'centre-spot');
  if (game.lastPlayed) {
    centre.appendChild(mk('div', 'centre-label', game.lastPlayed.actor === 'player' ? 'YOU PLAYED' : 'MAGPIES PLAYED'));
    centre.appendChild(createCardElement(game.lastPlayed, -1, false));
  } else {
    centre.appendChild(mk('div', 'centre-empty', 'Your played card lands here'));
  }
  row.appendChild(centre);
  row.appendChild(logPanel(game));
  return row;
}

function playerRow(game) {
  const row = mk('div', 'player-row');
  const info = mk('div', 'side-info');
  info.appendChild(mk('div', 'side-title player-title', '🔓 VAULTBREAKERS — YOU'));
  info.appendChild(healthBar(game.player, 'CREW'));
  row.appendChild(info);
  row.appendChild(energyRow(game.energy, game.energyMax));
  row.appendChild(comboRow(game));
  const endBtn = mk('button', 'end-turn-btn', 'END TURN ⏎');
  endBtn.id = 'end-turn';
  endBtn.disabled = game.phase !== 'play';
  row.appendChild(endBtn);
  return row;
}

function handRow(game) {
  const hand = mk('div', 'player-hand');
  game.player.hand.forEach((card, index) => {
    const playable = game.phase === 'play' && card.cost <= game.energy;
    hand.appendChild(createCardElement(card, index, playable));
  });
  if (game.player.hand.length === 0) hand.appendChild(mk('div', 'hand-empty', 'Hand empty — end your turn to draw.'));
  return hand;
}

/** Paint the whole table from `game`. Called after every state change. */
export function renderGame(game, ui) {
  const { root } = ui;
  root.innerHTML = '';
  const table = mk('div', 'table');
  table.appendChild(topBar(game));
  table.appendChild(rivalRow(game));
  table.appendChild(middleRow(game));
  table.appendChild(playerRow(game));
  table.appendChild(handRow(game));
  root.appendChild(table);
  if (game.phase === 'title') root.appendChild(titleOverlay(game));
  if (game.phase === 'win') root.appendChild(endOverlay(game, true));
  if (game.phase === 'loss') root.appendChild(endOverlay(game, false));
}

// ---- Overlays: title screen and the two end screens. ----

/** The streak readout: current run + best, and what the streak buys this heist. */
function streakBanner(record) {
  const wrap = mk('div', 'streak-row');
  wrap.appendChild(mk('div', 'streak-line', streakLine(record)));
  wrap.appendChild(mk('div', 'streak-bonus', streakBonusLine(record)));
  return wrap;
}

const TITLE_RULES = [
  '◆ CUT (red) deals damage · ■ LOCK (blue) gains block · ● COIN (gold) earns gold · ⚡ WIRE (purple) sabotages the Magpies.',
  'Both crews have 30 HP. You get 3 energy a turn and draw to 5 cards.',
  'Play 2 cards of one suit in a turn to trigger a SUIT SURGE — bonus damage, block, gold or sabotage.',
  'Read the RIVAL PLANS banner: the Magpies always play what it says. Block the smash, or race them.',
  'Gold is your score. Drop the Magpies to 0 HP to crack the vault.',
];

// One showcase card per suit for the deck preview strip.
const PREVIEW_CARDS = [
  { id: 'thermite', name: 'Thermite', suit: 'CUT', cost: 3, value: 14, text: 'Deal 14 damage.' },
  { id: 'vaultseal', name: 'Vault Seal', suit: 'LOCK', cost: 3, value: 15, text: 'Gain 15 block.' },
  { id: 'stash', name: 'Stash', suit: 'COIN', cost: 3, value: 12, text: '+12 gold.' },
  { id: 'blackout', name: 'Blackout', suit: 'WIRE', cost: 2, value: 2, text: 'Rival −2 energy next turn.' },
];

function titleOverlay(game) {
  const overlay = mk('div', 'overlay title-overlay');
  const panel = mk('div', 'panel title-panel');
  panel.appendChild(mk('div', 'title-kicker', 'A HEIST CARD DUEL'));
  panel.appendChild(mk('h1', 'game-title', 'VAULTBREAKERS'));
  panel.appendChild(mk('div', 'title-sub', 'Two crews. One vault. Crack it first.'));
  panel.appendChild(streakBanner(game.streakRecord));
  const rules = mk('div', 'rules-panel');
  rules.appendChild(mk('div', 'rules-title', 'HOW TO PLAY'));
  for (const line of TITLE_RULES) rules.appendChild(mk('div', 'rule-line', line));
  panel.appendChild(rules);
  const preview = mk('div', 'deck-preview');
  preview.appendChild(mk('div', 'preview-label', 'YOUR DECK — 24 CARDS · 4 SUITS'));
  const strip = mk('div', 'preview-strip');
  for (const card of PREVIEW_CARDS) strip.appendChild(createCardElement(card, -1, false));
  preview.appendChild(strip);
  panel.appendChild(preview);
  const playBtn = mk('button', 'play-btn', '▶  PLAY — CRACK THE VAULT');
  playBtn.id = 'play-btn';
  panel.appendChild(playBtn);
  panel.appendChild(mk('div', 'title-foot', 'Click a card to play it · Space ends your turn · 1–5 quick-play · M mute · Esc title'));
  overlay.appendChild(panel);
  return overlay;
}

function endOverlay(game, won) {
  const overlay = mk('div', 'overlay end-overlay');
  const panel = mk('div', `panel end-panel${won ? ' win-panel' : ' loss-panel'}`);
  if (won) confetti(panel);
  panel.appendChild(mk('div', 'end-kicker', won ? 'THE VAULT IS OPEN' : 'THE ALARM SCREAMS'));
  panel.appendChild(mk('h1', 'end-title', won ? 'VAULT CRACKED!' : 'BUSTED!'));
  panel.appendChild(mk('div', 'end-sub', won
    ? `You cracked the vault and walked out with the gold. Rating: ${ratingFor(game)}`
    : game.taunt || 'The Magpies keep the vault.'));
  panel.appendChild(streakBanner(game.streakRecord));
  const stats = mk('div', 'end-stats');
  const rows = [
    ['💰 LOOT (GOLD)', String(game.player.gold)],
    ['🃏 CARDS PLAYED', String(game.stats.cardsPlayed)],
    ['⚔️ DAMAGE DEALT', String(game.stats.damageDealt)],
    ['🔁 TURNS', String(game.stats.turnsPlayed)],
    ['❤️ YOUR HP LEFT', `${game.player.hp} / ${game.player.maxHp}`],
    ['🐦 MAGPIES HP LEFT', `${game.rival.hp} / ${game.rival.maxHp}`],
  ];
  for (const [label, value] of rows) {
    const row = mk('div', 'stat-row');
    row.appendChild(mk('span', 'stat-label', label));
    row.appendChild(mk('span', 'stat-value', value));
    stats.appendChild(row);
  }
  panel.appendChild(stats);
  const againBtn = mk('button', 'play-btn', won ? '↻  PLAY AGAIN' : '↻  TRY AGAIN');
  againBtn.id = 'play-btn';
  panel.appendChild(againBtn);
  panel.appendChild(mk('div', 'title-foot', 'Press Space or click Play Again to run it back'));
  overlay.appendChild(panel);
  return overlay;
}

/** Little sound cues after a play, keyed off what just happened. */
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
