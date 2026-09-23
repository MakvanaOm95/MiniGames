// ============================================================================
// Four in a Row — Tiny Tock
// ----------------------------------------------------------------------------
// Take turns with the computer dropping discs into a 7-column board.
// First to line up four (across, down or diagonally) wins the round.
// Score = your win streak. A draw keeps your streak; a loss ends the game.
// The computer looks a few moves ahead but isn't perfect — you can beat it!
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

const COLS = 7;
const ROWS = 6;
const YOU = 1;
const CPU = 2;
const AI_DEPTH = 5;
const AI_MISTAKE = 0.12; // chance the computer picks its 2nd-best move

const boardEl = document.querySelector("[data-board]");
const statusEl = document.querySelector("[data-status]");

let board = [];          // board[r][c], row 0 = top
let turn = YOU;
let busy = false;        // animations / computer thinking
let hoverCol = 3;
let round = 1;
let pending = null;      // a delayed step waiting to run: { fn } (survives pausing)
const cellEls = [];
const colBtns = [];

// ---- Build the board once ----------------------------------------------------------
function build() {
  const grid = document.createElement("div");
  grid.className = "c4-grid";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "c4-cell";
      cell.innerHTML = `<span class="disc"></span>`;
      grid.append(cell);
      (cellEls[r] ??= [])[c] = cell;
    }
  const cols = document.createElement("div");
  cols.className = "c4-cols";
  for (let c = 0; c < COLS; c++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "c4-col";
    b.setAttribute("aria-label", `Drop in column ${c + 1}`);
    b.addEventListener("click", () => playerDrop(c));
    b.addEventListener("pointerenter", () => setHover(c));
    b.addEventListener("focus", () => setHover(c));
    cols.append(b);
    colBtns.push(b);
  }
  boardEl.append(grid, cols);
}

function reset(keepTurn = false) {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (const row of cellEls) for (const cell of row) cell.className = "c4-cell";
  busy = false;
  if (!keepTurn) turn = YOU;
  setHover(hoverCol);
}

function setHover(c) {
  hoverCol = c;
  boardEl.style.setProperty("--hover", c);
  boardEl.classList.toggle("can-drop", turn === YOU && !busy && shell?.isPlaying());
}

function say(text) { statusEl.textContent = text; }

/** Run fn after ms — but if the game is paused by then, wait until it resumes. */
function later(fn, ms) {
  const job = { fn };
  pending = job;
  setTimeout(() => runPending(job), ms);
}
function runPending(job) {
  if (pending !== job || !shell.isPlaying()) return; // cancelled, or paused (onResume retries)
  pending = null;
  job.fn();
}

// ---- Rules --------------------------------------------------------------------------------
const openRow = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; };
const validCols = (b) => [...Array(COLS).keys()].filter((c) => b[0][c] === 0);

function winLine(b, who) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of dirs) {
        const line = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== who) break;
          line.push([rr, cc]);
        }
        if (line.length === 4) return line;
      }
  return null;
}

/** Animate a disc falling into column c. Resolves when it lands. */
function drop(c, who) {
  const r = openRow(board, c);
  if (r === -1) return Promise.resolve(false);
  board[r][c] = who;
  const cell = cellEls[r][c];
  cell.style.setProperty("--fall", r + 1);
  cell.classList.add(who === YOU ? "is-you" : "is-cpu", "is-dropping");
  sound.play("move", { pitch: 1.2 });
  return new Promise((resolve) => {
    setTimeout(() => {
      cell.classList.remove("is-dropping");
      sound.play("tock", { pitch: 0.8 + (ROWS - r) * 0.04 });
      resolve(true);
    }, 180 + r * 45);
  });
}

async function playerDrop(c) {
  if (!shell.isPlaying() || busy || turn !== YOU || openRow(board, c) === -1) return;
  busy = true;
  setHover(c);
  await drop(c, YOU);
  if (await afterMove(YOU)) return;
  turn = CPU;
  say("Computer is thinking…");
  setHover(hoverCol);
  later(cpuMove, 380);
}

async function cpuMove() {
  const c = chooseMove();
  await drop(c, CPU);
  if (await afterMove(CPU)) return;
  turn = YOU;
  busy = false;
  say("Your turn");
  setHover(hoverCol);
}

