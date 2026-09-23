// ============================================================================
// Minesweeper — Tiny Tock
// ----------------------------------------------------------------------------
// 9×9 field, 10 hidden mines. Dig squares to reveal numbers: each number says
// how many mines touch that square. Flag the mines, dig everything else.
// Your first dig is always safe. Score = your time (faster is better).
//
// Controls: click = dig, right-click or long-press = flag,
// or switch the Dig/Flag toggle (handy on phones).
// Keyboard: arrows move, Enter/Space dig, F flag.
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const SIZE = 9;
const MINES = 10;
const LONG_PRESS_MS = 380;

const fieldEl = document.querySelector("[data-field]");
const modeBtn = document.querySelector("[data-mode]");

// Each square: { mine, n (neighbour mines), open, flag, el }
let grid = [];
let started = false;     // mines are placed on the first dig
let flagMode = false;
let focusIdx = 40;
let elapsed = 0, lastTick = 0, raf = 0, timing = false;
let finished = false;

const idx = (x, y) => y * SIZE + x;
const neighbours = (i) => {
  const x = i % SIZE, y = Math.floor(i / SIZE), out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) out.push(idx(nx, ny));
    }
  return out;
};

// ---- Build the field --------------------------------------------------------------
function build() {
  fieldEl.innerHTML = "";
  grid = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sq";
    el.tabIndex = i === focusIdx ? 0 : -1;
    el.setAttribute("aria-label", `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: hidden`);
    fieldEl.append(el);
    grid.push({ mine: false, n: 0, open: false, flag: false, el });
    attach(el, i);
  }
  started = false;
  finished = false;
  updateMinesLeft();
}

function placeMines(safe) {
  // keep the first dig and its neighbours free of mines
  const banned = new Set([safe, ...neighbours(safe)]);
  let placed = 0;
  while (placed < MINES) {
    const i = Math.floor(Math.random() * grid.length);
    if (grid[i].mine || banned.has(i)) continue;
    grid[i].mine = true;
    placed++;
  }
  grid.forEach((sq, i) => (sq.n = neighbours(i).filter((j) => grid[j].mine).length));
  started = true;
}

// ---- Actions -----------------------------------------------------------------------------
function dig(i) {
  if (!shell.isPlaying() || finished) return;
  const sq = grid[i];
  if (sq.flag) return;
  if (!started) { placeMines(i); startTimer(); }
  if (sq.open) return chord(i);

  if (sq.mine) return lose(i);

  // flood-fill empty areas
  const stack = [i];
  let opened = 0;
  while (stack.length) {
    const j = stack.pop();
    const s = grid[j];
    if (s.open || s.flag) continue;
    s.open = true;
    opened++;
    paint(j, opened);
    if (s.n === 0) stack.push(...neighbours(j));
  }
  sound.play(opened > 1 ? "pop" : "tick", { pitch: opened > 1 ? 0.9 : 1 });
  checkWin();
}

/** Clicking an opened number whose flags are all placed digs the rest around it. */
function chord(i) {
  const sq = grid[i];
  const around = neighbours(i);
  const flags = around.filter((j) => grid[j].flag).length;
  if (sq.n === 0 || flags !== sq.n) return;
  for (const j of around) if (!grid[j].open && !grid[j].flag) {
    if (grid[j].mine) return lose(j);
    dig(j);
  }
}

function toggleFlag(i) {
  if (!shell.isPlaying() || finished) return;
  const sq = grid[i];
  if (sq.open) return;
  sq.flag = !sq.flag;
  paint(i);
  sound.play(sq.flag ? "tock" : "move");
  updateMinesLeft();
}

function updateMinesLeft() {
  shell.stat("mines", "Mines", MINES - grid.filter((s) => s.flag).length);
}

