// ============================================================================
// Brick Breaker — Tiny Tock
// ----------------------------------------------------------------------------
// Move the paddle to bounce the ball into the bricks. Clear every brick to
// reach the next level (faster ball, new layout). You have 3 lives.
// Top rows are worth more points.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

// ---- Settings (world is 480 × 600) --------------------------------------------
const W = 480;
const H = 600;
const COLS = 8;
const ROWS = 6;
const BRICK_H = 24;
const BRICK_GAP = 6;
const TOP = 70;
const PADDLE_W = 92;
const PADDLE_H = 16;
const PADDLE_Y = H - 50;
const BALL_R = 8;
const START_SPEED = 330;
const LIVES = 3;

const ROW_COLORS = ["#7A4E8C", "#E8553D", "#F08A6E", "#F2B33D", "#2F8F83", "#6FA9D8"];
const ROW_POINTS = [7, 6, 5, 4, 3, 2];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Level layouts: "#" = brick, "." = empty (8 columns × 6 rows)
const LAYOUTS = [
  ["########", "########", "########", "########", "########", "########"],
  ["#.####.#", "########", "##.##.##", "########", "#.####.#", "########"],
  ["...##...", "..####..", ".######.", "########", ".######.", "..####.."],
  ["#.#.#.#.", ".#.#.#.#", "#.#.#.#.", ".#.#.#.#", "#.#.#.#.", ".#.#.#.#"],
  ["########", "#......#", "#.####.#", "#.####.#", "#......#", "########"],
];

// ---- State ---------------------------------------------------------------------------
let paddle, ball, bricks, particles, lives, level, stuck, shake;
let keys = { left: false, right: false };
let pointerX = null;
let raf = 0, last = 0, running = false;
let scale = 1, colors = {};

const canvas = document.getElementById("court");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => { scale = w / W; draw(); });

function readColors() {
  const css = getComputedStyle(canvas);
  const v = (n) => css.getPropertyValue(n).trim();
  colors = { bg: v("--bb-bg"), grid: v("--bb-grid"), line: v("--bb-line"), text: v("--bb-text") };
}
readColors();
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });

function buildLevel() {
  const layout = LAYOUTS[(level - 1) % LAYOUTS.length];
  const bw = (W - 40 - BRICK_GAP * (COLS - 1)) / COLS;
  bricks = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (layout[r][c] === "#")
        bricks.push({ x: 20 + c * (bw + BRICK_GAP), y: TOP + r * (BRICK_H + BRICK_GAP), w: bw, h: BRICK_H, row: r, alive: true, hit: 0 });
}

function resetBall() {
  stuck = true;
  const speed = START_SPEED + (level - 1) * 35;
  ball = { x: paddle.x, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, speed };
}

function newGame() {
  lives = LIVES;
  level = 1;
  particles = [];
  shake = 0;
  paddle = { x: W / 2 };
  buildLevel();
  resetBall();
  showStats();
}

function showStats() {
  shell.stat("lives", "Lives", "♥".repeat(lives) || "–");
  shell.stat("level", "Level", level);
}

function launch() {
  if (!stuck || !shell.isPlaying()) return;
  stuck = false;
  const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.6;
  ball.vx = Math.cos(angle) * ball.speed;
  ball.vy = Math.sin(angle) * ball.speed;
  sound.play("tick");
}

// ---- Physics ------------------------------------------------------------------------------
function update(dt) {
  // paddle: follow the finger/mouse, or keys
  const half = PADDLE_W / 2;
  if (pointerX !== null) paddle.x += (pointerX - paddle.x) * Math.min(1, dt * 20);
  if (keys.left) paddle.x -= 520 * dt;
  if (keys.right) paddle.x += 520 * dt;
  paddle.x = Math.max(half + 6, Math.min(W - half - 6, paddle.x));

  if (stuck) {
    ball.x = paddle.x;
    ball.y = PADDLE_Y - BALL_R - 1;
  } else {
    // move in small steps so the ball never skips through a brick
    const steps = Math.ceil((ball.speed * dt) / 6);
    for (let s = 0; s < steps; s++) if (!stepBall(dt / steps)) break;
  }

  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; }
  for (const b of bricks) b.hit = Math.max(0, b.hit - dt * 5);
  shake = Math.max(0, shake - dt * 3);
}

