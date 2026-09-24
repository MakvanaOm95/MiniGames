// ============================================================================
// Pour & Sort — Tiny Tock
// ----------------------------------------------------------------------------
// A water-sort puzzle against the clock. Tap a tube, then tap another to pour
// its top color into it. You can only pour onto the same color or into an
// empty tube, and each tube holds 4 layers. Sort every tube into one color
// to solve the puzzle. Solve as many as you can in 3 minutes; each puzzle
// adds a color. Every puzzle is checked by a solver first, so none are
// impossible. Undo is free (it just costs time).
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const ROUND_SECONDS = 180;
const CAP = 4;

// Colors, each with a little symbol so they can be told apart without color
const PAINTS = [
  { color: "#E8553D", sym: "●", name: "red" },
  { color: "#F2B33D", sym: "▲", name: "yellow" },
  { color: "#2F8F83", sym: "■", name: "teal" },
  { color: "#6FA9D8", sym: "◆", name: "blue" },
  { color: "#7A4E8C", sym: "★", name: "purple" },
  { color: "#8CC084", sym: "♥", name: "green" },
  { color: "#F4A6C8", sym: "✚", name: "pink" },
];

const boardEl = document.querySelector("[data-board]");
const undoBtn = document.querySelector("[data-undo]");
const skipBtn = document.querySelector("[data-skip]");
const liveEl = document.querySelector("[data-live]");

let tubes = [];        // each tube is an array of paint indexes, bottom first
let history = [];
let selected = -1;
let solved = 0;
let timeLeft = ROUND_SECONDS;
let lastTick = 0;
let timer = 0;
let busy = false;      // true during the short "solved!" celebration

// ---- Puzzle rules ------------------------------------------------------------------------
const topOf = (t) => t[t.length - 1];
const isDone = (t) => t.length === 0 || (t.length === CAP && t.every((c) => c === t[0]));

/** How many layers would pour from tube a into tube b (0 = not allowed). */
function pourAmount(a, b) {
  if (a === b || a.length === 0 || b.length >= CAP) return 0;
  if (b.length && topOf(b) !== topOf(a)) return 0;
  if (isDone(a)) return 0;   // a finished tube stays put
  let run = 1;
  while (run < a.length && a[a.length - 1 - run] === topOf(a)) run++;
  return Math.min(run, CAP - b.length);
}

function pour(ts, from, to) {
  const n = pourAmount(ts[from], ts[to]);
  for (let i = 0; i < n; i++) ts[to].push(ts[from].pop());
  return n;
}

/** Depth-first search: can this puzzle be solved? Gives up after `limit` states. */
function solvable(start, limit = 40000) {
  const seen = new Set();
  const key = (ts) => ts.map((t) => t.join("")).sort().join("|");
  const stack = [start.map((t) => t.slice())];
  while (stack.length) {
    const ts = stack.pop();
    if (ts.every(isDone)) return true;
    const k = key(ts);
    if (seen.has(k)) continue;
    seen.add(k);
    if (seen.size > limit) return false;
    for (let a = 0; a < ts.length; a++) {
      for (let b = 0; b < ts.length; b++) {
        const n = pourAmount(ts[a], ts[b]);
        if (!n) continue;
        // pouring a whole tube into an empty one changes nothing
        if (ts[b].length === 0 && n === ts[a].length) continue;
        const next = ts.map((t) => t.slice());
        pour(next, a, b);
        stack.push(next);
      }
    }
  }
  return false;
}

function colorsFor(level) {
  return Math.min(PAINTS.length, 3 + level);   // 3, 4, 5, 6, 7, 7…
}

function newPuzzle() {
  const n = colorsFor(solved);
  for (;;) {
    const pool = [];
    for (let c = 0; c < n; c++) for (let i = 0; i < CAP; i++) pool.push(c);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const ts = [];
    for (let c = 0; c < n; c++) ts.push(pool.slice(c * CAP, c * CAP + CAP));
    ts.push([], []);
    // no tube may start finished, and it must be solvable
    if (ts.some((t) => t.length && isDone(t))) continue;
    if (!solvable(ts)) continue;
    tubes = ts;
    break;
  }
  history = [];
  selected = -1;
  render();
  shell.stat("colors", "Colors", n);
}

