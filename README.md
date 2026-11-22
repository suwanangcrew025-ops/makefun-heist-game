[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/suwanangcrew025-ops/makefun-heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/suwanangcrew025-ops/makefun-heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

# Midnight Ledger

**Midnight Ledger: crack the vaults of the Aurelia Grand Bank under the cones — a top-down stealth heist in three floors. Built by an AI agent for make.fun's "Make the best heist game" bounty, $50 in USDC.**

You are Wren, a thief emptying the fictional Aurelia Grand Bank across three
floors in one night. Every frame shows the whole job in one view: the room you
are crossing, guards with vision cones, sweeping cameras, a loot target, and
the alarm meter that decides whether the night ends in a getaway or a lockdown.

## How it plays

- **Move** with WASD or the arrow keys. **Shift** sneaks — slower, but guards
  fill with suspicion 45% slower. **E** (or F, or Space) interacts: hold it
  beside a vault to crack the dial, press it on the exit door to slip out.
- **Guards** see in amber cones. At half suspicion they stop and stare ("?");
  at full heat they chase ("!"), faster than a sneak, slightly slower than a
  run. Lose them for three seconds and they search where they last saw you.
- **Cameras** sweep pale-cyan cones; a full camera phones the alarm in (+25).
- **Lasers** guard the mid-gaps on floors 2 and 3 (+34 a crossing; the third
  beam on floor 3 blinks — time it).
- **The alarm meter** rises only from guard heat and falls when nobody is
  warm. At 100 the bank locks down for 10 seconds — reach the exit in time
  or the doors seal.
- **Tools, limited per floor:** **Z** smoke pellet (blocks every sight line
  through the cloud), **X** EMP pulse (cameras and lasers blind for 6s),
  **C** decoy coin (tossed to the mouse tile; nearby guards go stare at it).
- **The vault** pays 1200 / 1800 / 3000 — the Aurelia Star on floor 3 is the
  big score — but drilling is loud: guards nearby walk over to investigate.
- **Scoring:** cash 100, gem 250, gold 400; Ghost (+500) for a peak alarm
  under 60, Quiet (+250) under 85; 10/second under par. Escape all three
  floors and the finale names your underworld rank — "THE GHOST OF AURELIA"
  at 11,500 and above. Your best total is kept in the browser.

**P** (or Esc) pauses, **M** mutes. A screen-reader-live status line narrates
every state change. All sound is synthesized live with WebAudio — no audio
files, no network, no libraries.

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open the page in desktop Chrome and press Enter. Or hand it in:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshots

Four real renders of the game's own code, staged in `?shot=` mode
(see `shots.json` and `game/src/shots.js`):

1. **Cover** — the lobby idles under the title, guards on patrol.
2. **Crossing** — the thief slips up the column-12 gap for the top-middle gem.
3. **Vault** — floor 3, the drill at 65% on the Aurelia Star as a guard closes in.
4. **Getaway** — floor 2, on the exit tile in full lockdown, the corridor guard in chase.

## Layout

- `main.ts` — hand-in: copies `game/` + `screenshots/` to the output and
  writes `dossier.json` via the vendored make.fun builder.
- `serve.ts` — tiny static server for local play.
- `shots.json` — the four screenshot scenes.
- `game/index.html` — canvas + hidden status line + one module script.
- `game/src/` — one job per file: `config` (every balance number and colour),
  `levels` (three floors: maps, patrol loops, camera posts, laser spans),
  `geometry` (solidity, line of sight, cone tests, collision),
  `guards` (guard state machine, camera updates, decoy distraction),
  `world` (the whole simulation step, seeded RNG),
  `audio` (WebAudio synth), `input` (keys, fresh-press bits, mouse),
  `render` (everything drawn), `shots` (screenshot staging),
  `main` (boot, fixed-step loop, screen flow).
- `vendor/makefun-game.ts` — copied unchanged from the make.fun kit.
