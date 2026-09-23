// ============================================================================
// Bop-a-Mole — Tiny Tock
// ----------------------------------------------------------------------------
// Moles pop out of 9 holes. Tap them before they duck back down.
//   mole        +1
//   gold mole   +3 (rare, quick!)
//   wind-up bomb   −3 (don't tap it!)
// 40 seconds per round, and the moles get faster as time runs out.
// Keyboard: the number keys 1–9 match the holes (laid out like a phone keypad).
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const ROUND_SECONDS = 40;

const holes = [...document.querySelectorAll(".hole")];
const field = document.querySelector("[data-field]");

// Each hole: { el, type: null | "mole" | "gold" | "bomb", until, hit }
const state = holes.map((el) => ({ el, type: null, until: 0, hit: false }));
let clock = 0;          // seconds since the round started
let nextSpawn = 0;
let lastFrame = 0;
let raf = 0;

// ---- Spawning ----------------------------------------------------------------
function spawn() {
  const free = state.filter((h) => !h.type);
  if (!free.length) return;
  const h = free[Math.floor(Math.random() * free.length)];
  const progress = clock / ROUND_SECONDS;         // 0 → 1 as time runs out
  const roll = Math.random();
  h.type = roll < 0.08 ? "gold" : roll < 0.22 + progress * 0.08 ? "bomb" : "mole";
  const stay = (h.type === "gold" ? 0.65 : 1.15) - progress * 0.45;
  h.until = clock + stay + Math.random() * 0.3;
  h.hit = false;
  h.el.dataset.type = h.type;
  h.el.classList.remove("is-hit");
  h.el.classList.add("is-up");
  h.el.setAttribute("aria-label", h.type === "bomb" ? "Bomb, don't tap" : h.type === "gold" ? "Gold mole" : "Mole");
}

function hide(h) {
  h.type = null;
  h.el.classList.remove("is-up");
  h.el.setAttribute("aria-label", "Empty hole");
}

// ---- Bopping --------------------------------------------------------------------
function bop(i) {
  const h = state[i];
  if (!shell.isPlaying() || !h.type || h.hit) {
    if (shell.isPlaying()) sound.play("click", { pitch: 0.6 });
    return;
  }
  h.hit = true;
  h.el.classList.add("is-hit");
  const points = h.type === "gold" ? 3 : h.type === "bomb" ? -3 : 1;
  shell.setScore(Math.max(0, shell.score + points));
  floatText(h.el, points > 0 ? `+${points}` : `${points}`, points < 0);
  if (h.type === "bomb") {
    sound.play("bump");
    field.classList.remove("is-shaking");
    void field.offsetWidth;
    field.classList.add("is-shaking");
  } else {
    sound.play(h.type === "gold" ? "ding" : "pop", { pitch: h.type === "gold" ? 1.2 : 0.9 + Math.random() * 0.3 });
  }
  h.until = clock + 0.28; // stay briefly to show the bonk
}

function floatText(el, text, bad) {
  const tag = document.createElement("span");
  tag.className = `float${bad ? " is-bad" : ""}`;
  tag.textContent = text;
  el.append(tag);
  setTimeout(() => tag.remove(), 700);
}

// ---- Loop ---------------------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const before = Math.ceil(ROUND_SECONDS - clock);
  clock += dt;
  const left = ROUND_SECONDS - clock;

  const box = shell.stat("time", "Time", formatTime(Math.ceil(Math.max(0, left))));
  box.classList.toggle("is-low", left <= 10);
  if (left <= 5 && Math.ceil(left) !== before) sound.play("tock");

  if (left <= 0) {
    state.forEach(hide);
    shell.over({ message: "Time’s up!" });
    return;
  }

  for (const h of state) if (h.type && clock >= h.until) hide(h);

  if (clock >= nextSpawn) {
    spawn();
    // more moles, more often, as the round goes on (sometimes two at once)
    const gap = 0.75 - (clock / ROUND_SECONDS) * 0.4;
    nextSpawn = clock + gap * (0.6 + Math.random() * 0.6);
    if (clock > 15 && Math.random() < 0.25) spawn();
  }
  raf = requestAnimationFrame(frame);
}

function run() {
  lastFrame = performance.now();
  raf = requestAnimationFrame(frame);
}

// ---- Controls --------------------------------------------------------------------------
holes.forEach((el, i) => el.addEventListener("pointerdown", (e) => { e.preventDefault(); bop(i); }));
holes.forEach((el, i) => el.addEventListener("click", (e) => { if (e.detail === 0) bop(i); })); // keyboard Enter/Space

// Number keys: 7 8 9 = top row, 4 5 6 = middle, 1 2 3 = bottom (like a keypad)
const KEYPAD = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || !(e.key in KEYPAD) || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  bop(KEYPAD[e.key]);
  const h = state[KEYPAD[e.key]].el;
  h.classList.add("is-pressed");
  setTimeout(() => h.classList.remove("is-pressed"), 120);
});

// ---- Shell ------------------------------------------------------------------------------
const shell = createShell({
  id: "bop-a-mole",
  title: "Bop-a-Mole",
  scoreLabel: "Bops",
  hint: "Tap the moles before they hide. Gold moles are worth 3. Don’t touch the bombs!",
  onStart() {
    cancelAnimationFrame(raf);
    state.forEach(hide);
    clock = 0;
    nextSpawn = 0.4;
    run();
  },
  onPause() { cancelAnimationFrame(raf); },
  onResume() { run(); },
});

shell.stat("time", "Time", formatTime(ROUND_SECONDS));
state.forEach(hide);
