// ============================================================================
// Flip Side — Tiny Tock
// ----------------------------------------------------------------------------
// A disc-flipping strategy game on an 8 × 8 board, you (red) against the
// computer (navy). Place a disc so that one or more lines of the computer's
// discs are trapped between your new disc and another of yours: they all
// flip to your color. Straight or diagonal lines both count. If you can't
// move you pass. When neither side can move, whoever has more discs wins.
// Score = your discs at the end (a loss doesn't count as a best).
//
// The computer looks three moves ahead and values corners and edges.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const N = 8;
const YOU = 1;
const CPU = 2;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DEPTH = 3;
const CPU_DELAY = 650;

// How good each square is to own (corners great, squares next to corners risky)
const WEIGHTS = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [5, -2, 1, 0, 0, 1, -2, 5],
  [5, -2, 1, 0, 0, 1, -2, 5],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];

const boardEl = document.querySelector("[data-board]");
const turnEl = document.querySelector("[data-turn]");
const liveEl = document.querySelector("[data-live]");

let board = [];       // board[r][c] = 0 empty, 1 you, 2 cpu
let turn = YOU;
let cpuTimer = 0;
let focus = { r: 2, c: 3 };
let lastMove = null;
const cellEls = [];

// ---- Board setup -------------------------------------------------------------------------------
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fs-cell";
    b.tabIndex = -1;
    b.innerHTML = `<span class="fs-disc"><span class="fs-face fs-face--you"></span><span class="fs-face fs-face--cpu"></span></span>`;
    b.addEventListener("click", () => tap(r, c));
    b.addEventListener("focus", () => { focus = { r, c }; });
    boardEl.append(b);
    cellEls.push(b);
  }
}

function newBoard() {
  board = Array.from({ length: N }, () => Array(N).fill(0));
  board[3][3] = board[4][4] = CPU;
  board[3][4] = board[4][3] = YOU;
}

// ---- Rules ---------------------------------------------------------------------------------------
const other = (p) => (p === YOU ? CPU : YOU);

/** Discs that would flip if `p` played at (r, c). Empty list = not a legal move. */
function flipsFor(b, r, c, p) {
  if (b[r][c]) return [];
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === other(p)) {
      line.push([rr, cc]);
      rr += dr;
      cc += dc;
    }
    if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === p) out.push(...line);
  }
  return out;
}

function movesFor(b, p) {
  const list = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const f = flipsFor(b, r, c, p);
    if (f.length) list.push({ r, c, flips: f });
  }
  return list;
}

function apply(b, move, p) {
  const next = b.map((row) => row.slice());
  next[move.r][move.c] = p;
  for (const [r, c] of move.flips) next[r][c] = p;
  return next;
}

const count = (b, p) => b.flat().filter((x) => x === p).length;

// ---- Computer player (minimax with alpha-beta) --------------------------------------------------------
function evaluate(b) {
  const mine = movesFor(b, CPU).length, theirs = movesFor(b, YOU).length;
  if (!mine && !theirs) {
    const diff = count(b, CPU) - count(b, YOU);
    return diff > 0 ? 10000 + diff : diff < 0 ? -10000 + diff : 0;
  }
  let score = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (b[r][c] === CPU) score += WEIGHTS[r][c];
    else if (b[r][c] === YOU) score -= WEIGHTS[r][c];
  }
  return score + (mine - theirs) * 4;
}