function paint(i, order = 0) {
  const sq = grid[i];
  const el = sq.el;
  el.className = "sq";
  el.textContent = "";
  let label = "hidden";
  if (sq.flag) { el.classList.add("is-flag"); label = "flagged"; }
  if (sq.open) {
    el.classList.add("is-open");
    el.style.setProperty("--d", `${Math.min(order, 30) * 12}ms`);
    if (sq.mine) { el.classList.add("is-mine"); label = "mine"; }
    else if (sq.n) { el.textContent = sq.n; el.dataset.n = sq.n; label = `${sq.n}`; }
    else label = "empty";
  }
  el.setAttribute("aria-label", `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${label}`);
}

function checkWin() {
  if (grid.some((s) => !s.mine && !s.open)) return;
  finished = true;
  stopTimer();
  grid.forEach((s, i) => { if (s.mine && !s.flag) { s.flag = true; paint(i); } });
  updateMinesLeft();
  shell.setScore(Math.max(1, Math.floor(elapsed)), { animate: false });
  setTimeout(() => shell.over({ message: "Field cleared! Every mine found.", win: true }), 500);
}

function lose(i) {
  finished = true;
  stopTimer();
  sound.play("bump");
  fieldEl.classList.add("is-boom");
  grid[i].el.classList.add("is-hit");
  // reveal every mine, one after another; mark wrong flags
  let n = 0;
  grid.forEach((s, j) => {
    if (s.mine && !s.flag) { s.open = true; paint(j, n++); }
    if (!s.mine && s.flag) s.el.classList.add("is-wrong-flag");
  });
  grid[i].el.classList.add("is-hit");
  setTimeout(() => {
    fieldEl.classList.remove("is-boom");
    shell.over({ message: "Boom! You dug up a mine.", record: false });
  }, 1100);
}

// ---- Timer ---------------------------------------------------------------------------------
function tick(now) {
  elapsed += (now - lastTick) / 1000;
  lastTick = now;
  if (Math.floor(elapsed) !== shell.score) shell.setScore(Math.floor(elapsed), { animate: false });
  raf = requestAnimationFrame(tick);
}
function startTimer() { timing = true; lastTick = performance.now(); raf = requestAnimationFrame(tick); }
function stopTimer() { timing = false; cancelAnimationFrame(raf); }

// ---- Input -----------------------------------------------------------------------------------
function attach(el, i) {
  let pressTimer = 0, longPressed = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      toggleFlag(i);
      navigator.vibrate?.(20);
    }, LONG_PRESS_MS);
  });
  const cancel = () => clearTimeout(pressTimer);
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("click", () => {
    setFocus(i);
    if (longPressed) return;
    flagMode ? toggleFlag(i) : dig(i);
  });
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); toggleFlag(i); });
}

function setFocus(i, move = false) {
  grid[focusIdx].el.tabIndex = -1;
  focusIdx = i;
  grid[i].el.tabIndex = 0;
  if (move) grid[i].el.focus({ preventScroll: true });
}

window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  const x = focusIdx % SIZE, y = Math.floor(focusIdx / SIZE);
  const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dx, dy] = moves[e.key];
    const nx = Math.max(0, Math.min(SIZE - 1, x + dx)), ny = Math.max(0, Math.min(SIZE - 1, y + dy));
    setFocus(idx(nx, ny), true);
  } else if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    toggleFlag(focusIdx);
  }
});

modeBtn.addEventListener("click", () => {
  flagMode = !flagMode;
  modeBtn.setAttribute("aria-pressed", String(flagMode));
  modeBtn.querySelector("[data-mode-label]").textContent = flagMode ? "Flag mode" : "Dig mode";
  sound.play("click");
});

// ---- Shell -------------------------------------------------------------------------------------
const shell = createShell({
  id: "minesweeper",
  title: "Minesweeper",
  scoreLabel: "Time",
  lowerIsBetter: true,
  format: formatTime,
  hint: "Dig every safe square. Numbers show how many mines are touching. Long-press or right-click to flag.",
  onStart() {
    stopTimer();
    elapsed = 0;
    focusIdx = 40;
    build();
    grid[focusIdx].el.focus({ preventScroll: true });
  },
  onPause() { if (timing) cancelAnimationFrame(raf); },
  onResume() { if (timing) { lastTick = performance.now(); raf = requestAnimationFrame(tick); } },
});

build();
