// ============================================================================
// Grid Fit — Tiny Tock
// ----------------------------------------------------------------------------
// A block-placing puzzle on an 8 × 8 grid. You get three pieces at a time:
// drag each one onto the grid (or tap a piece, then tap where it should go).
// Fill a whole row or column and it clears. When all three are placed you get
// three new ones. Pieces can't be turned. The game ends when none of your
// pieces fit anywhere. Points: 1 per square placed, plus a bonus for lines
// (more lines at once = much bigger bonus).
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const N = 8;
const COLORS = ["#E8553D", "#F2B33D", "#2F8F83", "#6FA9D8", "#7A4E8C", "#F08A6E", "#8CC084"];

// Piece shapes as [row, col] squares. Some shapes appear twice to make them more common.
const SHAPES = [
  [[0, 0]],
  [[0, 0], [0, 1]], [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 1], [2, 0]], [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]],
  [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
];

const boardEl = document.querySelector("[data-board]");
const trayEl = document.querySelector("[data-tray]");
const liveEl = document.querySelector("[data-live]");

let grid = [];          // N×N, each null or a color
let pieces = [];        // up to 3: { cells, color } or null once placed
let selected = -1;      // piece chosen by tap or number key
let cursor = { r: 0, c: 0 };   // keyboard / hover position (piece's top-left)
let ghost = null;       // { r, c, piece, ok } preview on the board
let streak = 0;         // placements in a row that cleared a line
const cellEls = [];

// ---- Board setup -------------------------------------------------------------------------------
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const d = document.createElement("div");
    d.className = "gf-cell";
    boardEl.append(d);
    cellEls.push(d);
  }
}

const size = (cells) => ({ h: Math.max(...cells.map((p) => p[0])) + 1, w: Math.max(...cells.map((p) => p[1])) + 1 });

function fits(cells, r, c) {
  return cells.every(([dr, dc]) => {
    const rr = r + dr, cc = c + dc;
    return rr >= 0 && rr < N && cc >= 0 && cc < N && !grid[rr][cc];
  });
}
function fitsAnywhere(cells) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(cells, r, c)) return true;
  return false;
}

function newGrid() { grid = Array.from({ length: N }, () => Array(N).fill(null)); }

function dealPieces() {
  const shuffledColors = COLORS.slice().sort(() => Math.random() - 0.5);
  pieces = [0, 1, 2].map((i) => ({ cells: SHAPES[Math.floor(Math.random() * SHAPES.length)], color: shuffledColors[i] }));
  selected = -1;
  renderTray();
}

// ---- Placing -------------------------------------------------------------------------------------
function place(i, r, c) {
  const piece = pieces[i];
  if (!shell.isPlaying() || !piece || !fits(piece.cells, r, c)) {
    sound.play("bump", { pitch: 1.6 });
    return false;
  }
  for (const [dr, dc] of piece.cells) grid[r + dr][c + dc] = piece.color;
  pieces[i] = null;
  selected = -1;
  ghost = null;
  let gained = piece.cells.length;

  // find full rows and columns (checked together, then cleared together)
  const rows = [], cols = [];
  for (let k = 0; k < N; k++) {
    if (grid[k].every(Boolean)) rows.push(k);
    if (grid.every((row) => row[k])) cols.push(k);
  }
  const lines = rows.length + cols.length;
  const cleared = [];
  for (const rr of rows) for (let cc = 0; cc < N; cc++) cleared.push([rr, cc, grid[rr][cc]]);
  for (const cc of cols) for (let rr = 0; rr < N; rr++) cleared.push([rr, cc, grid[rr][cc]]);
  for (const [rr, cc] of cleared) grid[rr][cc] = null;

  if (lines) {
    streak++;
    const bonus = 10 * lines * lines + (streak > 1 ? 5 * (streak - 1) : 0);
    gained += bonus;
    sound.play("win", { pitch: 1 + Math.min(lines, 4) * 0.08 });
    say(`${lines} line${lines > 1 ? "s" : ""} cleared! +${bonus}${streak > 1 ? `, streak ${streak}` : ""}`);
  } else {
    streak = 0;
    sound.play("tock", { pitch: 0.9 + piece.cells.length * 0.05 });
  }
  shell.addScore(gained);
  renderBoard(cleared);

  if (pieces.every((p) => !p)) dealPieces();
  else renderTray();

  // game over when nothing left in the tray fits
  if (!pieces.some((p) => p && fitsAnywhere(p.cells))) {
    renderTray();
    setTimeout(() => shell.over({ message: "No room left for these pieces!" }), 600);
  }
  return true;
}

