// ============================================================================
// Peg Jump — Tiny Tock
// ----------------------------------------------------------------------------
// Classic peg solitaire on the cross-shaped board (33 holes, the middle one
// empty). Jump a peg over a neighbor into an empty hole, straight up, down,
// left or right, and the peg you jumped over is removed. Keep going until no
// jumps are left. Fewer pegs left is better; one peg in the very middle is
// a perfect game. Undo is allowed.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const N = 7;
const CENTER = 3 * N + 3;
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const onBoard = (r, c) => r >= 0 && r < N && c >= 0 && c < N && (r >= 2 && r <= 4 || c >= 2 && c <= 4);

const boardEl = document.querySelector("[data-board]");
const undoBtn = document.querySelector("[data-undo]");
const liveEl = document.querySelector("[data-live]");

let pegs = [];          // pegs[i] = true / false for each of the 49 spots (only board spots used)
let selected = -1;
let focus = CENTER;
let history = [];
const holeEls = [];

// ---- Board -------------------------------------------------------------------------------------
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const i = r * N + c;
    if (!onBoard(r, c)) {
      const gap = document.createElement("span");
      gap.className = "pj-gap";
      boardEl.append(gap);
      holeEls.push(null);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pj-hole";
    b.tabIndex = -1;
    b.addEventListener("click", () => tap(i));
    b.addEventListener("focus", () => { focus = i; });
    boardEl.append(b);
    holeEls.push(b);
  }
}

function reset() {
  pegs = holeEls.map((el, i) => !!el && i !== CENTER);
  selected = -1;
  history = [];
}

/** Jumps from a spot: [{ to, over }]. */
function jumpsFrom(i) {
  if (!pegs[i]) return [];
  const r = Math.floor(i / N), c = i % N;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (!onBoard(r2, c2)) continue;
    const over = r1 * N + c1, to = r2 * N + c2;
    if (pegs[over] && !pegs[to]) out.push({ to, over });
  }
  return out;
}

const pegCount = () => pegs.filter(Boolean).length;
function anyMoves() { return pegs.some((p, i) => p && jumpsFrom(i).length); }

// ---- Playing -------------------------------------------------------------------------------------
function tap(i) {
  if (!shell.isPlaying()) return;
  if (pegs[i]) {
    if (selected === i) { selected = -1; render(); return; }
    if (!jumpsFrom(i).length) { nope(i); selected = -1; render(); return; }
    selected = i;
    sound.play("tick");
    render();
    return;
  }
  // empty hole: jump the selected peg here, or the only peg that can reach it
  let move = selected >= 0 ? jumpsFrom(selected).find((m) => m.to === i) : null;
  let from = selected;
  if (!move) {
    const options = [];
    pegs.forEach((p, k) => { if (p) for (const m of jumpsFrom(k)) if (m.to === i) options.push([k, m]); });
    if (options.length === 1) [[from, move]] = options;
  }
  if (!move) { nope(i); return; }
  jump(from, move);
}

function jump(from, { to, over }) {
  history.push(pegs.slice());
  pegs[from] = false;
  pegs[over] = false;
  pegs[to] = true;
  selected = -1;
  focus = to;
  shell.setScore(pegCount());
  sound.play("pop", { pitch: 0.8 + (32 - pegCount()) * 0.02 });
  render(to);
  say(`Jumped. ${pegCount()} pegs left.`);
  if (!anyMoves()) setTimeout(finish, 450);
}

function finish() {
  if (!shell.isPlaying() || anyMoves()) return;   // (undo may have happened meanwhile)
  const n = pegCount();
  const message =
    n === 1 && pegs[CENTER] ? "Perfect! One peg, right in the middle!" :
    n === 1 ? "Just one peg left. Brilliant!" :
    n <= 3 ? `${n} pegs left. Excellent!` :
    n <= 6 ? `${n} pegs left. Nicely done!` :
    `${n} pegs left. No more jumps!`;
  shell.over({ message, win: n === 1 });
}

function undo() {
  if (!shell.isPlaying() || !history.length) return;
  pegs = history.pop();
  selected = -1;
  shell.setScore(pegCount(), { animate: false });
  sound.play("move");
  render();
}

function nope(i) {
  sound.play("bump", { pitch: 1.6 });
  const el = holeEls[i];
  el.classList.remove("is-nope");
  void el.offsetWidth;
  el.classList.add("is-nope");
}

// ---- Drawing ---------------------------------------------------------------------------------------
function render(landed = -1) {
  const targets = new Set(selected >= 0 ? jumpsFrom(selected).map((m) => m.to) : []);
  holeEls.forEach((el, i) => {
    if (!el) return;
    const r = Math.floor(i / N) + 1, c = (i % N) + 1;
    el.className = "pj-hole" + (pegs[i] ? " has-peg" : "") + (i === selected ? " is-selected" : "") + (targets.has(i) ? " is-target" : "") + (i === landed ? " is-landed" : "");
    el.tabIndex = i === focus ? 0 : -1;
    el.setAttribute("aria-label", `Row ${r}, column ${c}: ${pegs[i] ? "peg" : "empty"}${i === selected ? ", selected" : ""}${targets.has(i) ? ", you can jump here" : ""}`);
  });
  undoBtn.disabled = !history.length;
}

function say(text) { liveEl.textContent = text; }

// ---- Keyboard: arrow keys move between holes, Enter / Space picks ---------------------------------
boardEl.addEventListener("keydown", (e) => {
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (!moves[e.code]) return;
  e.preventDefault();
  let r = Math.floor(focus / N), c = focus % N;
  const [dr, dc] = moves[e.code];
  // skip over the corner gaps
  do { r += dr; c += dc; } while (r >= 0 && r < N && c >= 0 && c < N && !onBoard(r, c));
  if (!onBoard(r, c)) return;
  focus = r * N + c;
  render();
  holeEls[focus].focus();
});
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "KeyZ" || e.code === "Backspace") { e.preventDefault(); undo(); }
});
undoBtn.addEventListener("click", undo);

// ---- Shell ------------------------------------------------------------------------------------------
const shell = createShell({
  id: "peg-jump",
  title: "Peg Jump",
  scoreLabel: "Pegs",
  lowerIsBetter: true,
  hint: "Jump a peg over another into an empty hole to remove it. End with as few pegs as you can!",
  onStart() {
    reset();
    focus = CENTER;
    shell.setScore(pegCount(), { animate: false });
    render();
  },
});

reset();
render();
