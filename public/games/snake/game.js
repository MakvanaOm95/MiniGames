// ============================================================================
// Snake — Tiny Tock edition
// ----------------------------------------------------------------------------
// Steer the snake, eat apples to grow, don't hit the walls or yourself.
// Every 5 apples a golden clock appears for a few seconds: worth 3 points.
//
// The shared shell (score bar, start/pause/game-over screens, best score)
// comes from game-shell.js — this file only contains Snake's own rules
// and drawing.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import { onKeys, onSwipe, bindButtons } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

// ---- Settings you can tweak ---------------------------------------------------
const GRID = 17;            // board is GRID × GRID cells
const START_SPEED = 7;      // moves per second at the start
const MAX_SPEED = 15;       // top speed
const SPEED_PER_APPLE = 0.3;
const BONUS_EVERY = 5;      // a golden clock appears after every 5 apples
const BONUS_SECONDS = 6;    // …and stays this long
const BONUS_POINTS = 3;

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// ---- Game state ---------------------------------------------------------------
let snake = [];      // list of {x, y} cells, head first
let prev = [];       // where each segment was one step ago (for smooth movement)
let dir = DIRS.right;
let queue = [];      // turns the player pressed but that haven't happened yet
let food = null;
let bonus = null;    // { x, y, t } — t = seconds left
let apples = 0;
let speed = START_SPEED;
let acc = 0;         // time collected toward the next step
let alive = true;
let deathKind = "";
let deathT = 0;
let shake = 0;
let particles = [];
let last = 0;
let raf = 0;
let colors = {};
let size = 0;
let cell = 0;

// ---- Setup ---------------------------------------------------------------------
const canvas = document.getElementById("board");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => {
  size = w;
  cell = w / GRID;
  draw();
});

// Colors come from style.css so light/dark mode "just works"
function readColors() {
  const css = getComputedStyle(canvas);
  const v = (name) => css.getPropertyValue(name).trim();
  colors = {
    board: v("--snake-board"),
    check: v("--snake-check"),
    body: v("--snake-body"),
    belly: v("--snake-belly"),
    line: v("--snake-line"),
    apple: v("--snake-apple"),
    leaf: v("--snake-leaf"),
    gold: v("--snake-gold"),
  };
}
readColors();
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });

// ---- Rules -----------------------------------------------------------------------
function reset() {
  const mid = Math.floor(GRID / 2);
  snake = [0, 1, 2, 3].map((i) => ({ x: mid - i, y: mid }));
  prev = snake.map((s) => ({ ...s }));
  dir = DIRS.right;
  queue = [];
  apples = 0;
  speed = START_SPEED;
  acc = 0;
  alive = true;
  deathT = 0;
  shake = 0;
  particles = [];
  bonus = null;
  food = freeCell();
}

const same = (a, b) => a && b && a.x === b.x && a.y === b.y;

/** A random empty cell, or null if the board is full. */
function freeCell() {
  const free = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const c = { x, y };
      if (!snake.some((s) => same(s, c)) && !same(food, c) && !same(bonus, c)) free.push(c);
    }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

/** Move the snake one cell. */
function step() {
  if (queue.length) dir = queue.shift();
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) return die("wall");

  const eatsApple = same(head, food);
  const eatsBonus = same(head, bonus);
  const grows = eatsApple || eatsBonus;
  // The tail moves out of the way this step, unless we're growing
  const body = grows ? snake : snake.slice(0, -1);
  if (body.some((s) => same(s, head))) return die("self");

  prev = snake.map((s) => ({ ...s }));
  snake.unshift(head);
  if (grows) prev.push({ ...prev[prev.length - 1] });
  else snake.pop();

  if (eatsApple) {
    apples++;
    shell.addScore(1);
    speed = Math.min(MAX_SPEED, START_SPEED + apples * SPEED_PER_APPLE);
    sound.play("pop", { pitch: 1 + Math.min(apples * 0.015, 0.6) });
    burst(head, colors.apple);
    food = freeCell();
    if (apples % BONUS_EVERY === 0 && !bonus) {
      const spot = freeCell();
      if (spot) bonus = { ...spot, t: BONUS_SECONDS };
    }
    if (!food) return win();
  }
  if (eatsBonus) {
    shell.addScore(BONUS_POINTS);
    sound.play("ding", { pitch: 1.1 });
    burst(head, colors.gold, 18);
    bonus = null;
  }
}

function die(kind) {
  alive = false;
  deathKind = kind;
  deathT = 0;
  shake = 1;
  sound.play("bump");
}

function win() {
  alive = false;
  deathKind = "win";
  deathT = 0.4;
}

// ---- Main loop --------------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (alive) {
    acc += dt;
    const interval = 1 / speed;
    while (acc >= interval && alive) {
      acc -= interval;
      step();
    }
    if (bonus && (bonus.t -= dt) <= 0) bonus = null;
  } else {
    // short pause after a crash so the player sees what happened
    deathT += dt;
    if (deathT > 0.75) {
      draw();
      const messages = {
        wall: "Bonk! You hit the wall.",
        self: "Oops! You bit your own tail.",
        win: "You filled the whole board!",
      };
      shell.over({ message: messages[deathKind], win: deathKind === "win" });
      return;
    }
  }

  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 900 * dt;
  }
  shake = Math.max(0, shake - dt * 3);

  draw();
  raf = requestAnimationFrame(frame);
}

