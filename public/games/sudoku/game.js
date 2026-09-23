// ============================================================================
// Sudoku — Tiny Tock
// ----------------------------------------------------------------------------
// Fill the 9×9 grid so every row, column and 3×3 box contains 1–9 once.
// Every round is a freshly generated puzzle with exactly one solution.
// Score = your time (faster is better). Wrong numbers turn red.
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

const GIVENS = 34; // numbers shown at the start (fewer = harder)

const boardEl = document.querySelector("[data-board]");
const padEl = document.querySelector("[data-pad]");

let solution = [];   // 81 numbers
let values = [];     // 81 numbers, 0 = empty
let given = [];      // 81 booleans
let selected = 40;   // selected cell index (start in the middle)
let mistakes = 0;
let elapsed = 0;
let lastTick = 0;
let raf = 0;
const cells = [];

// ---- Puzzle generator ------------------------------------------------------------
const row = (i) => Math.floor(i / 9);
const col = (i) => i % 9;
const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

// Every cell's 20 "peers" (same row, column or box)
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const out = [];
  for (let j = 0; j < 81; j++) if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) out.push(j);
  return out;
});

const shuffled = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function candidates(grid, i) {
  const used = new Set(PEERS[i].map((p) => grid[p]));
  const out = [];
  for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
  return out;
}

/** Fill a grid with a random complete solution (backtracking). */
function fill(grid) {
  const i = grid.indexOf(0);
  if (i === -1) return true;
  for (const n of shuffled(candidates(grid, i))) {
    grid[i] = n;
    if (fill(grid)) return true;
  }
  grid[i] = 0;
  return false;
}

/** Count solutions, stopping at `limit` (we only care whether it's exactly 1). */
function countSolutions(grid, limit = 2) {
  // pick the empty cell with the fewest options (much faster)
  let best = -1, bestOpts = null;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const opts = candidates(grid, i);
    if (opts.length === 0) return 0;
    if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; if (opts.length === 1) break; }
  }
  if (best === -1) return 1;
  let count = 0;
  for (const n of bestOpts) {
    grid[best] = n;
    count += countSolutions(grid, limit - count);
    if (count >= limit) break;
  }
  grid[best] = 0;
  return count;
}

function generate() {
  const full = Array(81).fill(0);
  fill(full);
  const puzzle = [...full];
  let filled = 81;
  for (const i of shuffled([...Array(81).keys()])) {
    if (filled <= GIVENS) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions([...puzzle]) !== 1) puzzle[i] = keep; // removing it made it ambiguous
    else filled--;
  }
  return { puzzle, full };
}

// ---- Board ---------------------------------------------------------------------------
function buildBoard() {
  for (let i = 0; i < 81; i++) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "cell";
    el.dataset.i = i;
    el.style.setProperty("--r", row(i)); // used by the "solved" wave animation
    el.style.setProperty("--c", col(i));
    if (col(i) % 3 === 2 && col(i) !== 8) el.classList.add("edge-r");
    if (row(i) % 3 === 2 && row(i) !== 8) el.classList.add("edge-b");
    el.tabIndex = -1;
    el.addEventListener("click", () => select(i));
    boardEl.append(el);
    cells.push(el);
  }
}

function render() {
  const sel = values[selected];
  for (let i = 0; i < 81; i++) {
    const el = cells[i];
    const v = values[i];
    el.textContent = v || "";
    el.classList.toggle("is-given", given[i]);
    el.classList.toggle("is-wrong", !given[i] && v !== 0 && v !== solution[i]);
    el.classList.toggle("is-selected", i === selected);
    el.classList.toggle("is-peer", i !== selected && PEERS[selected].includes(i));
    el.classList.toggle("is-same", v !== 0 && v === sel && i !== selected);
    el.tabIndex = i === selected ? 0 : -1;
    el.setAttribute("aria-label", `Row ${row(i) + 1}, column ${col(i) + 1}: ${v || "empty"}${given[i] ? " (given)" : ""}`);
  }
  // dim number buttons that are already complete
  for (const b of padEl.querySelectorAll("[data-n]")) {
    const n = Number(b.dataset.n);
    b.classList.toggle("is-done", values.filter((v, i) => v === n && v === solution[i]).length === 9);
  }
}

function select(i) {
  selected = i;
  render();
  cells[i].focus({ preventScroll: true });
}

function enter(n) {
  if (!shell.isPlaying() || given[selected]) return;
  if (values[selected] === n) return;
  values[selected] = n;
  if (n === 0) {
    sound.play("move", { pitch: 0.8 });
  } else if (n === solution[selected]) {
    sound.play("tick", { pitch: 1 + n * 0.03 });
    cells[selected].classList.remove("pop");
    void cells[selected].offsetWidth;
    cells[selected].classList.add("pop");
  } else {
    mistakes++;
    shell.stat("mistakes", "Mistakes", mistakes);
    sound.play("bump", { pitch: 1.6 });
  }
  render();
  if (values.every((v, i) => v === solution[i])) solved();
}

function solved() {
  cancelAnimationFrame(raf);
  shell.setScore(Math.max(1, Math.floor(elapsed)), { animate: false });
  boardEl.classList.add("is-solved");
  setTimeout(() => {
    boardEl.classList.remove("is-solved");
    shell.over({ message: mistakes ? `Solved with ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}!` : "Solved! Not a single mistake.", win: true });
  }, 900);
}

// ---- Timer -------------------------------------------------------------------------------
function tick(now) {
  elapsed += (now - lastTick) / 1000;
  lastTick = now;
  if (Math.floor(elapsed) !== shell.score) shell.setScore(Math.floor(elapsed), { animate: false });
  raf = requestAnimationFrame(tick);
}
function run() {
  lastTick = performance.now();
  raf = requestAnimationFrame(tick);
}

// ---- Controls ------------------------------------------------------------------------------
const MOVES = { up: -9, down: 9, left: -1, right: 1 };
onKeys(
  (name) => {
    const r = row(selected), c = col(selected);
    if (name === "up" && r > 0) select(selected - 9);
    if (name === "down" && r < 8) select(selected + 9);
    if (name === "left" && c > 0) select(selected - 1);
    if (name === "right" && c < 8) select(selected + 1);
  },
  { active: (name, e) => name in MOVES && e.code.startsWith("Arrow") && shell.isPlaying() }
);

window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); enter(Number(e.key)); }
  else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { e.preventDefault(); enter(0); }
});

padEl.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  enter(b.dataset.n ? Number(b.dataset.n) : 0);
});

// ---- Shell ----------------------------------------------------------------------------------
const shell = createShell({
  id: "sudoku",
  title: "Sudoku",
  scoreLabel: "Time",
  lowerIsBetter: true,
  format: formatTime,
  letterKeys: true,
  hint: "Fill every row, column and box with the numbers 1 to 9. Tap a square, then a number.",
  onStart() {
    cancelAnimationFrame(raf);
    const { puzzle, full } = generate();
    solution = full;
    values = [...puzzle];
    given = puzzle.map((v) => v !== 0);
    mistakes = 0;
    elapsed = 0;
    shell.stat("mistakes", "Mistakes", 0);
    selected = values.indexOf(0);
    render();
    cells[selected].focus({ preventScroll: true });
    run();
  },
  onPause() { cancelAnimationFrame(raf); },
  onResume() { run(); },
});

// A blank board behind the start screen
buildBoard();
solution = Array(81).fill(0);
values = Array(81).fill(0);
given = Array(81).fill(false);
render();