/** Returns true if the round ended. */
async function afterMove(who) {
  const line = winLine(board, who);
  if (line) {
    line.forEach(([r, c]) => cellEls[r][c].classList.add("is-win"));
    if (who === YOU) {
      shell.addScore(1);
      sound.play("win");
      say("You win this round! Next round…");
      later(nextRound, 1500);
    } else {
      sound.play("bump");
      say("The computer got four in a row.");
      later(() => shell.over({ message: shell.score ? `Streak over at ${shell.score}!` : "The computer wins this time." }), 1300);
    }
    return true;
  }
  if (validCols(board).length === 0) {
    say("It’s a draw! Your streak is safe.");
    sound.play("ding", { pitch: 0.8 });
    later(nextRound, 1400);
    return true;
  }
  return false;
}

function nextRound() {
  round++;
  // take turns going first
  turn = round % 2 ? YOU : CPU;
  reset(true);
  shell.stat("round", "Round", round);
  if (turn === CPU) {
    busy = true;
    say("Computer goes first this round…");
    later(cpuMove, 600);
  } else say("Your turn");
}

// ---- Computer player (minimax with alpha-beta pruning) ------------------------------------------
function scoreWindow(w, who) {
  const opp = who === CPU ? YOU : CPU;
  const mine = w.filter((v) => v === who).length;
  const theirs = w.filter((v) => v === opp).length;
  const empty = 4 - mine - theirs;
  if (mine === 4) return 1000;
  if (mine === 3 && empty === 1) return 6;
  if (mine === 2 && empty === 2) return 2;
  if (theirs === 3 && empty === 1) return -8;
  return 0;
}

function evaluate(b) {
  let s = 0;
  for (let r = 0; r < ROWS; r++) if (b[r][3] === CPU) s += 3; else if (b[r][3] === YOU) s -= 3; // center is strong
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c + 3 < COLS) s += scoreWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], CPU);
      if (r + 3 < ROWS) s += scoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], CPU);
      if (r + 3 < ROWS && c + 3 < COLS) s += scoreWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], CPU);
      if (r + 3 < ROWS && c - 3 >= 0) s += scoreWindow([b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]], CPU);
    }
  return s;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6]; // try center columns first (faster pruning)

function minimax(b, depth, alpha, beta, maximizing) {
  if (winLine(b, CPU)) return 100000 + depth;
  if (winLine(b, YOU)) return -100000 - depth;
  const moves = ORDER.filter((c) => b[0][c] === 0);
  if (depth === 0 || moves.length === 0) return evaluate(b);
  if (maximizing) {
    let best = -Infinity;
    for (const c of moves) {
      const r = openRow(b, c);
      b[r][c] = CPU;
      best = Math.max(best, minimax(b, depth - 1, alpha, beta, false));
      b[r][c] = 0;
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const c of moves) {
    const r = openRow(b, c);
    b[r][c] = YOU;
    best = Math.min(best, minimax(b, depth - 1, alpha, beta, true));
    b[r][c] = 0;
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function chooseMove() {
  const b = board.map((row) => [...row]);
  const scored = ORDER.filter((c) => b[0][c] === 0).map((c) => {
    const r = openRow(b, c);
    b[r][c] = CPU;
    const s = minimax(b, AI_DEPTH - 1, -Infinity, Infinity, false);
    b[r][c] = 0;
    return { c, s };
  });
  scored.sort((a, z) => z.s - a.s);
  // Always take a winning move or block a loss; otherwise sometimes slip up
  const mustPlay = scored[0].s >= 100000 || (scored[1] && scored[1].s <= -100000);
  if (!mustPlay && scored[1] && scored[1].s > -100000 && Math.random() < AI_MISTAKE) return scored[1].c;
  return scored[0].c;
}

// ---- Keyboard -----------------------------------------------------------------------------------------
onKeys(
  (name) => {
    if (name === "left") colBtns[Math.max(0, hoverCol - 1)].focus();
    else if (name === "right") colBtns[Math.min(COLS - 1, hoverCol + 1)].focus();
    else if (name === "down") playerDrop(hoverCol);
  },
  { active: (name) => ["left", "right", "down"].includes(name) && shell.isPlaying() }
);

// ---- Shell ------------------------------------------------------------------------------------------------
const shell = createShell({
  id: "four-in-a-row",
  title: "Four in a Row",
  scoreLabel: "Streak",
  hint: "Drop discs and line up four in a row before the computer does. How long can your win streak go?",
  onStart() {
    pending = null;
    round = 1;
    reset();
    shell.stat("round", "Round", 1);
    say("Your turn. You’re red, the computer is yellow.");
    colBtns[3].focus({ preventScroll: true });
  },
  onResume() {
    if (pending) { const job = pending; setTimeout(() => runPending(job), 300); }
  },
});

build();
reset();
shell.stat("round", "Round", 1);
say("Line up four to win.");