/** Returns false if the ball was lost. */
function stepBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // walls
  if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); sound.play("click"); }
  if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); sound.play("click"); }
  if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); sound.play("click"); }

  // paddle: bounce angle depends on where it hits
  const half = PADDLE_W / 2;
  if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 6 && Math.abs(ball.x - paddle.x) <= half + BALL_R) {
    const offset = (ball.x - paddle.x) / half; // -1 … 1
    const angle = -Math.PI / 2 + offset * 1.05;
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.y = PADDLE_Y - BALL_R;
    sound.play("tock");
  }

  // bricks
  for (const b of bricks) {
    if (!b.alive) continue;
    const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
    const dx = ball.x - cx, dy = ball.y - cy;
    if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
    // bounce on the side we hit most
    const overlapX = BALL_R - Math.abs(dx);
    const overlapY = BALL_R - Math.abs(dy);
    if (dx === 0 && dy === 0) ball.vy *= -1;
    else if (overlapX < overlapY) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
    else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
    breakBrick(b);
    break;
  }

  // lost the ball
  if (ball.y - BALL_R > H) {
    lives--;
    shake = 1;
    sound.play("bump");
    showStats();
    if (lives <= 0) {
      running = false;
      setTimeout(() => shell.over({ message: `Out of lives on level ${level}.` }), 350);
    } else {
      resetBall();
    }
    return false;
  }
  return true;
}

function breakBrick(b) {
  b.alive = false;
  shell.addScore(ROW_POINTS[b.row]);
  sound.play("pop", { pitch: 1.35 - b.row * 0.08 });
  if (!reducedMotion.matches)
    for (let i = 0; i < 8; i++)
      particles.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 180, life: 0.6, color: ROW_COLORS[b.row] });

  if (bricks.every((x) => !x.alive)) {
    level++;
    sound.play("win");
    buildLevel();
    resetBall();
    showStats();
  }
}

// ---- Loop ----------------------------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  if (running) raf = requestAnimationFrame(frame);
}
function startLoop() {
  cancelAnimationFrame(raf);
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

// ---- Drawing ---------------------------------------------------------------------------------
function draw() {
  if (!paddle) return;
  ctx.save();
  ctx.scale(scale, scale);
  if (shake && !reducedMotion.matches) ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(-10, -10, W + 20, H + 20);
  // dotted grid
  ctx.fillStyle = colors.grid;
  for (let x = 20; x < W; x += 30) for (let y = 20; y < H; y += 30) ctx.fillRect(x, y, 2, 2);

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colors.line;
  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = ROW_COLORS[b.row];
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(b.x + 6, b.y + 5, b.w - 12, 4);
  }

  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;

  // paddle: a chunky toy block
  const px = paddle.x - PADDLE_W / 2;
  ctx.fillStyle = colors.line;
  ctx.beginPath();
  ctx.roundRect(px, PADDLE_Y + 4, PADDLE_W, PADDLE_H, 8);
  ctx.fill();
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath();
  ctx.roundRect(px, PADDLE_Y, PADDLE_W, PADDLE_H, 8);
  ctx.fill();
  ctx.stroke();

  // ball
  ctx.fillStyle = "#FBF7F0";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (stuck && shell.isPlaying()) {
    ctx.fillStyle = colors.text;
    ctx.font = "700 16px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Tap or press Space to launch", W / 2, PADDLE_Y - 40);
  }
  ctx.restore();
}

// ---- Controls ----------------------------------------------------------------------------------
function toWorldX(clientX) {
  const r = canvas.getBoundingClientRect();
  return ((clientX - r.left) / r.width) * W;
}
stage.addEventListener("pointermove", (e) => { if (shell.isPlaying()) pointerX = toWorldX(e.clientX); });
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".game-overlay") || !shell.isPlaying()) return;
  pointerX = toWorldX(e.clientX);
  launch();
});

const KEY_DIRS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying()) return;
  if (KEY_DIRS[e.code]) { e.preventDefault(); keys[KEY_DIRS[e.code]] = true; pointerX = null; }
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); launch(); }
});
window.addEventListener("keyup", (e) => { if (KEY_DIRS[e.code]) keys[KEY_DIRS[e.code]] = false; });

// ---- Shell ------------------------------------------------------------------------------------
const shell = createShell({
  id: "brick-breaker",
  title: "Brick Breaker",
  hint: "Move the paddle with your mouse, finger or arrow keys. Break every brick!",
  onStart() {
    newGame();
    pointerX = null;
    startLoop();
  },
  onPause() { running = false; cancelAnimationFrame(raf); keys = { left: false, right: false }; },
  onResume() { startLoop(); },
});

// Show a level behind the start screen
lives = LIVES; level = 1; particles = []; shake = 0;
paddle = { x: W / 2 };
buildLevel();
resetBall();
draw();
