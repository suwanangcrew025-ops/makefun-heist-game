// Midnight Ledger — sound, synthesized live with WebAudio: no files, no network.
// A low two-oscillator room-tone pad starts on first interaction; every effect
// is a short oscillator or noise burst. M mutes everything.

let ctx = null;
let pad = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // Room tone: two detuned low oscillators through a slow-breathing gain.
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    lfo.start();
    for (const freq of [55, 55.7]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g);
      o.start();
    }
    g.connect(ctx.destination);
    pad = g;
  } catch {
    ctx = null;
  }
  return ctx;
}

export function audioUnlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function audioMuted() { return muted; }

export function audioToggleMute() {
  muted = !muted;
  if (pad) pad.gain.value = muted ? 0 : 0.035;
  return muted;
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  try {
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch { /* silence is always an acceptable fallback */ }
}

function noiseBurst(dur, vol = 0.15, filterFreq = 1200) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start(t0);
  } catch { /* ignore */ }
}

/** One sound name per game event. */
export function playSound(name) {
  switch (name) {
    case 'loot:cash': tone(880, 0.12, 'sine', 0.1); tone(1320, 0.18, 'sine', 0.08, 0.06); break;
    case 'loot:gem': tone(1046, 0.12, 'triangle', 0.1); tone(1568, 0.2, 'triangle', 0.08, 0.06); break;
    case 'loot:gold': tone(659, 0.12, 'triangle', 0.1); tone(988, 0.14, 'triangle', 0.09, 0.06); tone(1318, 0.2, 'sine', 0.07, 0.12); break;
    case 'vault-open': tone(523, 0.16, 'triangle', 0.12); tone(659, 0.16, 'triangle', 0.12, 0.12); tone(784, 0.3, 'triangle', 0.12, 0.24); break;
    case 'drill': tone(220, 0.05, 'square', 0.04); break;
    case 'guard-suspicious': tone(392, 0.25, 'sine', 0.12, 0, 330); break;
    case 'guard-chase': tone(220, 0.4, 'sawtooth', 0.12, 0, 110); tone(233, 0.4, 'sawtooth', 0.1, 0.05, 116); break;
    case 'camera-call': tone(1200, 0.08, 'square', 0.07); tone(1200, 0.08, 'square', 0.07, 0.12); break;
    case 'laser': tone(1800, 0.18, 'sawtooth', 0.1, 0, 300); noiseBurst(0.12, 0.08, 3000); break;
    case 'smoke': noiseBurst(0.35, 0.14, 900); break;
    case 'emp': tone(1400, 0.5, 'sine', 0.1, 0, 180); break;
    case 'decoy': tone(1568, 0.1, 'sine', 0.1); tone(2093, 0.16, 'sine', 0.09, 0.09); break;
    case 'decoy-refused': tone(180, 0.12, 'square', 0.06); break;
    case 'tool-empty': tone(160, 0.1, 'square', 0.05); break;
    case 'lockdown': tone(880, 0.18, 'square', 0.1); tone(880, 0.18, 'square', 0.1, 0.25); tone(880, 0.18, 'square', 0.1, 0.5); break;
    case 'lockdown-caught':
    case 'caught': tone(110, 0.7, 'sawtooth', 0.14, 0, 55); noiseBurst(0.4, 0.12, 500); break;
    case 'escaped': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.11, i * 0.09)); break;
    case 'click': tone(660, 0.06, 'sine', 0.07); break;
    default: break;
  }
}
