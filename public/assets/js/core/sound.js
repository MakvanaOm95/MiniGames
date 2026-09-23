// ============================================================================
// sound.js — tiny synthesized sound effects (no audio files to download)
// ----------------------------------------------------------------------------
//   import * as sound from "/assets/js/core/sound.js";
//   sound.play("pop");                 // play an effect
//   sound.play("pop", { pitch: 1.5 }); // higher version (great for combos)
//   sound.toggleMuted();               // mute / unmute (remembered)
//
// Sounds are generated with the Web Audio API, so they cost zero bytes and
// start instantly. Browsers only allow audio after the player taps or presses
// a key — that's fine, because every game starts with a "Play" press.
// ============================================================================

import { load, save } from "./storage.js";

let ctx = null;
let master = null;
let muted = load("muted", false);
const listeners = new Set();

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** One simple note: an oscillator with a quick attack and exponential fade. */
function tone({ type = "sine", freq = 440, to = null, dur = 0.15, vol = 1, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// The sound library. `p` is the pitch multiplier.
const SOUNDS = {
  tick:  (p) => tone({ type: "triangle", freq: 1900 * p, dur: 0.035, vol: 0.5 }),
  tock:  (p) => tone({ type: "triangle", freq: 950 * p, dur: 0.05, vol: 0.6 }),
  click: (p) => tone({ type: "square", freq: 700 * p, dur: 0.03, vol: 0.15 }),
  pop:   (p) => tone({ type: "sine", freq: 420 * p, to: 980 * p, dur: 0.09, vol: 0.8 }),
  move:  (p) => tone({ type: "sine", freq: 300 * p, to: 360 * p, dur: 0.05, vol: 0.25 }),
  bump:  (p) => tone({ type: "sine", freq: 180 * p, to: 55 * p, dur: 0.22, vol: 0.9 }),
  start: (p) => {
    tone({ type: "triangle", freq: 523 * p, dur: 0.1, vol: 0.5 });
    tone({ type: "triangle", freq: 784 * p, dur: 0.16, vol: 0.5, delay: 0.08 });
  },
  over: (p) => {
    [523, 415, 330].forEach((f, i) => tone({ type: "triangle", freq: f * p, dur: 0.22, vol: 0.45, delay: i * 0.12 }));
  },
  ding: (p) => {
    // a little bell: two harmonics ringing out
    tone({ type: "sine", freq: 1318 * p, dur: 0.9, vol: 0.5 });
    tone({ type: "sine", freq: 1976 * p, dur: 0.6, vol: 0.22 });
  },
  win: (p) => {
    [523, 659, 784, 1046].forEach((f, i) => tone({ type: "triangle", freq: f * p, dur: 0.18, vol: 0.45, delay: i * 0.09 }));
  },
};

export function play(name, { pitch = 1 } = {}) {
  if (muted || !SOUNDS[name]) return;
  if (!audio()) return;
  SOUNDS[name](pitch);
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = Boolean(value);
  save("muted", muted);
  listeners.forEach((fn) => fn(muted));
}

export const toggleMuted = () => setMuted(!muted);

/** Get told when mute changes (used to update the speaker icon). */
export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
