// ============================================================================
// Block Drop — Tiny Tock
// ----------------------------------------------------------------------------
// Shapes made of four blocks fall into a 10 × 20 well. Move and rotate them
// to fill complete rows; full rows clear and score points. Every 10 rows the
// level goes up and pieces fall faster. The round ends when the stack
// reaches the top.
//
// Keys: ← → move · ↑ rotate · ↓ soft drop · Space hard drop
// Touch: buttons under the board, or drag sideways / tap to rotate /
//        flick down to drop.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

const COLS = 10;
const ROWS = 20;
const LINE_POINTS = [0, 100, 300, 500, 800];
const LOCK_DELAY = 0.45;   // seconds a piece can rest on the stack before locking
const MAX_LOCK_RESETS = 12;

// The seven shapes (1 = block). Colors come from the Tiny Tock palette.
const SHAPES = {
  I: { color: "#6FA9D8", m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { color: "#F2B33D", m: [[1, 1], [1, 1]] },
  T: { color: "#7A4E8C", m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { color: "#2F8F83", m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { color: "#E8553D", m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { color: "#2F6FB0", m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: "#F08A6E", m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---- State ------------------------------------------------------------------------
let board = [];            // board[row][col] = color or null
let piece = null;          // { type, m, x, y, color }
let bag = [];
let nextType = "T";
let lines = 0, level = 1;
let fallT = 0, lockT = 0, lockResets = 0;
let clearing = null;       // { rows, t } while a line-clear flash plays
let dead = false;
let raf = 0, last = 0, running = false;
let cell = 0, colors = {};

const canvas = document.getElementById("well");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => { cell = w / COLS; draw(); });

function readColors() {
  const css = getComputedStyle(canvas);
  const v = (n) => css.getPropertyValue(n).trim();
  colors = { bg: v("--bd-bg"), grid: v("--bd-grid"), line: "#1B2A41", ghost: v("--bd-ghost") };
}
readColors();
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });

// ---- Pieces ---------------------------------------------------------------------------
function nextFromBag() {
  // "7-bag": every shape appears once in each group of seven, in random order
  if (!bag.length) {
    bag = Object.keys(SHAPES);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

function spawn() {
  const type = nextType;
  nextType = nextFromBag();
  const m = SHAPES[type].m.map((r) => [...r]);
  piece = { type, m, color: SHAPES[type].color, x: Math.floor((COLS - m[0].length) / 2), y: type === "I" ? -1 : 0 };
  lockT = 0;
  lockResets = 0;
  drawNext();
  if (collides(piece.m, piece.x, piece.y)) gameOver();
}

function collides(m, x, y) {
  for (let r = 0; r < m.length; r++)
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const bx = x + c, by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  return false;
}

const rotateCW = (m) => m[0].map((_, c) => m.map((row) => row[c]).reverse());

// ---- Moves --------------------------------------------------------------------------------
function canAct() { return shell.isPlaying() && piece && !clearing && !dead; }

function shift(dx) {
  if (!canAct() || collides(piece.m, piece.x + dx, piece.y)) return false;
  piece.x += dx;
  touchedWhileGrounded();
  sound.play("click", { pitch: 1.4 });
  return true;
}

function rotate() {
  if (!canAct() || piece.type === "O") return;
  const m = rotateCW(piece.m);
  // try in place, then nudge left/right/up ("wall kicks")
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
    if (!collides(m, piece.x + dx, piece.y + dy)) {
      piece.m = m;
      piece.x += dx;
      piece.y += dy;
      touchedWhileGrounded();
      sound.play("tick", { pitch: 1.2 });
      return;
    }
  }
}

function softDrop() {
  if (!canAct()) return;
  if (!collides(piece.m, piece.x, piece.y + 1)) {
    piece.y++;
    fallT = 0;
    shell.addScore(1);
  } else lock();
}

function hardDrop() {
  if (!canAct()) return;
  let n = 0;
  while (!collides(piece.m, piece.x, piece.y + 1)) { piece.y++; n++; }
  shell.addScore(n * 2);
  sound.play("tock", { pitch: 0.8 });
  lock();
}

// Moving a piece that's resting on the stack gives you a little more time
function touchedWhileGrounded() {
  if (collides(piece.m, piece.x, piece.y + 1) && lockResets < MAX_LOCK_RESETS) {
    lockT = 0;
    lockResets++;
  }
}

function lock() {
  for (let r = 0; r < piece.m.length; r++)
    for (let c = 0; c < piece.m[r].length; c++)
      if (piece.m[r][c]) {
        const by = piece.y + r;
        if (by < 0) return gameOver();
        board[by][piece.x + c] = piece.color;
      }
  sound.play("tock");
  piece = null;

  const full = [];
  for (let r = 0; r < ROWS; r++) if (board[r].every(Boolean)) full.push(r);
  if (full.length) {
    clearing = { rows: full, t: reducedMotion.matches ? 0.05 : 0.25 };
    const n = full.length;
    shell.addScore(LINE_POINTS[n] * level);
    sound.play(n >= 4 ? "win" : "pop", { pitch: 1 + n * 0.1 });
  } else spawn();
}

function finishClear() {
  for (const r of clearing.rows) {
    board.splice(r, 1);
    board.unshift(Array(COLS).fill(null));
  }
  lines += clearing.rows.length;
  clearing = null;
  const newLevel = 1 + Math.floor(lines / 10);
  if (newLevel > level) { level = newLevel; sound.play("ding"); }
  showStats();
  spawn();
}

function gameOver() {
  dead = true;
  piece = null;
  sound.play("bump");
  setTimeout(endRound, 600);
}
function endRound() {
  running = false;
  // (if the game was paused just now, onResume calls this again)
  shell.over({ message: `Topped out after ${lines} ${lines === 1 ? "line" : "lines"}!` });
}

function showStats() { shell.stat("level", "Level", level); }

// ---- Loop --------------------------------------------------------------------------------------
function gravityInterval() { return Math.max(0.07, 0.8 - (level - 1) * 0.07); }

function update(dt) {
  if (dead) return;
  if (clearing) {
    clearing.t -= dt;
    if (clearing.t <= 0) finishClear();
    return;
  }
  if (!piece) return;
  if (collides(piece.m, piece.x, piece.y + 1)) {
    lockT += dt;
    if (lockT >= LOCK_DELAY) lock();
  } else {
    fallT += dt;
    if (fallT >= gravityInterval()) { fallT = 0; piece.y++; }
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  if (running) raf = requestAnimationFrame(frame);
}
function startLoop() { cancelAnimationFrame(raf); running = true; last = performance.now(); raf = requestAnimationFrame(frame); }

// ---- Drawing ---------------------------------------------------------------------------------------
function block(x, y, color, alpha = 1) {
  const p = 1.5;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x * cell + p, y * cell + p, cell - p * 2, cell - p * 2, cell * 0.18);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.line;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(x * cell + cell * 0.22, y * cell + cell * 0.18, cell * 0.56, cell * 0.14);
  ctx.globalAlpha = 1;
}

function draw() {
  if (!cell || !board.length) return;
  const H = ROWS * cell;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, COLS * cell, H);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * cell, 0); ctx.lineTo(c * cell, H); ctx.stroke(); }
  for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * cell); ctx.lineTo(COLS * cell, r * cell); ctx.stroke(); }

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) {
        const flashing = clearing?.rows.includes(r);
        block(c, r, flashing ? "#FBF7F0" : board[r][c]);
      }

  if (piece) {
    // ghost: where the piece will land
    let gy = piece.y;
    while (!collides(piece.m, piece.x, gy + 1)) gy++;
    ctx.setLineDash([4, 4]);
    for (let r = 0; r < piece.m.length; r++)
      for (let c = 0; c < piece.m[r].length; c++)
        if (piece.m[r][c] && gy + r >= 0) {
          ctx.strokeStyle = colors.ghost;
          ctx.lineWidth = 2;
          ctx.strokeRect((piece.x + c) * cell + 3, (gy + r) * cell + 3, cell - 6, cell - 6);
        }
    ctx.setLineDash([]);
    for (let r = 0; r < piece.m.length; r++)
      for (let c = 0; c < piece.m[r].length; c++)
        if (piece.m[r][c] && piece.y + r >= 0) block(piece.x + c, piece.y + r, piece.color);
  }
}

