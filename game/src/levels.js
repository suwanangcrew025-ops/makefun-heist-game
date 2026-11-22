// Midnight Ledger — the three floors of the Aurelia Grand Bank.
//
// Every floor is one 24x15 screen, no scrolling. A horizontal mid-corridor (row 7)
// joins the top and bottom halves through three vertical gaps (columns 4, 12, 20),
// and interior walls split each half into three rooms, so six rooms in all, each
// with at least two approaches: its gap to the corridor and a door to its neighbour.
//
// Legend: # wall · D desk (solid, blocks sight — the main cover) · P plant (solid,
// does NOT block sight) · V vault (solid, crackable from an adjacent tile) ·
// E exit door · S thief start · c cash · g gem · G gold bars · . open floor.
//
// The maps are built from one shared skeleton plus explicit per-floor placements,
// so a misread row can never silently shift a room: every coordinate below is the
// tile it names, and the flood-fill check in the verification suite proves it.

const WALL_ROW = '####.#######.#######.###'; // rows 6 and 8: wall except the three gaps
const ROOM_ROW = '#......#.......#.......#'; // rows 1-5, 9-13: rooms split by walls at 7, 15
const DOOR_ROW = '#......................#'; // rows 3 and 11: doors through the room walls
const BORDER = '########################';

function skeleton() {
  return [
    BORDER, // 0
    ROOM_ROW, // 1
    ROOM_ROW, // 2
    DOOR_ROW, // 3
    ROOM_ROW, // 4
    ROOM_ROW, // 5
    WALL_ROW, // 6
    DOOR_ROW, // 7 — the mid-corridor, open end to end
    WALL_ROW, // 8
    ROOM_ROW, // 9
    ROOM_ROW, // 10
    DOOR_ROW, // 11
    ROOM_ROW, // 12
    ROOM_ROW, // 13
    BORDER, // 14
  ].map((row) => row.split(''));
}

function place(grid, x, y, ch) {
  grid[y][x] = ch;
}

function build(placements) {
  const grid = skeleton();
  for (const [x, y, ch] of placements) place(grid, x, y, ch);
  return grid.map((row) => row.join(''));
}

// The thief slips in at the bottom-mid room on every floor — clear of the
// bottom-left guard's loop, a straight walk up the column-12 gap — and slips
// out through the exit door at the bottom-left corner.
const IN_OUT = [
  [12, 12, 'S'],
  [1, 13, 'E'],
];