// ---- Drawing ---------------------------------------------------------------------------------------
function renderBoard(cleared = []) {
  const preview = new Map();
  if (ghost) for (const [dr, dc] of ghost.piece.cells) preview.set((ghost.r + dr) * N + ghost.c + dc, ghost.ok);
  // rows/cols that the ghost would complete light up, so you can see what will clear
  const willClear = new Set();
  if (ghost?.ok) {
    const filled = (r, c) => grid[r][c] || preview.has(r * N + c);
    for (let k = 0; k < N; k++) {
      let row = true, col = true;
      for (let j = 0; j < N; j++) { if (!filled(k, j)) row = false; if (!filled(j, k)) col = false; }
      if (row) for (let j = 0; j < N; j++) willClear.add(k * N + j);
      if (col) for (let j = 0; j < N; j++) willClear.add(j * N + k);
    }
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const el = cellEls[i];
      const color = grid[r][c];
      const p = preview.get(i);
      el.className = "gf-cell" + (color ? " is-full" : "") + (p === true ? " is-ghost" : "") + (p === false ? " is-bad" : "") + (willClear.has(i) ? " is-line" : "");
      el.style.setProperty("--block", color || (p ? ghost.piece.color : ""));
    }
  }
  for (const [r, c, color] of cleared) {
    const el = cellEls[r * N + c];
    el.classList.add("is-popping");
    el.style.setProperty("--block", color);
    setTimeout(() => { if (!grid[r][c]) { el.classList.remove("is-popping"); el.style.setProperty("--block", ""); } }, 320);
  }
}

function renderTray() {
  trayEl.innerHTML = "";
  pieces.forEach((piece, i) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "gf-slot";
    if (!piece) {
      slot.disabled = true;
      slot.setAttribute("aria-label", "Empty slot");
      trayEl.append(slot);
      return;
    }
    const { h, w } = size(piece.cells);
    const canFit = fitsAnywhere(piece.cells);
    slot.classList.toggle("is-selected", i === selected);
    slot.classList.toggle("is-stuck", !canFit);
    slot.setAttribute("aria-label", `Piece ${i + 1}: ${piece.cells.length} squares, ${w} wide and ${h} tall${canFit ? "" : ", doesn’t fit anywhere"}`);
    slot.setAttribute("aria-pressed", String(i === selected));
    const mini = document.createElement("span");
    mini.className = "gf-piece";
    mini.style.setProperty("--w", w);
    mini.style.setProperty("--h", h);
    for (const [r, c] of piece.cells) {
      const b = document.createElement("span");
      b.style.gridArea = `${r + 1} / ${c + 1}`;
      b.style.setProperty("--block", piece.color);
      mini.append(b);
    }
    slot.append(mini);
    slot.addEventListener("pointerdown", (e) => startDrag(e, i, slot));
    slot.addEventListener("click", (e) => { if (e.detail === 0) select(i); });   // keyboard Enter/Space
    trayEl.append(slot);
  });
}

function say(text) { liveEl.textContent = text; }

// ---- Selecting (tap or number keys) ------------------------------------------------------------
function select(i) {
  if (!shell.isPlaying() || !pieces[i]) return;
  selected = selected === i ? -1 : i;
  sound.play("tick");
  if (selected >= 0) {
    const { h, w } = size(pieces[i].cells);
    cursor = { r: Math.min(cursor.r, N - h), c: Math.min(cursor.c, N - w) };
    showGhost(cursor.r, cursor.c);
  } else {
    ghost = null;
    renderBoard();
  }
  renderTray();
}

function showGhost(r, c) {
  if (selected < 0 || !pieces[selected]) { ghost = null; renderBoard(); return; }
  const piece = pieces[selected];
  ghost = { r, c, piece, ok: fits(piece.cells, r, c) };
  renderBoard();
}

/** Where the cells sit on screen: top-left corner and distance from one cell to the next. */
function gridBox() {
  const a = cellEls[0].getBoundingClientRect();
  const b = cellEls[N * N - 1].getBoundingClientRect();
  const cell = (b.right - a.left) / N;
  return { left: a.left, top: a.top, right: b.right, bottom: b.bottom, cell };
}

/** Grid cell under a point, with the piece centered on it. */
function anchorAt(clientX, clientY, piece) {
  const rect = gridBox();
  const cell = rect.cell;
  const { h, w } = size(piece.cells);
  // near an edge, nudge the piece so it stays on the grid
  return {
    r: Math.max(0, Math.min(N - h, Math.round((clientY - rect.top) / cell - h / 2))),
    c: Math.max(0, Math.min(N - w, Math.round((clientX - rect.left) / cell - w / 2))),
    inside: clientX >= rect.left - cell && clientX <= rect.right + cell && clientY >= rect.top - cell && clientY <= rect.bottom + cell,
  };
}

