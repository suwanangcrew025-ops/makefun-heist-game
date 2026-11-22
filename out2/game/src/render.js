// Midnight Ledger — everything drawn: the bank, the cones, the crew, the HUD,
// and every screen. Noir ink-and-brass: deep-navy marble, brass grid lines,
// slate walls with a lit top edge. Vision cones are ray-marched polygons
// against sight-blocking tiles — the march skips the watcher's home tile, so
// wall-mounted cameras draw a cone instead of self-occluding into nothing.

import { TILE, COLS, ROWS, W, H, PALETTE, FONT_DISPLAY, FONT_HUD, GUARD, CAMERA } from './config.js';
import { tileCenter, coneRay, tileOf } from './geometry.js';

function conePolygon(ctx, grid, wx, wy, facing, range, halfAngle, color) {
  const rays = 22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  for (let i = 0; i <= rays; i++) {
    const a = facing - halfAngle + (2 * halfAngle * i) / rays;
    const hit = coneRay(grid, wx, wy, a, range);
    ctx.lineTo(hit.x, hit.y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawFloor(ctx, world) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  ctx.strokeStyle = PALETTE.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); }
  for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * TILE); ctx.lineTo(W, y * TILE); }
  ctx.stroke();
}

function drawWallsAndCover(ctx, world, time) {
  const grid = world.grid;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (ch === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = PALETTE.wallEdge;
        ctx.fillRect(px, py, TILE, 3); // lit top edge
      } else if (ch === 'D') {
        ctx.fillStyle = PALETTE.desk;
        ctx.fillRect(px + 4, py + 5, TILE - 8, TILE - 10);
        ctx.fillStyle = PALETTE.deskTop;
        ctx.fillRect(px + 4, py + 5, TILE - 8, 4);
        ctx.fillStyle = PALETTE.lamp; // a lamp dot on the desk
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ch === 'P') {
        ctx.fillStyle = PALETTE.pot;
        ctx.fillRect(px + 12, py + 24, 16, 12);
        ctx.fillStyle = PALETTE.plant;
        ctx.beginPath();
        ctx.arc(px + 14, py + 16, 9, 0, Math.PI * 2);
        ctx.arc(px + 26, py + 14, 10, 0, Math.PI * 2);
        ctx.arc(px + 20, py + 24, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // The exit door: a brass-framed doorway that glows when the thief stands on it.
  const e = tileCenter(world.exit.x, world.exit.y);
  const onExit = tileOf(world.player.x, world.player.y).x === world.exit.x &&
    tileOf(world.player.x, world.player.y).y === world.exit.y;
  ctx.fillStyle = onExit ? '#7de8a0' : '#3f7a4a';
  ctx.fillRect(e.x - 16, e.y - 16, 32, 32);
  ctx.strokeStyle = PALETTE.vaultDial;
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x - 16, e.y - 16, 32, 32);
  ctx.fillStyle = '#10152a';
  ctx.font = `bold 9px ${FONT_HUD}`;
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', e.x, e.y + 3);
}

function drawLoot(ctx, world, time) {
  for (const item of world.loot) {
    if (item.taken) continue;
    const c = tileCenter(item.x, item.y);
    const twinkle = 0.65 + 0.35 * Math.sin(time * 3 + item.x * 1.7 + item.y);
    ctx.save();
    ctx.globalAlpha = twinkle;
    if (item.kind === 'cash') {
      ctx.fillStyle = PALETTE.cash;
      ctx.fillRect(c.x - 9, c.y - 5, 18, 10);
      ctx.fillStyle = '#2a7a4a';
      ctx.fillRect(c.x - 9, c.y - 1, 18, 2);
    } else if (item.kind === 'gem') {
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 10);
      ctx.lineTo(c.x + 8, c.y);
      ctx.lineTo(c.x, c.y + 10);
      ctx.lineTo(c.x - 8, c.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 10);
      ctx.lineTo(c.x + 8, c.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(c.x - 10, c.y + 2, 20, 6);
      ctx.fillRect(c.x - 7, c.y - 5, 14, 6);
      ctx.fillStyle = '#a87f1e';
      ctx.fillRect(c.x - 10, c.y + 2, 20, 2);
    }
    ctx.restore();
  }
}

function drawVault(ctx, world, time) {
  const v = world.vault;
  const c = tileCenter(v.x, v.y);
  ctx.fillStyle = PALETTE.vault;
  ctx.fillRect(c.x - 19, c.y - 19, 38, 38);
  ctx.fillStyle = v.open ? '#2a2118' : PALETTE.vaultDoor;
  ctx.fillRect(c.x - 15, c.y - 15, 30, 30);
  ctx.strokeStyle = PALETTE.vaultDial;
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x - 19, c.y - 19, 38, 38);
  if (!v.open) {
    // The rotating dial, and the progress ring while the thief drills.
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(time * 1.5);
    ctx.strokeStyle = PALETTE.vaultDial;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.restore();
    if (v.progress > 0) {
      ctx.strokeStyle = '#7de8a0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 24, -Math.PI / 2, -Math.PI / 2 + v.progress * Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 11px ${FONT_HUD}`;
    ctx.textAlign = 'center';
    ctx.fillText('OPEN', c.x, c.y + 4);
  }
}

function drawLasers(ctx, world, time) {
  for (const l of world.lasers) {
    // Emitter blocks on the two wall tiles flanking the gap.
    for (const [tx, ty] of [[l.ax, l.ay], [l.bx, l.by]]) {
      ctx.fillStyle = PALETTE.emitter;
      ctx.fillRect(tx * TILE + 6, ty * TILE + 6, TILE - 12, TILE - 12);
      ctx.fillStyle = PALETTE.laser;
      ctx.beginPath();
      ctx.arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const active = world.empT <= 0 && (!l.blink || (time % (l.blink.on + l.blink.off)) < l.blink.on);
    if (!active) continue;
    const blinkAlpha = l.blink ? 0.55 + 0.45 * Math.sin(time * 10) : 1;
    ctx.save();
    ctx.globalAlpha = blinkAlpha;
    ctx.strokeStyle = PALETTE.laser;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.laser;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(l.axPx, l.ayPx);
    ctx.lineTo(l.bxPx, l.byPx);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCones(ctx, world) {
  for (const g of world.guards) {
    const hot = g.heat >= 0.45;
    conePolygon(ctx, world.grid, g.x, g.y, g.facing, GUARD.coneRange, GUARD.coneHalfAngle,
      hot ? PALETTE.coneHot : PALETTE.cone);
  }
  for (const c of world.cameras) {
    if (world.empT > 0 || c.blindT > 0) continue;
    const hot = c.heat >= 0.45;
    conePolygon(ctx, world.grid, c.x, c.y, c.facing, CAMERA.range, CAMERA.halfAngle,
      hot ? PALETTE.cameraConeHot : PALETTE.cameraCone);
  }
}

function drawSmoke(ctx, world) {
  for (const c of world.clouds) {
    ctx.fillStyle = PALETTE.smoke;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220, 225, 235, 0.35)';
    ctx.beginPath();
    ctx.arc(c.x - 18, c.y + 8, c.r * 0.5, 0, Math.PI * 2);
    ctx.arc(c.x + 20, c.y - 10, c.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWatchers(ctx, world) {
  for (const c of world.cameras) {
    ctx.fillStyle = '#20242f';
    ctx.fillRect(c.x - 7, c.y - 7, 14, 14);
    ctx.fillStyle = world.empT > 0 || c.blindT > 0 ? '#555' : (c.heat >= 0.45 ? PALETTE.alarmRed : '#8fd8ea');
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const g of world.guards) {
    // Slate-blue figure, pale cap brim pointing where he faces.
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3550';
    ctx.lineWidth = 2;
    ctx.stroke();
    const bx = g.x + Math.cos(g.facing) * 13;
    const by = g.y + Math.sin(g.facing) * 13;
    ctx.strokeStyle = PALETTE.guardCap;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(g.x + Math.cos(g.facing) * 6, g.y + Math.sin(g.facing) * 6);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // "?" while staring, red "!" while chasing — plus a heat bar overhead.
    ctx.textAlign = 'center';
    if (g.state === 'chase') {
      ctx.fillStyle = PALETTE.alarmRed;
      ctx.font = `bold 18px ${FONT_HUD}`;
      ctx.fillText('!', g.x, g.y - 18);
    } else if (g.state === 'stare' || g.heat >= 0.45) {
      ctx.fillStyle = '#f2d06a';
      ctx.font = `bold 16px ${FONT_HUD}`;
      ctx.fillText('?', g.x, g.y - 18);
    }
    if (g.heat > 0.05) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(g.x - 12, g.y - 30, 24, 4);
      ctx.fillStyle = g.heat >= 0.45 ? PALETTE.alarmRed : '#f2b24a';
      ctx.fillRect(g.x - 12, g.y - 30, 24 * g.heat, 4);
    }
  }
}

function drawThief(ctx, world, time) {
  const p = world.player;
  const bagR = 6 + Math.min(6, p.lootCount); // the swag bag visibly swells with each take
  const bx = p.x - Math.cos(p.facing) * 15;
  const by = p.y - Math.sin(p.facing) * 15;
  ctx.fillStyle = PALETTE.bag;
  ctx.beginPath();
  ctx.arc(bx, by, bagR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thiefTrim;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Pale face offset toward the facing, so the thief reads as looking ahead.
  ctx.fillStyle = PALETTE.face;
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.facing) * 5, p.y + Math.sin(p.facing) * 5, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (p.sneak) {
    ctx.strokeStyle = 'rgba(238, 241, 245, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawDecoy(ctx, world) {
  if (!world.decoy) return;
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(world.decoy.x, world.decoy.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a87f1e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawHUD(ctx, view) {
  const { world, runningTotal } = view;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Floor name, top-left.
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `bold 15px ${FONT_HUD}`;
  ctx.fillText(world.floor.name, 12, 24);
  // Take + clock, top-right.
  ctx.textAlign = 'right';
  ctx.font = `bold 14px ${FONT_HUD}`;
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60).toString().padStart(2, '0');
  ctx.fillText(`Take $${world.take.toLocaleString()}  ·  ${mins}:${secs}`, W - 12, 24);
  ctx.font = `12px ${FONT_HUD}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`Total $${runningTotal.toLocaleString()}`, W - 12, 42);
  // Alarm meter, top-center: segmented bar, green to amber to red.
  const mw = 260;
  const mx = (W - mw) / 2;
  const my = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(mx - 2, my - 2, mw + 4, 18);
  const segments = 10;
  for (let i = 0; i < segments; i++) {
    const filled = world.alarm > (i / segments) * 100;
    const frac = (i + 0.5) / segments;
    ctx.fillStyle = !filled ? '#2a3040'
      : frac < 0.5 ? PALETTE.alarmGreen : frac < 0.8 ? PALETTE.alarmAmber : PALETTE.alarmRed;
    ctx.fillRect(mx + i * (mw / segments) + 1, my, mw / segments - 2, 14);
  }
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `bold 11px ${FONT_HUD}`;
  ctx.textAlign = 'center';
  if (world.lockdownT > 0) {
    ctx.fillStyle = PALETTE.alarmRed;
    ctx.font = `bold 16px ${FONT_HUD}`;
    ctx.fillText(`LOCKDOWN — ${world.lockdownT.toFixed(1)}s — REACH THE EXIT`, W / 2, my + 32);
  } else {
    ctx.fillText(`ALARM ${Math.round(world.alarm)}%`, W / 2, my + 32);
  }
  // Tool charges, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = `13px ${FONT_HUD}`;
  ctx.fillStyle = PALETTE.hud;
  ctx.fillText(
    `Z smoke ×${world.tools.smoke}    X EMP ×${world.tools.emp}    C decoy ×${world.tools.decoy}`,
    12, H - 12,
  );
  if (world.empT > 0) {
    ctx.fillStyle = '#8fd8ea';
    ctx.fillText(`EMP ${world.empT.toFixed(1)}s`, 12, H - 30);
  }
  // One-line contextual prompt, bottom-center.
  const p = tileOf(world.player.x, world.player.y);
  const nearVault = Math.abs(p.x - world.vault.x) <= 1 && Math.abs(p.y - world.vault.y) <= 1;
  let prompt = '';
  if (world.lockdownT > 0) prompt = 'Lockdown! Get to the exit — now!';
  else if (p.x === world.exit.x && p.y === world.exit.y) prompt = 'Press E — slip out into the night';
  else if (nearVault && !world.vault.open) prompt = 'Hold E — crack the vault';
  else if (world.vault.open) prompt = 'Vault open — get to the exit';
  else if (world.vault.progress > 0) prompt = 'Vault half-cracked — the dial remembers';
  if (prompt) {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `13px ${FONT_HUD}`;
    ctx.fillText(prompt, W / 2, H - 12);
  }
  // Red vignette pulse as the alarm climbs.
  if (world.alarm > 25) {
    const a = (world.alarm / 100) * 0.45 * (0.7 + 0.3 * Math.sin(world.time * 4));
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(180, 30, 20, 0)');
    grad.addColorStop(1, `rgba(180, 30, 20, ${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function panel(ctx, title, lines, footnote) {
  ctx.fillStyle = PALETTE.panel;
  const pw = 560;
  const ph = 90 + lines.length * 26 + (footnote ? 40 : 10);
  ctx.fillRect((W - pw) / 2, (H - ph) / 2, pw, ph);
  ctx.strokeStyle = PALETTE.vaultDial;
  ctx.lineWidth = 2;
  ctx.strokeRect((W - pw) / 2, (H - ph) / 2, pw, ph);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.title;
  ctx.font = `bold 34px ${FONT_DISPLAY}`;
  ctx.fillText(title, W / 2, (H - ph) / 2 + 52);
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `15px ${FONT_HUD}`;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, (H - ph) / 2 + 92 + i * 26));
  if (footnote) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT_HUD}`;
    ctx.fillText(footnote, W / 2, (H - ph) / 2 + 92 + lines.length * 26 + 8);
  }
}

function drawScreens(ctx, view) {
  const { screen, world, tally, runningTotal, best, rank } = view;
  if (screen === 'play') return;
  if (screen === 'title') {
    ctx.fillStyle = 'rgba(8, 10, 20, 0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.title;
    ctx.font = `bold 54px ${FONT_DISPLAY}`;
    ctx.fillText('MIDNIGHT LEDGER', W / 2, H / 2 - 60);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `16px ${FONT_HUD}`;
    ctx.fillText('One thief. Three floors. The Aurelia Grand Bank, tonight.', W / 2, H / 2 - 24);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT_HUD}`;
    ctx.fillText('WASD move · Shift sneak · E interact · Z smoke · X EMP · C decoy · P pause · M mute', W / 2, H / 2 + 8);
    if (best > 0) ctx.fillText(`Best total so far: $${best.toLocaleString()}`, W / 2, H / 2 + 34);
    ctx.fillStyle = PALETTE.title;
    ctx.font = `bold 16px ${FONT_HUD}`;
    ctx.fillText('Press Enter — begin the night', W / 2, H / 2 + 66);
    return;
  }
  if (screen === 'briefing') {
    panel(ctx, world.floor.name, [
      world.floor.flavor,
      `Par ${world.floor.par}s · vault $${world.floor.vaultValue.toLocaleString()} · crack ${world.floor.crackSeconds}s`,
      `Tools this floor: smoke ×${world.tools.smoke} · EMP ×${world.tools.emp} · decoy ×${world.tools.decoy}`,
    ], 'Press Enter — case the floor');
    return;
  }
  if (screen === 'paused') {
    ctx.fillStyle = 'rgba(8, 10, 20, 0.6)';
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 'PAUSED', ['The bank waits. The guards do not — they hold their breath.'], 'Press P — resume');
    return;
  }
  if (screen === 'tally' && tally) {
    panel(ctx, 'CLEAN GETAWAY', [
      `Floor take: $${tally.take.toLocaleString()}`,
      `Stealth: ${tally.label}${tally.bonus ? `  (+$${tally.bonus})` : ''}`,
      `Time bonus: $${tally.timeBonus}  (${tally.time.toFixed(1)}s vs par ${world.floor.par}s)`,
      `Running total: $${tally.total.toLocaleString()}`,
    ], 'Press Enter — next floor');
    return;
  }
  if (screen === 'busted') {
    panel(ctx, 'BUSTED', [
      'The cones closed in. The night is not over — the earlier floors keep their take.',
      'Slower, lower, behind the desks. Smoke is your friend.',
    ], 'Press Enter — try this floor again');
    return;
  }
  if (screen === 'finale') {
    panel(ctx, rank || 'THE GHOST OF AURELIA', [
      `Final take: $${runningTotal.toLocaleString()}`,
      best > 0 ? `Best total: $${best.toLocaleString()}` : 'A first night to remember.',
    ], 'Press Enter — run it back');
  }
}

/** Draw one frame. `view` is { screen, world, tally, runningTotal, best, rank }. */
export function render(ctx, view) {
  const { world } = view;
  ctx.clearRect(0, 0, W, H);
  drawFloor(ctx, world);
  drawLoot(ctx, world, world.time);
  drawWallsAndCover(ctx, world, world.time);
  drawVault(ctx, world, world.time);
  drawLasers(ctx, world, world.time);
  drawCones(ctx, world);
  drawSmoke(ctx, world);
  drawDecoy(ctx, world);
  drawWatchers(ctx, world);
  drawThief(ctx, world, world.time);
  if (view.screen === 'play' || view.screen === 'paused') drawHUD(ctx, view);
  drawScreens(ctx, view);
}