// ---- Playing ---------------------------------------------------------------------------------
function tapTube(i) {
  if (!shell.isPlaying() || busy) return;
  if (selected === -1) {
    if (tubes[i].length === 0 || isDone(tubes[i])) { sound.play("click"); return; }
    selected = i;
    sound.play("tick");
  } else if (selected === i) {
    selected = -1;
  } else {
    const before = tubes.map((t) => t.slice());
    const n = pour(tubes, selected, i);
    if (n) {
      history.push(before);
      sound.play("pop", { pitch: 0.8 + tubes[i].length * 0.12 });
      if (isDone(tubes[i]) && tubes[i].length) {
        setTimeout(() => sound.play("ding", { pitch: 1.2 }), 120);
        say(`${PAINTS[tubes[i][0]].name} tube finished`);
      }
      selected = -1;
      render(i, n);
      if (tubes.every(isDone)) return win();
      return;
    }
    // can't pour there: pick that tube instead, if it has something
    sound.play("bump", { pitch: 1.6 });
    selected = tubes[i].length && !isDone(tubes[i]) ? i : -1;
  }
  render();
}

function undo() {
  if (!shell.isPlaying() || busy || !history.length) return;
  tubes = history.pop();
  selected = -1;
  sound.play("move");
  render();
}

function skip() {
  if (!shell.isPlaying() || busy) return;
  sound.play("move", { pitch: 0.8 });
  newPuzzle();
  say("New puzzle");
}

function win() {
  solved++;
  shell.setScore(solved);
  busy = true;
  sound.play("win");
  boardEl.classList.add("is-solved");
  say(`Solved! ${solved} so far.`);
  setTimeout(() => {
    busy = false;
    boardEl.classList.remove("is-solved");
    if (shell.isPlaying()) newPuzzle();
  }, 900);
}

// ---- Timer -----------------------------------------------------------------------------------
function tick() {
  const now = performance.now();
  timeLeft -= (now - lastTick) / 1000;
  lastTick = now;
  showTime();
  if (timeLeft <= 0) {
    clearInterval(timer);
    const s = solved;
    shell.over({ message: s ? `Time! You sorted ${s} puzzle${s === 1 ? "" : "s"}.` : "Time! Try pouring into the empty tubes first." });
  }
}
function showTime() {
  const box = shell.stat("time", "Time", formatTime(Math.ceil(Math.max(0, timeLeft))));
  box.classList.toggle("is-low", timeLeft <= 15);
}
function startTimer() {
  clearInterval(timer);
  lastTick = performance.now();
  timer = setInterval(tick, 200);
}

// ---- Drawing ---------------------------------------------------------------------------------
function render(pouredInto = -1, poured = 0) {
  // rebuilding the tubes would drop keyboard focus, so remember which one had it
  const focused = [...boardEl.children].indexOf(document.activeElement);
  boardEl.innerHTML = "";
  tubes.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ps-tube" + (i === selected ? " is-up" : "") + (t.length && isDone(t) ? " is-done" : "");
    const names = t.map((c) => PAINTS[c].name);
    b.setAttribute("aria-label", `Tube ${i + 1}: ${names.length ? names.join(", ") + " (bottom to top)" : "empty"}`);
    b.setAttribute("aria-pressed", String(i === selected));
    t.forEach((c, j) => {
      const s = document.createElement("span");
      s.className = "ps-layer" + (i === pouredInto && j >= t.length - poured ? " is-new" : "");
      s.style.setProperty("--paint", PAINTS[c].color);
      s.style.setProperty("--row", j);
      s.textContent = PAINTS[c].sym;
      b.append(s);
    });
    const num = document.createElement("span");
    num.className = "ps-key";
    num.textContent = i + 1;
    b.append(num);
    b.addEventListener("click", () => tapTube(i));
    boardEl.append(b);
  });
  if (focused >= 0) boardEl.children[focused]?.focus();
  undoBtn.disabled = !history.length;
}

function say(text) { liveEl.textContent = text; }

// ---- Controls ----------------------------------------------------------------------------------
undoBtn.addEventListener("click", undo);
skipBtn.addEventListener("click", skip);
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= tubes.length) { e.preventDefault(); tapTube(n - 1); }
  else if (e.code === "KeyZ" || e.code === "Backspace") { e.preventDefault(); undo(); }
});

// ---- Shell ------------------------------------------------------------------------------------
const shell = createShell({
  id: "pour-and-sort",
  title: "Pour & Sort",
  scoreLabel: "Solved",
  hint: "Tap a tube, then another, to pour. Sort every color into its own tube. How many can you solve in 3 minutes?",
  onStart() {
    solved = 0;
    busy = false;
    timeLeft = ROUND_SECONDS;
    showTime();
    newPuzzle();
    startTimer();
  },
  onPause() { clearInterval(timer); },
  onResume() { startTimer(); },
});

// A puzzle to look at behind the start screen
newPuzzle();
showTime();
