// Midnight Ledger — the whole simulation step: movement, loot, vault cracking
// and its noise, tools, lasers, the alarm meter and lockdown, escape and tally.
// Pure logic: no DOM, no audio, no canvas — the headless suite drives this
// module directly, and the browser loop calls the same step 60 times a second.

import {
  TILE, STEP, THIEF, GUARD, ALARM, VAULT, LOOT_VALUE, TOOLS,
  PAR_SECONDS, TIME_BONUS_PER_SECOND, GHOST_BONUS, QUIET_BONUS,
  GHOST_PEAK, QUIET_PEAK,
} from './config.js';
import { FLOORS, parseMap, isSolidChar } from './levels.js';
import { tileCenter, tileOf, moveCircle, distToSegment } from './geometry.js';
import { createGuard, createCamera, updateGuard, updateCamera } from './guards.js';

/** Small seeded RNG (mulberry32) so a staged run replays exactly. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(floorIndex, seed = 1) {
  const floor = FLOORS[floorIndex];
  const parsed = parseMap(floor.map);
  const rng = mulberry32(seed * 7919 + floorIndex * 104729 + 13);
  const spawn = tileCenter(parsed.spawn.x, parsed.spawn.y);
  const lasers = floor.lasers.map((l) => ({
    ...l,
    axPx: l.ax * TILE + TILE / 2,
    ayPx: l.ay * TILE + TILE / 2,
    bxPx: l.bx * TILE + TILE / 2,
    byPx: l.by * TILE + TILE / 2,
    rearmT: 0,
  }));
  return {
    floorIndex,
    floor,
    grid: parsed.grid,
    loot: parsed.loot,
    vault: { ...parsed.vault, progress: 0, open: false },
    exit: parsed.exit,
    spawn: parsed.spawn,
    player: { x: spawn.x, y: spawn.y, facing: -Math.PI / 2, sneak: false, lootCount: 0 },
    guards: floor.patrols.map((wp) => createGuard(wp)),
    cameras: floor.cameras.map((def) => createCamera(def, rng)),
    lasers,
    clouds: [],
    decoy: null,
    empT: 0,
    noise: null, // {x, y, radius} — set while drilling, read by guards, cleared each step
    alarm: 0,
    peakAlarm: 0,
    lockdownT: 0,
    tools: {
      smoke: TOOLS.smoke.charges,
      emp: TOOLS.emp.charges[floorIndex],
      decoy: TOOLS.decoy.charges,
    },
    take: 0,
    time: 0,
    state: 'play', // play | busted | escaped
    drillT: 0,
    rng,
    seed,
  };
}

/** Is the thief's tile next to the vault (so the dial can be cracked)? */
function adjacentToVault(world) {
  const p = tileOf(world.player.x, world.player.y);
  return Math.abs(p.x - world.vault.x) <= 1 && Math.abs(p.y - world.vault.y) <= 1;
}

function onExitTile(world) {
  const p = tileOf(world.player.x, world.player.y);
  return p.x === world.exit.x && p.y === world.exit.y;
}

function laserActive(world, laser) {
  if (world.empT > 0) return false;
  if (laser.rearmT > 0) return false;
  if (laser.blink) {
    const cycle = laser.blink.on + laser.blink.off;
    if ((world.time % cycle) >= laser.blink.on) return false;
  }
  return true;
}

/**
 * One fixed step. `input` is { mx, my, sneak, interactHeld, interactPressed,
 * smokePressed, empPressed, decoyPressed, mouseTile }. Returns event strings
 * (status-line narration + sound triggers) for this step.
 */
