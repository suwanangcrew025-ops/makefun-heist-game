// Midnight Ledger — keyboard and mouse input.
// Held keys drive movement; fresh presses are one-shot action bits that the
// simulation consumes once. The mouse position is reported in world pixels
// (the canvas is CSS-scaled, so client coordinates are un-scaled first).

import { TILE, W, H } from './config.js';

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set(); // fresh presses, cleared after each step is read
  let mouseX = W / 2;
  let mouseY = H / 2;
  let mouseTile = null;
  let clicked = false;

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  }

  function onKeyUp(e) {
    held.delete(e.code);
  }

  function onMouseMove(e) {
    const p = toWorld(e.clientX, e.clientY);
    mouseX = p.x;
    mouseY = p.y;
    mouseTile = {
      x: Math.max(0, Math.min(23, Math.floor(p.x / TILE))),
      y: Math.max(0, Math.min(14, Math.floor(p.y / TILE))),
    };
  }

  function onClick(e) {
    onMouseMove(e);
    clicked = true;
    pressed.add('MouseClick');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);

  return {
    /** The movement vector + action bits for this step; consuming clears presses. */
    read() {
      let mx = 0;
      let my = 0;
      for (const code of held) {
        const dir = MOVE_KEYS[code];
        if (dir) { mx += dir[0]; my += dir[1]; }
      }
      const input = {
        mx,
        my,
        sneak: held.has('ShiftLeft') || held.has('ShiftRight'),
        interactHeld: held.has('KeyE') || held.has('KeyF') || held.has('Space'),
        interactPressed: pressed.has('KeyE') || pressed.has('KeyF') || pressed.has('Space'),
        smokePressed: pressed.has('KeyZ'),
        empPressed: pressed.has('KeyX'),
        decoyPressed: pressed.has('KeyC'),
        pausePressed: pressed.has('KeyP') || pressed.has('Escape'),
        mutePressed: pressed.has('KeyM'),
        advancePressed:
          pressed.has('Enter') || pressed.has('Space') || pressed.has('KeyE') || clicked,
        mouseTile,
        mouseX,
        mouseY,
      };
      pressed.clear();
      clicked = false;
      return input;
    },
    /** Peek without consuming (for screens that only need Enter/click). */
    peekAdvance() {
      return pressed.has('Enter') || pressed.has('Space') || pressed.has('KeyE') || clicked;
    },
    consumeAdvance() {
      pressed.delete('Enter');
      pressed.delete('Space');
      pressed.delete('KeyE');
      clicked = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
    },
  };
}
