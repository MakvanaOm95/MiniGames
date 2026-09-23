// ============================================================================
// Dots & Boxes — Tiny Tock
// ----------------------------------------------------------------------------
// Take turns with the computer drawing a line between two neighbouring dots.
// Draw the 4th side of a box and it's yours, and you go again.
// When every line is drawn, whoever owns more of the 16 boxes wins.
// Score = boxes you won this match.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const N = 4;           // 4 × 4 boxes (5 × 5 dots)
const YOU = 1, CPU = 2;

const boardEl = document.querySelector("[data-board]");
const statusEl = document.querySelector("[data-status]");

// lines: { key, kind: "h"|"v", r, c, owner, el }
let lines = [];
let boxes = [];        // boxes[r][c] = 0 | YOU | CPU
let turn = YOU;
let scores = { [YOU]: 0, [CPU]: 0 };
let pending = null;    // delayed step that survives pausing
let finished = false;

const key = (kind, r, c) => `${kind}${r}-${c}`;
let byKey = new Map();

// ---- Build the board ---------------------------------------------------------------------
function build() {
  boardEl.innerHTML = "";
  lines = [];
  byKey = new Map();
  boxes = Array.from({ length: N }, () => Array(N).fill(0));

  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const b = document.createElement("div");
      b.className = "db-box";
      b.style.setProperty("--r", r);
      b.style.setProperty("--c", c);
      b.dataset.box = `${r}-${c}`;
      boardEl.append(b);
    }

  const addLine = (kind, r, c) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `db-line db-line--${kind}`;
    el.style.setProperty("--r", r);
    el.style.setProperty("--c", c);
    el.setAttribute("aria-label", kind === "h" ? `Line across, row ${r + 1}, between dots ${c + 1} and ${c + 2}` : `Line down, column ${c + 1}, between dots ${r + 1} and ${r + 2}`);
    const line = { key: key(kind, r, c), kind, r, c, owner: 0, el };
    el.addEventListener("click", () => playerMove(line));
    lines.push(line);
    byKey.set(line.key, line);
    boardEl.append(el);
  };
  for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) addLine("h", r, c);
  for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) addLine("v", r, c);

  for (let r = 0; r <= N; r++)
    for (let c = 0; c <= N; c++) {
      const d = document.createElement("span");
      d.className = "db-dot";
      d.style.setProperty("--r", r);
      d.style.setProperty("--c", c);
      boardEl.append(d);
    }
}

// ---- Rules ------------------------------------------------------------------------------------
/** The four line keys around box (r, c). */
const sidesOf = (r, c) => [key("h", r, c), key("h", r + 1, c), key("v", r, c), key("v", r, c + 1)];

/** Boxes touching a line. */
function boxesOf(line) {
  const out = [];
  if (line.kind === "h") {
    if (line.r > 0) out.push([line.r - 1, line.c]);
    if (line.r < N) out.push([line.r, line.c]);
  } else {
    if (line.c > 0) out.push([line.r, line.c - 1]);
    if (line.c < N) out.push([line.r, line.c]);
  }
  return out;
}

const drawnCount = (taken, r, c) => sidesOf(r, c).filter((k) => taken.has(k)).length;

/** Draw a line for `who`. Returns how many boxes it completed. */
function draw(line, who) {
  line.owner = who;
  line.el.classList.add(who === YOU ? "is-you" : "is-cpu");
  line.el.disabled = true;
  const taken = takenSet();
  let made = 0;
  for (const [r, c] of boxesOf(line)) {
    if (drawnCount(taken, r, c) === 4) {
      boxes[r][c] = who;
      scores[who]++;
      made++;
      const b = boardEl.querySelector(`[data-box="${r}-${c}"]`);
      b.classList.add(who === YOU ? "is-you" : "is-cpu");
      b.textContent = who === YOU ? "You" : "CPU";
    }
  }
  if (made) {
    sound.play(who === YOU ? "pop" : "tock", { pitch: 1 + scores[who] * 0.03 });
    if (who === YOU) shell.setScore(scores[YOU]);
    shell.stat("cpu", "CPU", scores[CPU]);
  } else sound.play("click", { pitch: who === YOU ? 1.2 : 0.9 });
  return made;
}

