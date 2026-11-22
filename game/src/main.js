// Midnight Ledger — boot, the fixed-step loop, and the screen flow:
// title -> briefing -> play -> tally -> next floor -> finale, with busted and
// paused on the side. Every game event is wired to a sound and to the
// screen-reader-live status line. ?shot=N stages a screenshot scene, paints
// twice, then sets window.__shotReady for the headless capture.

import { W, H, STEP, BEST_KEY, RANKS } from './config.js';
import { createWorld, stepWorld, floorTally } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { audioUnlock, audioToggleMute, audioMuted, playSound } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);

const params = new URLSearchParams(location.search);
const shotParam = params.get('shot');
const shotNum = shotParam ? parseInt(shotParam, 10) : 0;

let screen = 'title'; // title | briefing | play | paused | tally | busted | finale
let world = createWorld(0, 1);
let runningTotal = 0;
let tally = null;
let best = 0;
let rank = '';
let accumulator = 0;
let lastTime = performance.now();

// Read-only play-testing handle for the headless smoke test.
window.__ledger = {
  get screen() { return screen; },
  get alarm() { return Math.round(world.alarm); },
  get state() { return world.state; },
  get thief() { return { x: Math.round(world.player.x), y: Math.round(world.player.y) }; },
  get status() { return statusEl ? statusEl.textContent : ''; },
};

try {
  best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
} catch { best = 0; }

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
  // Also keep a plain-text mirror the smoke test can read from the console.
  console.log('[status]', text);
}

function rankFor(total) {
  for (const r of RANKS) if (total >= r.at) return r.name;
  return RANKS[RANKS.length - 1].name;
}

function describeEvent(e) {
  switch (e) {
    case 'loot:cash': return 'Cash taken. The bag grows heavier.';
    case 'loot:gem': return 'A gem, cold and bright, slipped into the bag.';
    case 'loot:gold': return 'Gold bars. Heavy. Worth it.';
    case 'vault-open': return 'The vault swings open. The take is yours.';
    case 'drill': return 'The drill whines against the dial.';
    case 'guard-suspicious': return 'A guard stops and stares. Stay out of the cone.';
    case 'guard-chase': return 'Spotted! A guard is chasing you — run!';
    case 'camera-call': return 'A camera phones it in. The alarm jumps.';
    case 'laser': return 'A laser beam trips. The alarm jumps.';
    case 'smoke': return 'Smoke pellet out — the cloud blocks every line of sight.';
    case 'emp': return 'EMP pulse — cameras and lasers blind for six seconds.';
    case 'decoy': return 'Decoy coin tossed. A guard goes to look.';
    case 'decoy-refused': return 'No room there for a coin — it stays in your pocket.';
    case 'tool-empty': return 'Out of that tool for this floor.';
    case 'lockdown': return 'Lockdown! Ten seconds — reach the exit before it ends.';
    case 'lockdown-caught': return 'Lockdown expired. The doors seal. Caught.';
    case 'caught': return 'Busted! A guard has you.';
    case 'escaped': return 'Clean getaway. The night is yours.';
    default: return '';
  }
}

function handleEvents(events) {
  for (const e of events) {
    const text = describeEvent(e);
    if (text) setStatus(text);
    if (e === 'caught' || e === 'lockdown-caught') playSound('caught');
    else if (e === 'escaped') playSound('escaped');
    else if (e === 'lockdown') playSound('lockdown');
    else playSound(e);
  }
}

function startFloor(floorIndex) {
  world = createWorld(floorIndex, 1);
  tally = null;
  screen = 'briefing';
  setStatus(`${world.floor.name}. ${world.floor.flavor}`);
}

function advance() {
  audioUnlock();
  if (screen === 'title') {
    startFloor(0);
    playSound('click');
  } else if (screen === 'briefing') {
    screen = 'play';
    setStatus(`${world.floor.name} — move with WASD, sneak with Shift, E interacts.`);
    playSound('click');
  } else if (screen === 'tally') {
    if (world.floorIndex < 2) startFloor(world.floorIndex + 1);
    else {
      screen = 'finale';
      rank = rankFor(runningTotal);
      if (runningTotal > best) {
        best = runningTotal;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
      }
      setStatus(`Finale. Total $${runningTotal.toLocaleString()} — rank: ${rank}.`);
    }
    playSound('click');
  } else if (screen === 'busted') {
    startFloor(world.floorIndex); // retry the floor; earlier floors keep their take
    playSound('click');
  } else if (screen === 'finale') {
    runningTotal = 0;
    startFloor(0);
    playSound('click');
  }
}

function stepPlay(dt, inp) {
  const events = stepWorld(world, inp, dt);
  handleEvents(events);
  if (world.state === 'escaped') {
    tally = floorTally(world, runningTotal);
    runningTotal = tally.total;
    screen = 'tally';
    setStatus(`Clean getaway. Floor take $${tally.take.toLocaleString()}, ${tally.label}, ` +
      `time bonus $${tally.timeBonus}. Running total $${runningTotal.toLocaleString()}.`);
    playSound('escaped');
  } else if (world.state === 'busted') {
    screen = 'busted';
    setStatus('Busted. The floor ends here — earlier floors keep their take. Press Enter to retry.');
  }
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    accumulator -= STEP;
    steps++;
    const inp = input.read();
    if (inp.mutePressed) {
      const m = audioToggleMute();
      setStatus(m ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === 'play') {
      if (inp.pausePressed) {
        screen = 'paused';
        setStatus('Paused. Press P to resume.');
      } else {
        stepPlay(STEP, inp);
      }
    } else if (screen === 'paused') {
      if (inp.pausePressed) {
        screen = 'play';
        setStatus('Resumed.');
      }
    } else if (screen === 'title') {
      // The live dimmed lobby: watchers keep patrolling against a far-away
      // dummy player tucked in the quiet top-left corner.
      world.player.x = 60;
      world.player.y = 60;
      stepWorld(world, {
        mx: 0, my: 0, sneak: false, interactHeld: false, interactPressed: false,
        smokePressed: false, empPressed: false, decoyPressed: false, mouseTile: null,
      }, STEP);
      if (inp.advancePressed) {
        advance();
      }
    } else if (inp.advancePressed) {
      advance();
    }
  }
  render(ctx, { screen, world, tally, runningTotal, best, rank });
  requestAnimationFrame(frame);
}

// --- shot mode: stage the scene, paint twice, signal readiness ---
if (shotNum >= 1 && shotNum <= 4) {
  const staged = stageShot(shotNum);
  world = staged.world;
  screen = staged.screen;
  render(ctx, { screen, world, tally: null, runningTotal: 0, best, rank: '' });
  render(ctx, { screen, world, tally: null, runningTotal: 0, best, rank: '' });
  setStatus(`Shot ${shotNum} staged.`);
  window.__shotReady = true;
  window.__shotOk = staged.ok !== false && world.state === 'play';
} else {
  setStatus('Midnight Ledger. Press Enter — begin the night.');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      setStatus('Paused — the tab hid, so the bank waits.');
    }
  });
  requestAnimationFrame(frame);
}