function burst(c, color, count = 10) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 120 + Math.random() * 180;
    particles.push({
      x: (c.x + 0.5) * cell,
      y: (c.y + 0.5) * cell,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 120,
      life: 0.5 + Math.random() * 0.3,
      color,
    });
  }
}

// ---- Drawing ------------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;

function draw() {
  if (!cell || !snake.length) return;
  const time = performance.now() / 1000;
  ctx.save();

  if (shake > 0 && !reducedMotion.matches) {
    ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);
  }

  // Board with a soft checkerboard
  ctx.fillStyle = colors.board;
  ctx.fillRect(-10, -10, size + 20, size + 20);
  ctx.fillStyle = colors.check;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) if ((x + y) % 2) ctx.fillRect(x * cell, y * cell, cell, cell);

  if (food) drawApple(food, time);
  if (bonus) drawBonus(bonus, time);
  drawSnake();

  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSnake() {
  const t = alive ? Math.min(acc * speed, 1) : 1;
  const pts = snake.map((s, i) => {
    const p = prev[i] ?? s;
    return { x: (lerp(p.x, s.x, t) + 0.5) * cell, y: (lerp(p.y, s.y, t) + 0.5) * cell };
  });

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const trace = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
  };
  const w = cell * 0.78;

  // outline, body, then a lighter belly stripe
  trace(); ctx.strokeStyle = colors.line; ctx.lineWidth = w; ctx.stroke();
  trace(); ctx.strokeStyle = colors.body; ctx.lineWidth = w - 5; ctx.stroke();
  trace(); ctx.strokeStyle = colors.belly; ctx.lineWidth = w * 0.22; ctx.stroke();

  // Head
  const h = pts[0];
  ctx.beginPath();
  ctx.arc(h.x, h.y, cell * 0.47, 0, Math.PI * 2);
  ctx.fillStyle = colors.body;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colors.line;
  ctx.stroke();

  // Eyes look where the snake is heading (or turn into X's after a crash)
  const d = dir;
  const side = { x: -d.y, y: d.x };
  for (const s of [-1, 1]) {
    const ex = h.x + d.x * cell * 0.14 + side.x * s * cell * 0.2;
    const ey = h.y + d.y * cell * 0.14 + side.y * s * cell * 0.2;
    if (alive) {
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + d.x * cell * 0.05, ey + d.y * cell * 0.05, cell * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = "#1B2A41";
      ctx.fill();
    } else {
      const r = cell * 0.09;
      ctx.beginPath();
      ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r);
      ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r);
      ctx.strokeStyle = "#1B2A41";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
}

function drawApple(c, time) {
  const bob = reducedMotion.matches ? 0 : Math.sin(time * 5) * cell * 0.04;
  const x = (c.x + 0.5) * cell;
  const y = (c.y + 0.52) * cell + bob;
  const r = cell * 0.34;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = colors.apple;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colors.line;
  ctx.stroke();
  // shine
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  // leaf
  ctx.beginPath();
  ctx.ellipse(x + r * 0.35, y - r * 1.05, r * 0.42, r * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = colors.leaf;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** The golden clock bonus, with a ring that shrinks as time runs out. */
function drawBonus(b, time) {
  const x = (b.x + 0.5) * cell;
  const y = (b.y + 0.5) * cell;
  const pulse = reducedMotion.matches ? 1 : 1 + Math.sin(time * 8) * 0.06;
  const r = cell * 0.36 * pulse;

  ctx.beginPath();
  ctx.arc(x, y, cell * 0.5, -Math.PI / 2, -Math.PI / 2 + (b.t / BONUS_SECONDS) * Math.PI * 2);
  ctx.strokeStyle = colors.gold;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = colors.gold;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colors.line;
  ctx.stroke();
  // clock hands
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y - r * 0.6);
  ctx.moveTo(x, y); ctx.lineTo(x + r * 0.45, y);
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---- Controls ------------------------------------------------------------------------
function turn(name) {
  const d = DIRS[name];
  if (!d || !alive || !shell.isPlaying()) return;
  const lastDir = queue.length ? queue[queue.length - 1] : dir;
  if (d === lastDir || (d.x === -lastDir.x && d.y === -lastDir.y)) return; // no U-turns
  if (queue.length < 3) queue.push(d);
}

onKeys(turn, { active: (name) => name in DIRS && shell.isPlaying() });
onSwipe(stage, turn);
bindButtons(document.querySelector(".game__pad"), turn);

// ---- Plug into the shared shell --------------------------------------------------------
const shell = createShell({
  id: "snake",
  title: "Snake",
  hint: "Eat apples to grow. Don’t hit the walls or your own tail!",
  onStart() {
    cancelAnimationFrame(raf);
    reset();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  },
  onPause() {
    cancelAnimationFrame(raf);
  },
  onResume() {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  },
});

// Draw the starting board behind the "Play" screen
reset();
draw();
