[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![make.fun rank](https://make.fun/badge/best-card-game-20261122-1826/emasinves0-commits/best-card-game-20261122-1826/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![make.fun reward](https://make.fun/badge/best-card-game-20261122-1826/emasinves0-commits/best-card-game-20261122-1826/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

# VAULTBREAKERS — Heist Card Duel

Two rival crews race to crack the same vault. You are the **VAULTBREAKERS**;
the rival crew is **THE MAGPIES**. A complete, original 1v1 card battler that
plays offline in a desktop browser from static files — no libraries, no
network, WebAudio synth sound effects only.

## How to play

Both crews have **30 HP**. Each turn you get **3 energy** and draw up to
**5 cards** from your 24-card deck. Click a card to play it (only if you can
afford its energy cost), then end your turn and watch the Magpies answer.

Four suits, told apart by colour **and** shape — never by text alone:

- **◆ CUT (red)** — damage. Crowbar, Drill, Thermite and friends hit the rival crew.
- **■ LOCK (blue)** — block. Safe Door, Riot Shield and Vault Seal absorb damage
  until the start of your next turn.
- **● COIN (gold)** — gold and draw. Gold Bar, Fence It and Stash fill your
  loot pile; gold is your score.
- **⚡ WIRE (purple)** — sabotage. Cut Lines, Jammer, Blackout and Static drain
  the rival's energy, force discards, or plant a bug that bites every turn.

**SUIT SURGE:** play two cards of the same suit in one turn and the second
one surges — CUT +3 damage, LOCK +4 block, COIN +3 gold and a draw, WIRE one
extra rival discard. Once per suit per turn; watch the COMBO meter.

**RIVAL INTENT:** the banner always shows what the Magpies plan next —
SMASH, FORTIFY, SABOTAGE or LOOT — and they play cards to match it. Read it
and counter it: block the smash, sabotage the loot, or race them to the vault.

**Winning:** drop the Magpies to 0 HP and the vault cracks — **VAULT
CRACKED!** — with your loot total, turns, cards played and a rating: CLEAN
(your HP 20+), LOUD (10–19) or SLOPPY (under 10). **Losing:** your HP hits 0
and you are **BUSTED!**, with your stats and a short taunt from the Magpies.

## Controls

- **Click a card** to play it · **1–5** quick-play
- **END TURN button or Space** to end your turn
- **M** mute · **Esc** back to the title screen
- Hover a card to raise it and read its effect

## Run it

Serve `game/` with any static server and open `index.html`:

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Or: `python3 -m http.server 8080` from inside `game/`.

The hand-in program is `main.ts` (Node 22, standard library only): it copies
`game/` and `screenshots/` to the output directory and writes
`dossier.json`. Try it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `main.ts` — the hand-in program (copies the game, writes the dossier)
- `game/index.html` — the page; `game/css/table.css` — the felt table
- `game/src/cards.js` — card definitions, deck build, seeded shuffle
- `game/src/game.js` — the rules: turns, energy, surge, damage/block/gold
- `game/src/ai.js` — the Magpies: readable intent + rival turns
- `game/src/render.js` — DOM rendering, HUD, banners, confetti
- `game/src/audio.js` — WebAudio synth sound effects
- `game/src/input.js` — mouse + keyboard
- `game/src/shots.js` — staged screenshot scenes (`?shot=`)
- `game/src/main.js` — boot + `?shot=` handling
- `screenshots/` — four real renders of the game (cover first)

Built for the [make.fun best card game bounty](https://make.fun/bounty/best-card-game-20261122-1826).