function search(b, depth, p, alpha, beta) {
  const moves = movesFor(b, p);
  if (depth === 0) return evaluate(b);
  if (!moves.length) {
    if (!movesFor(b, other(p)).length) return evaluate(b);
    return search(b, depth - 1, other(p), alpha, beta);   // pass
  }
  if (p === CPU) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(apply(b, m, p), depth - 1, YOU, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(apply(b, m, p), depth - 1, CPU, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function cpuChoice() {
  const scored = movesFor(board, CPU).map((m) => ({ m, s: search(apply(board, m, CPU), DEPTH - 1, YOU, -Infinity, Infinity) }));
  const top = Math.max(...scored.map((x) => x.s));
  // pick randomly among moves that are (almost) as good as the best, so games vary
  const good = scored.filter((x) => x.s >= top - 2);
  return good[Math.floor(Math.random() * good.length)].m;
}

// ---- Turns ---------------------------------------------------------------------------------------------
function tap(r, c) {
  if (!shell.isPlaying() || turn !== YOU) return;
  const flips = flipsFor(board, r, c, YOU);
  if (!flips.length) { nope(r, c); return; }
  play({ r, c, flips }, YOU);
}

function play(move, p) {
  board = apply(board, move, p);
  lastMove = move;
  sound.play(p === YOU ? "tock" : "tick", { pitch: p === YOU ? 1 : 0.8 });
  if (move.flips.length >= 4) setTimeout(() => sound.play("pop", { pitch: 1 + Math.min(move.flips.length, 10) * 0.04 }), 120);
  render(move);
  say(`${p === YOU ? "You" : "Computer"} played ${"ABCDEFGH"[move.c]}${move.r + 1} and flipped ${move.flips.length}.`);
  nextTurn(other(p));
}

function nextTurn(p) {
  const canMove = movesFor(board, p).length > 0;
  const otherCan = movesFor(board, other(p)).length > 0;
  if (!canMove && !otherCan) { turn = 0; render(); setTimeout(finish, 700); return; }
  if (!canMove) {
    // pass
    turn = other(p);
    say(`${p === YOU ? "You have" : "The computer has"} no move and must pass.`);
    showTurn(p === YOU ? "You have no move: pass!" : "Computer passes. Your turn!");
    if (turn === CPU) scheduleCpu();
    render();
    return;
  }
  turn = p;
  showTurn(p === YOU ? "Your turn" : "Computer is thinking…");
  if (p === CPU) scheduleCpu();
  render();
}

function scheduleCpu() {
  clearTimeout(cpuTimer);
  cpuTimer = setTimeout(() => {
    if (!shell.isPlaying() || turn !== CPU) return;
    play(cpuChoice(), CPU);
  }, CPU_DELAY);
}

function finish() {
  const you = count(board, YOU), cpu = count(board, CPU);
  showTurn("Game over");
  const message = you > cpu ? `You win, ${you} to ${cpu}!` : you < cpu ? `The computer wins, ${cpu} to ${you}.` : `A tie, ${you} each!`;
  // only wins and ties count toward your best score
  shell.over({ message, win: you > cpu, record: you >= cpu });
}

function nope(r, c) {
  sound.play("bump", { pitch: 1.6 });
  const el = cellEls[r * N + c];
  el.classList.remove("is-nope");
  void el.offsetWidth;
  el.classList.add("is-nope");
}

// ---- Drawing ---------------------------------------------------------------------------------------
function render(move = null) {
  const hints = new Set(turn === YOU && shell.isPlaying() ? movesFor(board, YOU).map((m) => m.r * N + m.c) : []);
  const flipped = new Set(move ? move.flips.map(([r, c]) => r * N + c) : []);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const el = cellEls[i];
      const v = board[r][c];
      const cls = ["fs-cell"];
      if (v === YOU) cls.push("is-you");
      if (v === CPU) cls.push("is-cpu");
      if (hints.has(i)) cls.push("is-hint");
      if (flipped.has(i)) cls.push("is-flipping");
      if (move && move.r === r && move.c === c) cls.push("is-placed");
      if (lastMove && lastMove.r === r && lastMove.c === c) cls.push("is-last");
      el.className = cls.join(" ");
      el.tabIndex = r === focus.r && c === focus.c ? 0 : -1;
      const who = v === YOU ? "your disc" : v === CPU ? "computer disc" : hints.has(i) ? "empty, you can play here" : "empty";
      el.setAttribute("aria-label", `${"ABCDEFGH"[c]}${r + 1}: ${who}`);
    }
  }
  shell.setScore(count(board, YOU), { animate: !!move });
  shell.stat("cpu", "CPU", count(board, CPU));
}

function showTurn(text) {
  turnEl.textContent = text;
  turnEl.dataset.turn = turn === YOU ? "you" : turn === CPU ? "cpu" : "";
}
function say(text) { liveEl.textContent = text; }

// ---- Keyboard: arrow keys move, Enter / Space plays ---------------------------------------------
boardEl.addEventListener("keydown", (e) => {
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (!moves[e.code]) return;
  e.preventDefault();
  focus = {
    r: Math.max(0, Math.min(N - 1, focus.r + moves[e.code][0])),
    c: Math.max(0, Math.min(N - 1, focus.c + moves[e.code][1])),
  };
  render();
  cellEls[focus.r * N + focus.c].focus();
});

// ---- Shell ------------------------------------------------------------------------------------------
const shell = createShell({
  id: "flip-side",
  title: "Flip Side",
  scoreLabel: "You",
  hint: "Trap the computer’s discs between yours to flip them. Most discs at the end wins!",
  onStart() {
    clearTimeout(cpuTimer);
    newBoard();
    lastMove = null;
    focus = { r: 2, c: 3 };
    turn = YOU;
    showTurn("Your turn");
    render();
  },
  onPause() { clearTimeout(cpuTimer); },
  onResume() {
    if (turn === CPU) scheduleCpu();
    else if (turn === 0) finish();
  },
});

newBoard();
showTurn("You play red");
render();
