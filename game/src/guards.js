// Midnight Ledger — the watchers: guards (a small state machine) and cameras.
//
// Guard states: patrol (waypoint loop, short scanning pause at each node) ->
// stare (heat >= 0.45: stops, faces the thief) -> chase (heat 1: faster than a
// sneak, slightly slower than a run; remembers the last seen spot 3s) ->
// search (looks where the thief was last seen) -> return (walks back to its
// loop). Vault-drilling noise and decoy coins pull a guard into investigate /
// decoy-stare instead. A camera sweeps its cone; at full heat it "phones it in".

import { TILE, GUARD, CAMERA, HEAT, TOOLS, ALARM } from './config.js';
import { inCone, tileCenter, moveCircle } from './geometry.js';

export function createGuard(waypoints) {
  const start = tileCenter(waypoints[0][0], waypoints[0][1]);
  const next = tileCenter(waypoints[1][0], waypoints[1][1]);
  return {
    kind: 'guard',
    x: start.x,
    y: start.y,
    facing: Math.atan2(next.y - start.y, next.x - start.x),
    waypoints,
    wpIndex: 1,
    state: 'patrol', // patrol | stare | chase | search | investigate | decoy | return
    pauseT: 0,
    scanT: 0,
    heat: 0,
    lostT: 0,
    lastSeen: null,
    lookT: 0,
    target: null, // {x, y} for investigate
    decoyT: 0,
    speed: GUARD.patrolSpeed,
  };
}

export function createCamera(def, rng = Math.random) {
  const pos = tileCenter(def.tx, def.ty);
  return {
    kind: 'camera',
    x: pos.x,
    y: pos.y,
    tileX: def.tx,
    tileY: def.ty,
    base: def.base,
    sweep: def.sweep,
    facing: def.base,
    heat: 0,
    callCooldown: 0,
    blindT: 0,
    phase: rng() * Math.PI * 2,
  };
}

/** Step toward a point, sliding along walls like the thief does — a guard
 *  never walks through a wall, even in a chase. Returns true on arrival. */
function moveToward(g, grid, tx, ty, speed, dt) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  const moved = moveCircle(grid, g.x, g.y, GUARD.radius, (dx / dist) * step, (dy / dist) * step);
  const movedDist = Math.hypot(moved.x - g.x, moved.y - g.y);
  g.x = moved.x;
  g.y = moved.y;
  if (movedDist > 0.01) g.facing = Math.atan2(dy, dx);
  return dist - step < 4;
}