const takenSet = () => new Set(lines.filter((l) => l.owner).map((l) => l.key));
const freeLines = () => lines.filter((l) => !l.owner);

function playerMove(line) {
  if (!shell.isPlaying() || turn !== YOU || line.owner || finished) return;
  const made = draw(line, YOU);
  if (checkEnd()) return;
  if (made) return say("Box! Go again.");
  turn = CPU;
  setBoardTurn();
  say("Computer’s turn…");
  later(cpuMove, 550);
}

function cpuMove() {
  const line = chooseLine();
  const made = draw(line, CPU);
  if (checkEnd()) return;
  if (made) return later(cpuMove, 420); // computer goes again
  turn = YOU;
  setBoardTurn();
  say("Your turn");
}

function checkEnd() {
  if (freeLines().length) return false;
  finished = true;
  const you = scores[YOU], cpu = scores[CPU];
  const msg = you > cpu ? `You won ${you}–${cpu}!` : you < cpu ? `The computer won ${cpu}–${you}.` : `A ${you}–${cpu} tie!`;
  say(msg);
  later(() => shell.over({ message: msg, win: you > cpu }), 900);
  return true;
}

// ---- Computer player -------------------------------------------------------------------------------------
function chooseLine() {
  const free = freeLines();
  const taken = takenSet();
  const shuffle = (a) => a.sort(() => Math.random() - 0.5);

  // 1. Complete a box if we can
  const finishing = free.filter((l) => boxesOf(l).some(([r, c]) => drawnCount(taken, r, c) === 3));
  if (finishing.length) return finishing[0];

  // 2. Otherwise play a "safe" line that doesn't hand over a box
  const safe = free.filter((l) => boxesOf(l).every(([r, c]) => drawnCount(taken, r, c) < 2));
  if (safe.length) return shuffle(safe)[0];

  // 3. No safe lines left: give away as few boxes as possible
  let best = null, bestLoss = Infinity;
  for (const l of shuffle(free)) {
    const loss = boxesGivenAway(taken, l);
    if (loss < bestLoss) { bestLoss = loss; best = l; }
  }
  return best;
}

/** If we draw `line`, how many boxes can the other player then take in a row? */
function boxesGivenAway(taken, line) {
  const t = new Set(taken);
  t.add(line.key);
  let count = 0;
  let found = true;
  while (found) {
    found = false;
    for (let r = 0; r < N && !found; r++)
      for (let c = 0; c < N && !found; c++)
        if (drawnCount(t, r, c) === 3) {
          sidesOf(r, c).forEach((k) => t.add(k));
          count++;
          found = true;
        }
  }
  return count;
}

// ---- Helpers ---------------------------------------------------------------------------------------------------
function say(text) { statusEl.textContent = text; }
function setBoardTurn() { boardEl.classList.toggle("is-cpu-turn", turn === CPU); }

function later(fn, ms) {
  const job = { fn };
  pending = job;
  setTimeout(() => run(job), ms);
}
function run(job) {
  if (pending !== job || !shell.isPlaying()) return; // paused → onResume retries
  pending = null;
  job.fn();
}

// ---- Shell -----------------------------------------------------------------------------------------------------
const shell = createShell({
  id: "dots-and-boxes",
  title: "Dots & Boxes",
  scoreLabel: "You",
  hint: "Take turns drawing lines. Close a box to claim it and go again. Most boxes wins!",
  onStart() {
    pending = null;
    finished = false;
    scores = { [YOU]: 0, [CPU]: 0 };
    shell.stat("cpu", "CPU", 0);
    build();
    turn = YOU;
    setBoardTurn();
    say("Your turn. Tap between two dots to draw a line.");
  },
  onResume() {
    if (pending) { const job = pending; setTimeout(() => run(job), 300); }
  },
});

shell.stat("cpu", "CPU", 0);
build();
say("Close more boxes than the computer.");
