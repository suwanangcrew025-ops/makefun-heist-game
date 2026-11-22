// Midnight Ledger — screenshot staging for ?shot= mode.
// Each scene resets a chosen floor and plays the real rules forward at the
// fixed step with a small autopilot walking the thief between tile centers:
// one dominant axis per step, arrival radius 8px, per-axis deadzone 3px
// (a 5px deadzone with a 6px arrival radius deadlocks on diagonals — this
// pairing does not). Staging never fakes a frame: every pixel on screen is
// the game simulating itself, except the two states the rules themselves
// produce at that moment, which the scene sets directly (alarm 34 after a
// camera glance; alarm 100 with a lockdown countdown at the exit).

import { STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { tileCenter } from './geometry.js';

export const BLANK_INPUT = {
  mx: 0, my: 0, sneak: false,
  interactHeld: false, interactPressed: false,
  smokePressed: false, empPressed: false, decoyPressed: false,
  mouseTile: null,
};

function runSteps(world, count, inputFn) {
  for (let i = 0; i < count; i++) {
    const input = inputFn ? inputFn(i) : { ...BLANK_INPUT };
    stepWorld(world, input);
    if (world.state !== 'play') return false;
  }
  return true;
}

function waitSeconds(world, seconds) {
  return runSteps(world, Math.round(seconds / STEP));
}

/** One autopilot step toward a tile center; null when arrived.
 *  Single dominant axis per step, arrival radius 8px, per-axis deadzone 3px.
 *  (A 5px deadzone with a 6px arrival radius deadlocks on diagonals — this
 *  pairing does not.) Centring is NOT done here: pushing sideways into a wall
 *  row deadlocks the walk, so walkTo below nudges sideways only after the
 *  dominant axis proves itself blocked. */
export function autoInput(world, tx, ty, opts = {}) {
  const c = tileCenter(tx, ty);
  const dx = c.x - world.player.x;
  const dy = c.y - world.player.y;
  if (Math.hypot(dx, dy) < 8) return null;
  let mx = 0;
  let my = 0;
  if (Math.abs(dx) > Math.abs(dy)) {
    mx = Math.abs(dx) < 3 ? 0 : Math.sign(dx);
    if (mx === 0) my = Math.abs(dy) < 3 ? 0 : Math.sign(dy);
  } else {
    my = Math.abs(dy) < 3 ? 0 : Math.sign(dy);
    if (my === 0) mx = Math.abs(dx) < 3 ? 0 : Math.sign(dx);
  }
  return { ...BLANK_INPUT, mx, my, sneak: !!opts.sneak };
}

/** Walk to a tile center with the autopilot; false on timeout or trouble.
 *  If the dominant axis makes no progress for 15 steps (a wall, a desk, or
 *  a one-tile gap the thief entered off-centre), the walk nudges sideways
 *  toward the target's line until centred, then resumes.
 *  Options: sneak (walk quietly until a chase starts, then run), and
 *  smokeOnChase (toss one smoke pellet once a chase has run a while, so the
 *  alarm has time to build before the cloud breaks the guard's sight). */
export function walkTo(world, tx, ty, opts = {}) {
  const maxSteps = Math.round((opts.timeout ?? 40) / STEP);
  let lastX = world.player.x;
  let lastY = world.player.y;
  let stall = 0;
  let nudging = 0;
  let chaseT = 0;
  let smoked = false;
  for (let i = 0; i < maxSteps; i++) {
    const chasing = world.guards.some((g) => g.state === 'chase');
    const input = autoInput(world, tx, ty, { sneak: opts.sneak && !chasing });
    if (!input) return true;
    const c = tileCenter(tx, ty);
    const dx = c.x - world.player.x;
    const dy = c.y - world.player.y;
    let useInput = input;
    if (nudging > 0) {
      // Step sideways toward the target's line to unstick a blocked axis.
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dy) < 3) nudging = 0;
        else useInput = { ...BLANK_INPUT, mx: 0, my: Math.sign(dy), sneak: !!opts.sneak && !chasing };
      } else {
        if (Math.abs(dx) < 3) nudging = 0;
        else useInput = { ...BLANK_INPUT, mx: Math.sign(dx), my: 0, sneak: !!opts.sneak && !chasing };
      }
      if (nudging > 0) nudging--;
    }
    if (opts.smokeOnChase && chasing && !smoked && world.tools.smoke > 0) {
      chaseT += STEP;
      if (chaseT >= 1.5) {
        useInput = { ...useInput, smokePressed: true };
        smoked = true;
      }
    } else if (!chasing) {
      chaseT = 0;
    }
    stepWorld(world, useInput);
    if (world.state !== 'play') return false;
    const moved = Math.hypot(world.player.x - lastX, world.player.y - lastY);
    if (moved < 0.1) stall++;
    else stall = 0;
    if (stall >= 15 && nudging === 0) { nudging = 24; stall = 0; }
    lastX = world.player.x;
    lastY = world.player.y;
  }
  return false;
}