function angleLerp(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * One guard's step. `world` carries the grid, the thief, smoke clouds, the
 * decoy, and a `noise` pulse ({x, y, radius} or null) from vault drilling.
 * Returns event strings for the status line and sounds.
 */
export function updateGuard(g, world, dt) {
  const events = [];
  const { grid, player, clouds } = world;
  const distToPlayer = Math.hypot(player.x - g.x, player.y - g.y);

  // --- vision: heat fills while the thief is in the cone with clear sight ---
  // (EMP blinds cameras and lasers, never a guard's eyes.)
  const seen = g.state !== 'decoy' &&
    inCone(grid, g.x, g.y, g.facing, GUARD.coneRange, GUARD.coneHalfAngle, player.x, player.y, clouds);
  if (seen) {
    const falloff = 1 - HEAT.distanceFalloff * Math.min(1, distToPlayer / GUARD.coneRange);
    const rate = HEAT.fillPointBlank * falloff * (player.sneak ? HEAT.sneakFactor : 1);
    g.heat = Math.min(1, g.heat + rate * dt);
    g.lastSeen = { x: player.x, y: player.y };
    g.lostT = 0;
  } else {
    g.heat = Math.max(0, g.heat - HEAT.decay * dt);
  }

  // --- the decoy coin: nearby guards who are not chasing go stare at it ---
  const decoy = world.decoy;
  if (decoy && g.state !== 'chase' && g.state !== 'decoy' &&
      Math.hypot(decoy.x - g.x, decoy.y - g.y) <= TOOLS.decoy.radius) {
    g.state = 'decoy';
    g.decoyT = TOOLS.decoy.stareSeconds;
    g.target = { x: decoy.x, y: decoy.y };
  }
  if (g.state === 'decoy') {
    g.heat = Math.min(g.heat, 0.2); // heat stays capped low while distracted
    g.facing = angleLerp(g.facing, Math.atan2(g.target.y - g.y, g.target.x - g.x), Math.min(1, dt * 8));
    g.decoyT -= dt;
    if (g.decoyT <= 0) { g.state = 'return'; g.target = null; }
    return events;
  }

  // --- drilling noise: guards nearby who are not chasing walk to the vault ---
  if (world.noise && g.state !== 'chase' && g.state !== 'investigate' &&
      Math.hypot(world.noise.x - g.x, world.noise.y - g.y) <= world.noise.radius) {
    g.state = 'investigate';
    g.target = { x: world.noise.x, y: world.noise.y };
    g.lookT = 0;
  }

  switch (g.state) {
    case 'patrol': {
      if (g.heat >= HEAT.stareAt) {
        g.state = 'stare';
        events.push('guard-suspicious');
        break;
      }
      const wp = tileCenter(g.waypoints[g.wpIndex][0], g.waypoints[g.wpIndex][1]);
      if (g.pauseT > 0) {
        // Scanning pause: facing sweeps either side of the travel direction.
        g.pauseT -= dt;
        g.scanT += dt;
        g.facing += Math.sin(g.scanT * 4) * GUARD.scanSweep * dt * 2;
        if (g.pauseT <= 0) g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
      } else if (moveToward(g, grid, wp.x, wp.y, GUARD.patrolSpeed, dt)) {
        g.pauseT = GUARD.pauseAtNode;
        g.scanT = 0;
      }
      break;
    }
    case 'stare': {
      g.facing = angleLerp(g.facing, Math.atan2(player.y - g.y, player.x - g.x), Math.min(1, dt * 10));
      if (g.heat >= HEAT.chaseAt) {
        g.state = 'chase';
        g.lostT = 0;
        events.push('guard-chase');
      } else if (g.heat < HEAT.stareRelease) {
        g.state = 'patrol';
      }
      break;
    }
    case 'chase': {
      if (seen) g.lastSeen = { x: player.x, y: player.y };
      else g.lostT += dt;
      const dest = seen ? { x: player.x, y: player.y } : g.lastSeen;
      moveToward(g, grid, dest.x, dest.y, GUARD.chaseSpeed, dt);
      if (Math.hypot(player.x - g.x, player.y - g.y) <= GUARD.catchDistance) {
        events.push('caught');
      } else if (g.lostT >= GUARD.memorySeconds) {
        g.state = 'search';
        g.lookT = 0;
      }
      break;
    }
    case 'search': {
      if (g.lastSeen && moveToward(g, grid, g.lastSeen.x, g.lastSeen.y, GUARD.searchSpeed, dt)) {
        g.lookT += dt;
        g.facing += dt * 2.2; // slow turning look
        if (g.lookT > 2) { g.state = 'return'; g.lastSeen = null; }
      }
      if (g.heat >= HEAT.chaseAt) { g.state = 'chase'; g.lostT = 0; }
      break;
    }
    case 'investigate': {
      if (g.heat >= HEAT.chaseAt) { g.state = 'chase'; g.lostT = 0; events.push('guard-chase'); break; }
      if (g.target && moveToward(g, grid, g.target.x, g.target.y, GUARD.investigateSpeed, dt)) {
        g.lookT += dt;
        g.facing += dt * 1.6;
        if (g.lookT > 1.5) { g.state = 'return'; g.target = null; }
      }
      break;
    }
    case 'return': {
      // Walk back to the nearest waypoint, then resume the loop from there.
      let best = 0;
      let bestDist = Infinity;
      g.waypoints.forEach((wp, i) => {
        const c = tileCenter(wp[0], wp[1]);
        const d = Math.hypot(c.x - g.x, c.y - g.y);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      const wp = tileCenter(g.waypoints[best][0], g.waypoints[best][1]);
      if (moveToward(g, grid, wp.x, wp.y, GUARD.returnSpeed, dt)) {
        g.wpIndex = (best + 1) % g.waypoints.length;
        g.state = 'patrol';
        g.pauseT = 0;
      }
      if (g.heat >= HEAT.stareAt) { g.state = 'stare'; events.push('guard-suspicious'); }
      break;
    }
    default:
      break;
  }
  return events;
}

/**
 * One camera's step. Sweeps its cone around its base facing; at full heat it
 * phones the alarm in (+25) and resets with a call cooldown. EMP blinds it.
 */
export function updateCamera(c, world, dt, time) {
  const events = [];
  if (c.blindT > 0) c.blindT -= dt;
  if (c.callCooldown > 0) c.callCooldown -= dt;
  c.facing = c.base + c.sweep * Math.sin(time * CAMERA.sweepSpeed + c.phase);
  if (world.empT > 0 || c.blindT > 0) {
    c.heat = Math.max(0, c.heat - HEAT.decay * dt);
    return events;
  }
  const { grid, player, clouds } = world;
  const seen = inCone(grid, c.x, c.y, c.facing, CAMERA.range, CAMERA.halfAngle, player.x, player.y, clouds);
  if (seen) {
    const dist = Math.hypot(player.x - c.x, player.y - c.y);
    const falloff = 1 - HEAT.distanceFalloff * Math.min(1, dist / CAMERA.range);
    const rate = HEAT.fillPointBlank * falloff * (player.sneak ? HEAT.sneakFactor : 1);
    c.heat = Math.min(1, c.heat + rate * dt);
  } else {
    c.heat = Math.max(0, c.heat - HEAT.decay * dt);
  }
  if (c.heat >= 1 && c.callCooldown <= 0) {
    c.heat = ALARM.cameraResetHeat;
    c.callCooldown = ALARM.cameraCallCooldown;
    events.push('camera-call');
  }
  return events;
}
