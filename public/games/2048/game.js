// ============================================================================
// 2048 — Tiny Tock edition
// ----------------------------------------------------------------------------
// Slide all tiles in one direction. Two tiles with the same number merge into
// one with double the value. Reach 2048 (and keep going!). The round ends
// when the board is full and no move can merge anything.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import { onKeys, onSwipe } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

const SIZE = 4;
const SLIDE_MS = 110; // must match the transition in style.css

const VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const stage = document.querySelector(".game__stage");
const layer = document.querySelector("[data-tiles]");
const toast = document.querySelector("[data-toast]");

let grid = [];          // grid[y][x] = tile or null
let nextId = 1;
let won = false;        // has the player reached 2048 yet?
let locked = false;     // true while the final "no moves" pause plays

// ---- Tiles ------------------------------------------------------------------
function makeTile(x, y, value, cls = "") {
  const el = document.createElement("div");
  el.className = `num ${cls}`;
  el.innerHTML = `<span class="num__face"></span>`;
  const tile = { id: nextId++, x, y, value, el };
  place(tile);
  layer.append(el);
  grid[y][x] = tile;
  return tile;
}

function place(tile) {
  tile.el.style.setProperty("--x", tile.x);
  tile.el.style.setProperty("--y", tile.y);
  tile.el.dataset.value = tile.value > 2048 ? "big" : tile.value;
  tile.el.firstChild.textContent = tile.value;
}

function emptyCells() {
  const out = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!grid[y][x]) out.push({ x, y });
  return out;
}

function addRandomTile() {
  const empty = emptyCells();
  if (!empty.length) return;
  const { x, y } = empty[Math.floor(Math.random() * empty.length)];
  makeTile(x, y, Math.random() < 0.9 ? 2 : 4, "is-new");
}

function reset() {
  layer.innerHTML = "";
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  won = false;
  locked = false;
  toast.hidden = true;
  addRandomTile();
  addRandomTile();
}

// ---- One move ------------------------------------------------------------------
function move(dirName) {
  const v = VECTORS[dirName];
  if (!v || !shell.isPlaying() || locked) return;

  // Walk the board starting from the side we're sliding toward
  const xs = [0, 1, 2, 3];
  const ys = [0, 1, 2, 3];
  if (v.x === 1) xs.reverse();
  if (v.y === 1) ys.reverse();

  let moved = false;
  let gained = 0;
  let biggest = 0;
  const mergedIds = new Set();
  const leaving = [];

  for (const y of ys) {
    for (const x of xs) {
      const tile = grid[y][x];
      if (!tile) continue;

      // Slide as far as possible
      let nx = x;
      let ny = y;
      while (true) {
        const tx = nx + v.x;
        const ty = ny + v.y;
        if (tx < 0 || ty < 0 || tx >= SIZE || ty >= SIZE || grid[ty][tx]) break;
        nx = tx;
        ny = ty;
      }

      // Merge with the next tile if it has the same value (once per move)
      const tx = nx + v.x;
      const ty = ny + v.y;
      const other = tx >= 0 && ty >= 0 && tx < SIZE && ty < SIZE ? grid[ty][tx] : null;
      if (other && other.value === tile.value && !mergedIds.has(other.id)) {
        grid[y][x] = null;
        grid[ty][tx] = null;
        tile.x = tx;
        tile.y = ty;
        place(tile);
        leaving.push(tile, other);
        const merged = makeTile(tx, ty, tile.value * 2, "is-merged");
        mergedIds.add(merged.id);
        gained += merged.value;
        biggest = Math.max(biggest, merged.value);
        moved = true;
      } else if (nx !== x || ny !== y) {
        grid[y][x] = null;
        grid[ny][nx] = tile;
        tile.x = nx;
        tile.y = ny;
        place(tile);
        moved = true;
      }
    }
  }

  if (!moved) {
    stage.classList.remove("is-nudged");
    void stage.offsetWidth;
    stage.classList.add("is-nudged");
    return;
  }

  // Remove the tiles that merged, once they've slid into place
  setTimeout(() => leaving.forEach((t) => t.el.remove()), SLIDE_MS);

  if (gained) {
    shell.addScore(gained);
    sound.play("pop", { pitch: 0.8 + Math.log2(biggest) * 0.07 });
  } else {
    sound.play("move");
  }

  addRandomTile();

  if (biggest === 2048 && !won) {
    won = true;
    showToast("2048! You did it. Keep going?");
    setTimeout(() => sound.play("win"), 150);
  }

  if (!canMove()) {
    locked = true;
    setTimeout(() => shell.over({ message: "No more moves!" }), 700);
  }
}

function canMove() {
  if (emptyCells().length) return true;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const v = grid[y][x].value;
      if ((x + 1 < SIZE && grid[y][x + 1].value === v) || (y + 1 < SIZE && grid[y + 1][x].value === v)) return true;
    }
  return false;
}

let toastTimer = 0;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 2600);
}

// ---- Controls ----------------------------------------------------------------------
onKeys(move, { active: (name) => name in VECTORS && shell.isPlaying() });
onSwipe(stage, move, { threshold: 28, repeat: false });

// ---- Shell ---------------------------------------------------------------------------
const shell = createShell({
  id: "2048",
  title: "2048",
  hint: "Slide the tiles. Matching numbers merge. Can you make 2048?",
  onStart: reset,
});

reset();