// "Next" preview lives in the score bar
let nextCtx = null;
function drawNext() {
  if (!nextCtx) {
    const box = shell.stat("next", "Next", "");
    const holder = box.querySelector(".hud-stat__value");
    const c = document.createElement("canvas");
    c.className = "next-preview";
    c.width = 88; c.height = 44;
    c.setAttribute("aria-hidden", "true");
    holder.replaceChildren(c);
    nextCtx = c.getContext("2d");
  }
  const m = SHAPES[nextType].m.filter((row) => row.some(Boolean));
  const s = 18;
  const w = m[0].length * s, h = m.length * s;
  nextCtx.clearRect(0, 0, 88, 44);
  for (let r = 0; r < m.length; r++)
    for (let c = 0; c < m[r].length; c++)
      if (m[r][c]) {
        nextCtx.fillStyle = SHAPES[nextType].color;
        nextCtx.strokeStyle = "#1B2A41";
        nextCtx.lineWidth = 2;
        const x = (88 - w) / 2 + c * s, y = (44 - h) / 2 + r * s;
        nextCtx.fillRect(x + 1, y + 1, s - 2, s - 2);
        nextCtx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      }
}

// ---- Controls -------------------------------------------------------------------------------------------
onKeys(
  (name) => {
    if (name === "left") shift(-1);
    else if (name === "right") shift(1);
    else if (name === "up") rotate();
    else if (name === "down") softDrop();
    else if (name === "action") hardDrop();
  },
  { active: (name) => ["left", "right", "up", "down", "action"].includes(name) && shell.isPlaying() }
);