export function stepWorld(world, input, dt = STEP) {
  const events = [];
  if (world.state !== 'play') return events;
  world.time += dt;
  const { player, grid } = world;

  // --- timers ---
  if (world.empT > 0) world.empT -= dt;
  for (const c of world.clouds) c.t -= dt;
  world.clouds = world.clouds.filter((c) => c.t > 0);
  if (world.decoy) {
    world.decoy.t -= dt;
    if (world.decoy.t <= 0) world.decoy = null;
  }
  for (const l of world.lasers) if (l.rearmT > 0) l.rearmT -= dt;

  // --- movement: WASD/arrows, Shift sneaks ---
  player.sneak = !!input.sneak;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  if (len > 0.01) {
    const speed = player.sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const moved = moveCircle(grid, player.x, player.y, THIEF.radius, mx * speed * dt, my * speed * dt);
    player.x = moved.x;
    player.y = moved.y;
    player.facing = Math.atan2(my, mx);
  }

  // --- tools: fresh presses only, charges per floor ---
  if (input.smokePressed) {
    if (world.tools.smoke > 0) {
      world.tools.smoke--;
      world.clouds.push({ x: player.x, y: player.y, r: TOOLS.smoke.radius, t: TOOLS.smoke.seconds });
      events.push('smoke');
    } else events.push('tool-empty');
  }
  if (input.empPressed) {
    if (world.tools.emp > 0) {
      world.tools.emp--;
      world.empT = TOOLS.emp.seconds;
      events.push('emp');
    } else events.push('tool-empty');
  }
  if (input.decoyPressed) {
    const tile = input.mouseTile;
    if (!tile || isSolidChar(world.grid[tile.y]?.[tile.x] ?? '#')) {
      events.push('decoy-refused'); // refused, unspent
    } else if (world.tools.decoy > 0) {
      world.tools.decoy--;
      const c = tileCenter(tile.x, tile.y);
      world.decoy = { x: c.x, y: c.y, t: TOOLS.decoy.stareSeconds };
      events.push('decoy');
    } else events.push('tool-empty');
  }

  // --- loose loot: walk over it to take it ---
  for (const item of world.loot) {
    if (item.taken) continue;
    const c = tileCenter(item.x, item.y);
    if (Math.hypot(player.x - c.x, player.y - c.y) < 24) {
      item.taken = true;
      world.take += LOOT_VALUE[item.kind];
      player.lootCount++;
      events.push(`loot:${item.kind}`);
    }
  }

  // --- the vault: hold interact beside it; drilling is loud ---
  world.noise = null;
  if (!world.vault.open && adjacentToVault(world) && input.interactHeld) {
    world.vault.progress += dt / world.floor.crackSeconds;
    world.drillT += dt;
    if (world.drillT >= VAULT.noiseEvery) {
      world.drillT -= VAULT.noiseEvery;
      const vc = tileCenter(world.vault.x, world.vault.y);
      world.noise = { x: vc.x, y: vc.y, radius: VAULT.noiseRadius };
      events.push('drill');
    }
    if (world.vault.progress >= 1) {
      world.vault.open = true;
      world.vault.progress = 1;
      world.take += world.floor.vaultValue;
      events.push('vault-open');
    }
  } else if (world.vault.progress > 0 && world.vault.progress < 1) {
    world.drillT = 0; // progress persists if interrupted; the noise clock resets
  }

  // --- lasers: crossing an active beam bites instantly, per-beam re-arm ---
  for (const laser of world.lasers) {
    if (!laserActive(world, laser)) continue;
    if (distToSegment(player.x, player.y, laser.axPx, laser.ayPx, laser.bxPx, laser.byPx) < 16) {
      world.alarm = Math.min(100, world.alarm + ALARM.laserHit);
      laser.rearmT = ALARM.laserRearm;
      events.push('laser');
    }
  }

  // --- watchers ---
  for (const g of world.guards) {
    for (const e of updateGuard(g, world, dt)) {
      if (e === 'caught') {
        world.state = 'busted';
        events.push('caught');
      } else events.push(e);
    }
  }
  for (const c of world.cameras) {
    for (const e of updateCamera(c, world, dt, world.time)) {
      if (e === 'camera-call') {
        world.alarm = Math.min(100, world.alarm + ALARM.cameraCallIn);
        events.push('camera-call');
      } else events.push(e);
    }
  }
  world.noise = null;

  // --- the alarm meter: guard heat feeds it, it falls when nobody is warm ---
  let hottest = 0;
  for (const g of world.guards) hottest = Math.max(hottest, g.heat);
  if (hottest > ALARM.guardWarmAt) {
    world.alarm = Math.min(100, world.alarm + ALARM.guardRate * hottest * dt);
  } else if (world.lockdownT <= 0) {
    world.alarm = Math.max(0, world.alarm - ALARM.decay * dt);
  }
  world.peakAlarm = Math.max(world.peakAlarm, world.alarm);

  // --- lockdown: at 100 the meter becomes a 10-second countdown ---
  if (world.alarm >= 100 && world.lockdownT <= 0) {
    world.lockdownT = ALARM.lockdownSeconds;
    events.push('lockdown');
  }
  if (world.lockdownT > 0) {
    world.lockdownT -= dt;
    if (world.lockdownT <= 0) {
      world.lockdownT = 0;
      world.state = 'busted';
      events.push('lockdown-caught');
    }
  }

  // --- escape: stand on the exit tile and press interact — even mid-lockdown ---
  if (input.interactPressed && onExitTile(world)) {
    world.state = 'escaped';
    events.push('escaped');
  }
  return events;
}

/** The floor tally once the thief slips out: take, stealth label, time bonus. */
export function floorTally(world, runningTotal) {
  const timeBonus = Math.max(0, Math.round((PAR_SECONDS[world.floorIndex] - world.time) * TIME_BONUS_PER_SECOND));
  const label = world.peakAlarm < GHOST_PEAK ? 'GHOST' : world.peakAlarm < QUIET_PEAK ? 'QUIET' : 'LOUD';
  const bonus = label === 'GHOST' ? GHOST_BONUS : label === 'QUIET' ? QUIET_BONUS : 0;
  const total = runningTotal + world.take + timeBonus + bonus;
  return { take: world.take, time: world.time, timeBonus, label, bonus, total };
}