export const FLOORS = [
  {
    name: 'Floor 1 — The Lobby',
    flavor: 'Two guards, one camera, and a modest vault upstairs. Learn the cones.',
    par: 75,
    vaultValue: 1200,
    crackSeconds: 2.5,
    map: build([
      ...IN_OUT,
      [21, 1, 'V'], // the modest vault, top-right room
      // Eight loose pieces: the autopilot's path takes five of them, worth 650.
      // (Kept clear of the top guard's patrol lanes, so the route stays quiet.)
      [10, 11, 'c'], [10, 2, 'g'], [13, 1, 'c'], [18, 2, 'c'], [19, 2, 'c'],
      [5, 4, 'G'], [18, 4, 'g'], [22, 4, 'c'],
      // Mid-room cover: desks block sight, plants only block bodies.
      // (Kept off the autopilot's lanes: the row-3 door line and the
      // column-20 drop stay clear, so a walk never stalls against cover.)
      [4, 4, 'D'], [18, 5, 'D'], [10, 12, 'D'], [21, 13, 'D'],
      [6, 5, 'P'], [14, 1, 'P'], [22, 10, 'P'], [2, 10, 'P'],
    ]),
    patrols: [
      [[9, 2], [13, 2], [13, 4], [9, 4]], // top-mid room
      [[4, 10], [6, 10], [6, 12], [4, 12]], // bottom-left room
    ],
    cameras: [
      { tx: 23, ty: 3, base: Math.PI, sweep: 0.55 }, // watches the vault room
    ],
    lasers: [],
  },
  {
    name: 'Floor 2 — The Counting House',
    flavor: 'A corridor guard, two cameras, and lasers across two of the mid-gaps.',
    par: 95,
    vaultValue: 1800,
    crackSeconds: 3,
    map: build([
      ...IN_OUT,
      [22, 12, 'V'], // the heavier vault, bottom-right room
      [4, 2, 'c'], [10, 2, 'g'], [18, 2, 'G'],
      [6, 11, 'c'], [14, 12, 'g'], [20, 11, 'c'],
      [5, 3, 'D'], [12, 1, 'D'], [17, 4, 'D'],
      [9, 12, 'D'], [16, 11, 'D'], [3, 10, 'D'],
      [6, 5, 'P'], [14, 1, 'P'], [21, 10, 'P'], [2, 9, 'P'],
    ]),
    patrols: [
      [[3, 7], [21, 7]], // the mid-corridor, end to end
      [[9, 2], [13, 2], [13, 4], [9, 4]], // top-mid room
      [[17, 10], [20, 10], [20, 12], [17, 12]], // the vault room
    ],
    cameras: [
      { tx: 23, ty: 3, base: Math.PI, sweep: 0.55 },
      { tx: 23, ty: 11, base: Math.PI, sweep: 0.6 }, // watches the vault room
    ],
    // Laser beams across the column-12 and column-20 mid-gaps (row 6).
    // Each beam runs between the two wall tiles flanking its gap.
    lasers: [
      { ax: 11, ay: 6, bx: 13, by: 6, blink: null },
      { ax: 19, ay: 6, bx: 21, by: 6, blink: null },
    ],
  },
  {
    name: 'Floor 3 — The Star Vault',
    flavor: 'Four guards, three cameras, lasers on every gap — and the Aurelia Star.',
    par: 110,
    vaultValue: 3000,
    crackSeconds: 4,
    map: build([
      ...IN_OUT,
      [22, 12, 'V'], // the Aurelia Star, bottom-right room
      [3, 3, 'c'], [9, 2, 'g'], [13, 4, 'G'],
      [5, 11, 'c'], [10, 12, 'g'], [18, 11, 'G'],
      [5, 4, 'D'], [12, 1, 'D'], [16, 3, 'D'],
      [9, 10, 'D'], [14, 12, 'D'],
      // The plant at (19,9) blocks the row-9 lane into the vault room:
      // the way in is the row-10 lane.
      [19, 9, 'P'], [6, 2, 'P'], [20, 4, 'P'], [3, 10, 'P'], [8, 13, 'P'],
    ]),
    patrols: [
      [[3, 7], [21, 7]], // the mid-corridor, end to end
      [[9, 2], [13, 2], [13, 4], [9, 4]], // top-mid room
      [[9, 11], [13, 11], [13, 12], [9, 12]], // bottom-mid room
      [[17, 10], [20, 10], [20, 12], [17, 12]], // the vault room
    ],
    cameras: [
      { tx: 23, ty: 3, base: Math.PI, sweep: 0.55 },
      { tx: 23, ty: 11, base: Math.PI, sweep: 0.6 },
      { tx: 0, ty: 7, base: 0, sweep: 0.5 }, // looks straight down the corridor
    ],
    // Lasers on all three mid-gaps; the column-20 beam blinks (3.2s on, 1.2s off).
    lasers: [
      { ax: 3, ay: 6, bx: 5, by: 6, blink: null },
      { ax: 11, ay: 6, bx: 13, by: 6, blink: null },
      { ax: 19, ay: 6, bx: 21, by: 6, blink: { on: 3.2, off: 1.2 } },
    ],
  },
];

/** Read a floor's map into the pieces the simulation needs. */
export function parseMap(rows) {
  const grid = rows.map((row) => row.split(''));
  const loot = [];
  let vault = null;
  let exit = null;
  let spawn = null;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = grid[y][x];
      if (ch === 'c' || ch === 'g' || ch === 'G') {
        loot.push({ x, y, kind: ch === 'c' ? 'cash' : ch === 'g' ? 'gem' : 'gold', taken: false });
      } else if (ch === 'V') vault = { x, y };
      else if (ch === 'E') exit = { x, y };
      else if (ch === 'S') spawn = { x, y };
    }
  }
  return { grid, loot, vault, exit, spawn };
}

/** A tile blocks a body: walls, desks, plants, the vault. */
export function isSolidChar(ch) {
  return ch === '#' || ch === 'D' || ch === 'P' || ch === 'V';
}

/** A tile blocks sight: walls, desks, the vault — but not plants. */
export function blocksSightChar(ch) {
  return ch === '#' || ch === 'D' || ch === 'V';
}