// Touch buttons (hold ← → ↓ to repeat)
document.querySelectorAll(".bd-pad [data-act]").forEach((btn) => {
  let hold = 0, rep = 0;
  const act = () => ({ left: () => shift(-1), right: () => shift(1), rotate, down: softDrop, drop: hardDrop })[btn.dataset.act]();
  const stop = () => { clearTimeout(hold); clearInterval(rep); btn.classList.remove("is-pressed"); };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.classList.add("is-pressed");
    act();
    if (["left", "right", "down"].includes(btn.dataset.act)) hold = setTimeout(() => (rep = setInterval(act, 55)), 170);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener("click", (e) => { if (e.detail === 0) act(); }); // keyboard
});

// Gestures on the board: drag sideways to move, tap to rotate, flick down to drop
{
  let start = null, movedCells = 0;
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".game-overlay")) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
    movedCells = 0;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!start) return;
    const cellPx = canvas.getBoundingClientRect().width / COLS;
    const target = Math.round((e.clientX - start.x) / cellPx);
    while (movedCells < target && shift(1)) movedCells++;
    while (movedCells > target && shift(-1)) movedCells--;
  });
  stage.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, dt = performance.now() - start.t;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) rotate();
    else if (dy > 60 && dy > Math.abs(dx) * 1.5 && dt < 350) hardDrop();
    start = null;
  });
  stage.addEventListener("pointercancel", () => (start = null));
}

// ---- Shell -------------------------------------------------------------------------------------------------
const shell = createShell({
  id: "block-drop",
  title: "Block Drop",
  hint: "Fill whole rows to clear them. Arrows to move and rotate, Space to drop. On phones use the buttons or drag the board.",
  onStart() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bag = [];
    nextType = nextFromBag();
    lines = 0;
    level = 1;
    fallT = 0;
    clearing = null;
    dead = false;
    showStats();
    spawn();
    startLoop();
  },
  onPause() { running = false; cancelAnimationFrame(raf); },
  onResume() { if (dead) endRound(); else startLoop(); },
});

// Empty well behind the start screen
board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
nextType = nextFromBag();
showStats();
drawNext();
draw();