function placeThief(world, tx, ty) {
  const c = tileCenter(tx, ty);
  world.player.x = c.x;
  world.player.y = c.y;
}

function placeGuard(world, index, tx, ty, facing) {
  const g = world.guards[index];
  const c = tileCenter(tx, ty);
  g.x = c.x;
  g.y = c.y;
  g.facing = facing;
  g.state = 'patrol';
  g.heat = 0;
  g.pauseT = 0;
}

// Scene 1 — cover: floor 1 idled 4s, title over the live lobby.
function shotCover() {
  const world = createWorld(0, 1);
  placeThief(world, 1, 1); // a quiet corner: no patrol comes here
  waitSeconds(world, 4);
  return { world, screen: 'title' };
}

// Scene 2 — crossing: wait 4.2s at spawn (the top guard commits to the far
// lane), walk up the column-12 gap, take the top-middle gem, idle a breath,
// then set the alarm to 34 — a state the rules reach via a camera glance.
function shotCrossing() {
  const world = createWorld(0, 1);
  waitSeconds(world, 4.2);
  if (!walkTo(world, 12, 8)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 12, 6)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 12, 2)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 10, 2)) return { world, screen: 'play', ok: false };
  waitSeconds(world, 0.5);
  world.alarm = 34;
  world.peakAlarm = 34;
  return { world, screen: 'play', ok: true };
}

// Scene 3 — vault: floor 3. Sprint the corridor (the corridor guard starts
// 320px behind and never closes), drop to the vault room via the row-10 lane
// — NOT row 9, a plant at (19,9) blocks it — and hold the drill 2.6s of the
// 4s crack: the ring sits at 65%, and the drill noise pulls the vault-room
// guard in to investigate.
function shotVault() {
  const world = createWorld(2, 1);
  placeThief(world, 10, 7);
  placeGuard(world, 0, 2, 7, 0); // corridor guard, 320px behind, heading east
  world.guards[0].wpIndex = 1;
  if (!walkTo(world, 20, 7)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 20, 8)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 20, 10)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 21, 10)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 21, 11)) return { world, screen: 'play', ok: false };
  runSteps(world, Math.round(2.6 / STEP), () => ({ ...BLANK_INPUT, interactHeld: true }));
  return { world, screen: 'play', ok: world.state === 'play' };
}

// Scene 4 — getaway: floor 2. Wait 4.5s (the top guard commits to the far
// lane — a 2.5s wait walks the thief straight into its southward leg), grab
// the top-middle gem (at column 10, not 11), return through the laser gap,
// cross the corridor behind the corridor guard's back, stand on the exit
// tile — then set the two states the rules produce at that moment: alarm 100
// with lockdown at 7.3s, and the corridor guard in chase with the thief's
// position as last-seen, facing toward the thief.
function shotGetaway() {
  const world = createWorld(1, 1);
  waitSeconds(world, 4.5);
  if (!walkTo(world, 12, 8)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 12, 6)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 12, 2)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 10, 2)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 12, 2)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 12, 6)) return { world, screen: 'play', ok: false }; // the laser gap
  if (!walkTo(world, 12, 7)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 4, 7)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 4, 8)) return { world, screen: 'play', ok: false }; // the column-4 gap
  if (!walkTo(world, 4, 9)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 4, 11)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 1, 11)) return { world, screen: 'play', ok: false };
  if (!walkTo(world, 1, 13)) return { world, screen: 'play', ok: false };
  world.alarm = 100;
  world.peakAlarm = 100;
  world.lockdownT = 7.3;
  const guard = world.guards[0]; // the corridor guard
  guard.state = 'chase';
  guard.heat = 1;
  guard.lastSeen = { x: world.player.x, y: world.player.y };
  guard.facing = Math.atan2(world.player.y - guard.y, world.player.x - guard.x);
  return { world, screen: 'play', ok: true };
}

/** Stage scene 1-4. Returns { world, screen, ok }. */
export function stageShot(n) {
  switch (n) {
    case 1: return shotCover();
    case 2: return shotCrossing();
    case 3: return shotVault();
    case 4: return shotGetaway();
    default: return shotCover();
  }
}
