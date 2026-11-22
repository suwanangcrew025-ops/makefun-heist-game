// Midnight Ledger — the geometry every other module stands on:
// tile solidity for bodies vs sight, line of sight, cone tests (smoke-aware),
// axis-separated circle collision, and point-to-segment distance.

import { TILE, COLS, ROWS } from './config.js';
import { blocksSightChar, isSolidChar } from './levels.js';

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function tileOf(px, py) {
  return {
    x: Math.max(0, Math.min(COLS - 1, Math.floor(px / TILE))),
    y: Math.max(0, Math.min(ROWS - 1, Math.floor(py / TILE))),
  };
}

function charAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return grid[ty][tx];
}

export function isSolid(grid, tx, ty) {
  return isSolidChar(charAt(grid, tx, ty));
}

export function blocksSight(grid, tx, ty) {
  return blocksSightChar(charAt(grid, tx, ty));
}

/** True when the segment between two points crosses a smoke cloud — unless
 *  the watcher or the target is standing inside that cloud. */
function smokeBlocks(clouds, x0, y0, x1, y1) {
  for (const c of clouds) {
    const d0 = Math.hypot(x0 - c.x, y0 - c.y);
    const d1 = Math.hypot(x1 - c.x, y1 - c.y);
    if (d0 < c.r || d1 < c.r) continue; // inside the cloud, sight still works
    if (distToSegment(c.x, c.y, x0, y0, x1, y1) < c.r) return true;
  }
  return false;
}

/**
 * Fine-stepped ray walk between two points. Ignores the watcher's own tile and
 * the target's tile, so a wall-mounted camera's cone never self-occludes and a
 * guard standing next to a desk can still see past it.
 */
export function losClear(grid, x0, y0, x1, y1, clouds = []) {
  const home = tileOf(x0, y0);
  const target = tileOf(x1, y1);
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const tile = tileOf(px, py);
    if (tile.x === home.x && tile.y === home.y) continue;
    if (tile.x === target.x && tile.y === target.y) continue;
    if (blocksSight(grid, tile.x, tile.y)) return false;
  }
  if (clouds.length && smokeBlocks(clouds, x0, y0, x1, y1)) return false;
  return true;
}

/** Is the target inside the watcher's cone (range + half-angle), with clear sight? */
export function inCone(grid, wx, wy, facing, range, halfAngle, tx, ty, clouds = []) {
  const dx = tx - wx;
  const dy = ty - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  let diff = Math.atan2(dy, dx) - facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > halfAngle) return false;
  return losClear(grid, wx, wy, tx, ty, clouds);
}

/** Shortest distance from a point to a segment. */
export function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Move a circle against solid tiles, one axis at a time, so it slides along
 * walls instead of sticking in corners. Returns the new position.
 */
export function moveCircle(grid, x, y, radius, dx, dy) {
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    const testX = nx + dx;
    const top = Math.floor((ny - radius) / TILE);
    const bottom = Math.floor((ny + radius) / TILE);
    const edge = dx > 0 ? Math.floor((testX + radius) / TILE) : Math.floor((testX - radius) / TILE);
    let blocked = false;
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(grid, edge, ty)) { blocked = true; break; }
    }
    if (!blocked) nx = testX;
  }
  if (dy !== 0) {
    const testY = ny + dy;
    const left = Math.floor((nx - radius) / TILE);
    const right = Math.floor((nx + radius) / TILE);
    const edge = dy > 0 ? Math.floor((testY + radius) / TILE) : Math.floor((testY - radius) / TILE);
    let blocked = false;
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(grid, tx, edge)) { blocked = true; break; }
    }
    if (!blocked) ny = testY;
  }
  return { x: nx, y: ny };
}

/** March a cone's edge ray until it hits a sight-blocking tile or the range ends.
 *  The watcher's home tile is skipped, so wall-mounted cameras render a cone. */
export function coneRay(grid, wx, wy, angle, range) {
  const home = tileOf(wx, wy);
  const step = 4;
  let d = step;
  while (d < range) {
    const px = wx + Math.cos(angle) * d;
    const py = wy + Math.sin(angle) * d;
    const tile = tileOf(px, py);
    if (!(tile.x === home.x && tile.y === home.y) && blocksSight(grid, tile.x, tile.y)) {
      return { x: px, y: py, dist: d };
    }
    d += step;
  }
  return { x: wx + Math.cos(angle) * range, y: wy + Math.sin(angle) * range, dist: range };
}