boardEl.addEventListener("pointermove", (e) => {
  if (selected < 0 || drag || e.pointerType === "touch") return;
  const a = anchorAt(e.clientX, e.clientY, pieces[selected]);
  if (a.r !== ghost?.r || a.c !== ghost?.c) showGhost(a.r, a.c);
});
boardEl.addEventListener("click", (e) => {
  if (selected < 0 || !shell.isPlaying()) return;
  const a = anchorAt(e.clientX, e.clientY, pieces[selected]);
  place(selected, a.r, a.c);
  if (selected >= 0) showGhost(a.r, a.c);
});
boardEl.addEventListener("pointerleave", () => { if (!drag && ghost && selected >= 0 && !keyboardGhost) { ghost = null; renderBoard(); } });

// ---- Dragging --------------------------------------------------------------------------------------
let drag = null;
let keyboardGhost = false;

function startDrag(e, i, slot) {
  if (!shell.isPlaying() || !pieces[i] || e.button > 0) return;
  e.preventDefault();
  const piece = pieces[i];
  const cell = gridBox().cell;
  const { h, w } = size(piece.cells);
  const float = slot.querySelector(".gf-piece").cloneNode(true);
  float.classList.add("gf-float");
  float.style.setProperty("--cell", `${cell - 3}px`);   // 3px = the gap between cells
  document.body.append(float);
  // on touch, lift the piece above the finger so you can see where it goes
  const lift = e.pointerType === "touch" ? cell * (h / 2 + 1.4) : 0;
  drag = { i, float, slot, lift, w, h, cell, startX: e.clientX, startY: e.clientY, moved: false };
  slot.classList.add("is-dragging");
  slot.setPointerCapture(e.pointerId);
  moveDrag(e);
  sound.play("tick");
}

function moveDrag(e) {
  if (!drag) return;
  const { float, lift, w, h, cell } = drag;
  if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 8) drag.moved = true;
  float.style.transform = `translate(${e.clientX - (w * cell) / 2}px, ${e.clientY - lift - (h * cell) / 2}px)`;
  const a = anchorAt(e.clientX, e.clientY - lift, pieces[drag.i]);
  if (!a.inside) { if (ghost) { ghost = null; renderBoard(); } return; }
  if (a.r !== ghost?.r || a.c !== ghost?.c) {
    ghost = { r: a.r, c: a.c, piece: pieces[drag.i], ok: fits(pieces[drag.i].cells, a.r, a.c) };
    renderBoard();
  }
}

function endDrag(e, cancelled = false) {
  if (!drag) return;
  const { i, float, slot, lift, moved } = drag;
  drag = null;
  float.remove();
  slot.classList.remove("is-dragging");
  if (!moved && !cancelled) {
    // a tap, not a drag: select the piece
    ghost = null;
    select(i);
    return;
  }
  const a = anchorAt(e.clientX, e.clientY - lift, pieces[i]);
  ghost = null;
  if (!cancelled && a.inside && fits(pieces[i].cells, a.r, a.c)) place(i, a.r, a.c);
  else { if (a.inside && !cancelled) sound.play("bump", { pitch: 1.6 }); renderBoard(); }
}

trayEl.addEventListener("pointermove", moveDrag);
trayEl.addEventListener("pointerup", (e) => endDrag(e));
trayEl.addEventListener("pointercancel", (e) => endDrag(e, true));

// ---- Keyboard ----------------------------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 3) { e.preventDefault(); keyboardGhost = true; select(n - 1); return; }
  if (selected < 0) return;
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (moves[e.code]) {
    e.preventDefault();
    const { h, w } = size(pieces[selected].cells);
    cursor = {
      r: Math.max(0, Math.min(N - h, cursor.r + moves[e.code][0])),
      c: Math.max(0, Math.min(N - w, cursor.c + moves[e.code][1])),
    };
    keyboardGhost = true;
    sound.play("move");
    showGhost(cursor.r, cursor.c);
  } else if ((e.code === "Enter" || e.code === "Space") && !/^(BUTTON|A)$/.test(e.target.tagName)) {
    e.preventDefault();
    place(selected, cursor.r, cursor.c);
  }
});

// ---- Shell ------------------------------------------------------------------------------------------
const shell = createShell({
  id: "grid-fit",
  title: "Grid Fit",
  hint: "Drag pieces onto the grid. Fill a row or column to clear it. Don’t run out of room!",
  onStart() {
    newGrid();
    streak = 0;
    ghost = null;
    keyboardGhost = false;
    dealPieces();
    renderBoard();
  },
  onPause() { if (drag) { drag.float.remove(); drag.slot.classList.remove("is-dragging"); drag = null; ghost = null; renderBoard(); } },
});

// A board to look at behind the start screen
newGrid();
dealPieces();
renderBoard();
