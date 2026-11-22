// Midnight Ledger — every tuning number and colour in one place.
// The playfield is a fixed 24x15 tile grid of 40px tiles (960x600 logical);
// the canvas is CSS-scaled to a 1280x800 window, so no rule below depends on the screen size.

export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const W = COLS * TILE; // 960
export const H = ROWS * TILE; // 600

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 150, // px/s — the "run"
  sneakSpeed: 85, // px/s — slower movement, slower heat fill
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 55,
  chaseSpeed: 140, // faster than the thief's sneak, slightly slower than the run
  searchSpeed: 70,
  investigateSpeed: 95,
  returnSpeed: 75,
  pauseAtNode: 0.7, // seconds stopped at each waypoint, scanning
  scanSweep: 0.55, // radians of facing sweep while paused
  coneRange: 192,
  coneHalfAngle: 0.62,
  memorySeconds: 3, // how long a chase remembers the last seen position
  catchDistance: 26, // touching the thief while chasing ends the floor
};

export const CAMERA = {
  range: 176,
  halfAngle: 0.5,
  sweepMin: 0.5, // radians either side of the base facing
  sweepMax: 0.65,
  sweepSpeed: 0.55, // rad/s of the sinusoidal sweep
};

/** Suspicion heat, 0..1 per watcher. Fills while the thief is inside the cone with
 *  a clear line of sight: full in ~0.55s at point blank, slower with distance,
 *  45% slower while the thief sneaks. Decays when the thief is unseen. */
export const HEAT = {
  fillPointBlank: 1 / 0.55, // per second at zero distance
  distanceFalloff: 0.6, // fill scales by (1 - falloff * dist/range)
  sneakFactor: 0.55, // sneaking fills heat 45% slower
  decay: 0.5, // per second while unseen
  stareAt: 0.45, // a guard stops and stares at this heat
  chaseAt: 1.0, // full heat means a chase
  stareRelease: 0.3, // heat below this ends a stare
};

/** The one alarm meter, 0..100, shared by the whole floor. */
export const ALARM = {
  guardRate: 30, // points/s times the highest guard heat, while that heat is above 0.5
  guardWarmAt: 0.5,
  decay: 7, // points/s while nobody is warm
  cameraCallIn: 25, // chunk a camera adds when its heat fills
  cameraResetHeat: 0.3,
  cameraCallCooldown: 2.5,
  laserHit: 34, // instant chunk for crossing an active laser
  laserRearm: 1.2, // seconds before the same beam can bite again
  lockdownSeconds: 10, // countdown once the meter hits 100
};

/** Vault cracking: stand on a tile next to the vault and hold interact. */
export const VAULT = {
  crackSeconds: [2.5, 3, 4], // per floor
  values: [1200, 1800, 3000], // the Star Vault on floor 3 is the big score
  noiseEvery: 1.5, // seconds of drilling between noise pulses
  noiseRadius: 260, // guards inside this ring walk over to investigate
};

export const LOOT_VALUE = { cash: 100, gem: 250, gold: 400 };

/** Tools, charges per floor. Smoke 2, EMP 1 (2 on floor 3), decoy coins 2. */
export const TOOLS = {
  smoke: { charges: 2, radius: 74, seconds: 3.5 },
  emp: { charges: [1, 1, 2], seconds: 6 },
  decoy: { charges: 2, radius: 270, stareSeconds: 2.6 },
};

export const PAR_SECONDS = [75, 95, 110];
export const TIME_BONUS_PER_SECOND = 10;
export const GHOST_BONUS = 500; // peak alarm under 60
export const QUIET_BONUS = 250; // peak alarm under 85
export const GHOST_PEAK = 60;
export const QUIET_PEAK = 85;

/** Underworld ranks for the finale, keyed by total score. */
export const RANKS = [
  { at: 11500, name: 'THE GHOST OF AURELIA' },
  { at: 9500, name: 'MASTER OF THE NIGHT' },
  { at: 7500, name: 'SHADOW BROKER' },
  { at: 5500, name: 'SAFE WHISPERER' },
  { at: 3500, name: 'PICKPOCKET' },
  { at: 0, name: 'STREET RAT' },
];

/** Noir ink-and-brass: deep-navy marble, warm brass, slate walls. */
export const PALETTE = {
  floorA: '#141a2e',
  floorB: '#10152a',
  gridLine: 'rgba(198, 160, 90, 0.10)',
  wall: '#3a4358',
  wallTop: '#5a6380',
  wallEdge: '#6b7a99',
  desk: '#6b4a2b',
  deskTop: '#7d5a35',
  lamp: '#ffd98a',
  plant: '#3f7a4a',
  pot: '#7a4a2e',
  cash: '#58d68d',
  gem: '#5fd6e8',
  gold: '#f2c94c',
  vault: '#8a6d2f',
  vaultDoor: '#b08d3e',
  vaultDial: '#e8c96a',
  guard: '#5b6b8c',
  guardCap: '#d8dce8',
  thief: '#1c1f2b',
  thiefTrim: '#c9a45c',
  face: '#e8dcc8',
  bag: '#4a3520',
  cone: 'rgba(242, 178, 74, 0.20)',
  coneHot: 'rgba(230, 92, 60, 0.30)',
  cameraCone: 'rgba(120, 210, 235, 0.16)',
  cameraConeHot: 'rgba(230, 92, 60, 0.28)',
  laser: '#ff4b3e',
  emitter: '#232838',
  smoke: 'rgba(190, 195, 210, 0.55)',
  hud: '#eef1f5',
  muted: '#9aa3b5',
  alarmGreen: '#58d68d',
  alarmAmber: '#f2b24a',
  alarmRed: '#e5534b',
  panel: 'rgba(10, 13, 24, 0.82)',
  title: '#e8c96a',
};

export const FONT_DISPLAY = 'Georgia, "Times New Roman", serif';
export const FONT_HUD = 'Verdana, Geneva, sans-serif';

/** Where the best total is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-ledger.best';
