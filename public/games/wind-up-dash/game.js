// ============================================================================
// Wind-Up Dash — Tiny Tock
// ----------------------------------------------------------------------------
// An endless runner. A little wind-up robot runs along the toy shelf by
// itself: tap to jump over toy blocks (tap again in the air for a double
// jump). Paper planes fly at head height: stay on the ground and they pass
// overhead. Grab gears for bonus points. The shelf speeds up as you go;
// one bump and the run is over. Score = distance + gear bonus.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

// ---- Settings (world is 500 × 250) --------------------------------------------
const W = 500;
const H = 250;
const GROUND = 205;            // y of the shelf top
const BOT_X = 90;
const BOT_W = 34;
const BOT_H = 40;
const GRAVITY = 2300;
const JUMP_V = 760;
const DOUBLE_V = 640;
const START_SPEED = 270;       // px per second
const MAX_SPEED = 640;
const ACCEL = 9;               // px/s gained every second
const GEAR_POINTS = 10;
const PLANES_FROM = 120;       // planes start showing up after this many points

const BLOCK_COLORS = ["#E8553D", "#F2B33D", "#2F8F83", "#6FA9D8", "#7A4E8C"];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---- State ---------------------------------------------------------------------------
let bot, obstacles, gears, puffs, speed, dist, bonus, nextGap, time, shake;
let raf = 0, last = 0, running = false;
let scale = 1, colors = {};

const canvas = document.getElementById("dash");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => { scale = w / W; draw(); });

function readColors() {
  const css = getComputedStyle(canvas);
  const v = (n) => css.getPropertyValue(n).trim();
  colors = { bg: v("--wd-bg"), far: v("--wd-far"), grid: v("--wd-grid"), line: v("--wd-line"), text: v("--wd-text") };
}
readColors();
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });

const points = () => Math.floor(dist / 12) + bonus;
const rand = (a, b) => a + Math.random() * (b - a);

function reset() {
  bot = { y: GROUND - BOT_H, vy: 0, onGround: true, jumps: 0, step: 0 };
  obstacles = [];
  gears = [];
  puffs = [];
  speed = START_SPEED;
  dist = 0;
  bonus = 0;
  time = 0;
  shake = 0;
  nextGap = 420;
}

// ---- Spawning ------------------------------------------------------------------------------
function spawn() {
  const x = W + 20;
  const roll = Math.random();
  if (points() >= PLANES_FROM && roll < 0.22) {
    // a paper plane at head height: stay on the ground!
    obstacles.push({ kind: "plane", x, y: GROUND - BOT_H - 36, w: 46, h: 22 });
  } else if (roll < 0.5) {
    obstacles.push({ kind: "block", x, y: GROUND - 34, w: 34, h: 34, color: BLOCK_COLORS[Math.floor(Math.random() * 5)] });
  } else if (roll < 0.72) {
    obstacles.push({ kind: "tall", x, y: GROUND - 62, w: 30, h: 62, color: BLOCK_COLORS[Math.floor(Math.random() * 5)] });
  } else if (roll < 0.88) {
    obstacles.push({ kind: "wide", x, y: GROUND - 28, w: 66, h: 28, color: BLOCK_COLORS[Math.floor(Math.random() * 5)] });
  } else {
    obstacles.push({ kind: "top", x, y: GROUND - 30, w: 30, h: 30, spin: 0 });
  }
  // sometimes a gear floats above the obstacle, as a reward for a good jump
  if (Math.random() < 0.45) gears.push({ x: x + rand(-10, 30), y: GROUND - rand(105, 150), spin: 0 });

  // the gap to the next obstacle grows with speed, so there's always room to land
  const airTime = (2 * JUMP_V) / GRAVITY;
  const min = speed * airTime * 0.9 + 70;
  nextGap = rand(min, min + 300);
}

// ---- Jumping --------------------------------------------------------------------------------
function jump() {
  if (!shell.isPlaying()) return;
  if (bot.onGround) {
    bot.vy = -JUMP_V;
    bot.onGround = false;
    bot.jumps = 1;
    sound.play("move", { pitch: 1.6 });
  } else if (bot.jumps === 1) {
    bot.vy = -DOUBLE_V;
    bot.jumps = 2;
    sound.play("move", { pitch: 2.1 });
    if (!reducedMotion.matches) for (let i = 0; i < 5; i++) puffs.push({ x: BOT_X + BOT_W / 2, y: bot.y + BOT_H, vx: rand(-60, 60), vy: rand(20, 80), life: 0.4 });
  }
}

// ---- Loop ----------------------------------------------------------------------------------
function update(dt) {
  time += dt;
  speed = Math.min(MAX_SPEED, START_SPEED + time * ACCEL);
  const dx = speed * dt;
  dist += dx;

  // robot
  bot.vy += GRAVITY * dt;
  bot.y += bot.vy * dt;
  if (bot.y >= GROUND - BOT_H) {
    if (!bot.onGround) sound.play("tock", { pitch: 0.7 });
    bot.y = GROUND - BOT_H;
    bot.vy = 0;
    bot.onGround = true;
    bot.jumps = 0;
  }
  bot.step += dt * speed / 22;

  // world scrolls left
  nextGap -= dx;
  if (nextGap <= 0) spawn();
  for (const o of obstacles) {
    o.x -= dx;
    if (o.kind === "top") o.spin += dt * 14;
  }
  obstacles = obstacles.filter((o) => o.x + o.w > -20);
  for (const g of gears) { g.x -= dx; g.spin += dt * 4; }
  gears = gears.filter((g) => g.x > -20 && !g.taken);
  puffs = puffs.filter((p) => (p.life -= dt) > 0);
  for (const p of puffs) { p.x += (p.vx - speed * 0.5) * dt; p.y += p.vy * dt; }
  shake = Math.max(0, shake - dt * 3);

  // gears
  const cx = BOT_X + BOT_W / 2, cy = bot.y + BOT_H / 2;
  for (const g of gears) {
    if (Math.hypot(g.x - cx, g.y - cy) < 30) {
      g.taken = true;
      bonus += GEAR_POINTS;
      sound.play("pop", { pitch: 1.5 });
      if (!reducedMotion.matches) for (let i = 0; i < 6; i++) puffs.push({ x: g.x, y: g.y, vx: rand(-120, 120), vy: rand(-120, 60), life: 0.35, gold: true });
    }
  }

  // bumps (hitboxes are a little smaller than the drawings, to feel fair)
  const pad = 5;
  for (const o of obstacles) {
    if (BOT_X + pad < o.x + o.w - pad && BOT_X + BOT_W - pad > o.x + pad &&
        bot.y + pad < o.y + o.h - pad && bot.y + BOT_H - pad > o.y + pad) {
      crash();
      return;
    }
  }
  shell.setScore(points());
}

function crash() {
  running = false;
  shake = 1;
  shell.setScore(points());
  sound.play("bump");
  draw();
  setTimeout(() => shell.over({ message: overMessage() }), 450);
}

function overMessage() {
  const p = points();
  if (p < 50) return "Bonk! The robot needs more winding.";
  if (p < 200) return `Nice dash! ${p} points.`;
  if (p < 500) return `Great run! ${p} points.`;
  return `Unstoppable! ${p} points.`;
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  if (!running) return;
  draw();
  raf = requestAnimationFrame(frame);
}
function startLoop() {
  cancelAnimationFrame(raf);
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}
function stopLoop() { running = false; cancelAnimationFrame(raf); }

// ---- Drawing ---------------------------------------------------------------------------------
function rrect(x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function drawGear(x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.35;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBot() {
  const x = BOT_X, y = bot.y;
  const legA = bot.onGround ? Math.sin(bot.step) * 5 : 3;
  // legs
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 32); ctx.lineTo(x + 10 + legA, y + BOT_H);
  ctx.moveTo(x + 24, y + 32); ctx.lineTo(x + 24 - legA, y + BOT_H);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  // wind-up key on its back, always turning
  ctx.save();
  ctx.translate(x - 4, y + 18);
  ctx.scale(Math.cos(time * 8), 1);
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath();
  ctx.ellipse(-7, -6, 6, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(-7, 6, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - 4, y + 18); ctx.lineTo(x + 2, y + 18); ctx.stroke();
  // body + head
  rrect(x, y + 12, BOT_W, 22, 6, "#E8553D");
  rrect(x + 5, y, BOT_W - 10, 15, 5, "#FBF7F0");
  // eye + antenna
  ctx.fillStyle = "#1B2A41";
  ctx.beginPath(); ctx.arc(x + 22, y + 7, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 17, y); ctx.lineTo(x + 17, y - 7); ctx.stroke();
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath(); ctx.arc(x + 17, y - 8, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // belly dial
  ctx.fillStyle = "#FBF7F0";
  ctx.beginPath(); ctx.arc(x + 17, y + 23, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawObstacle(o) {
  if (o.kind === "plane") {
    ctx.fillStyle = "#FBF7F0";
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.h / 2);
    ctx.lineTo(o.x + o.w, o.y);
    ctx.lineTo(o.x + o.w * 0.7, o.y + o.h / 2);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x, o.y + o.h / 2); ctx.lineTo(o.x + o.w * 0.7, o.y + o.h / 2); ctx.stroke();
    // speed lines behind it
    ctx.beginPath();
    ctx.moveTo(o.x + o.w + 8, o.y + 4); ctx.lineTo(o.x + o.w + 20, o.y + 4);
    ctx.moveTo(o.x + o.w + 6, o.y + o.h - 4); ctx.lineTo(o.x + o.w + 16, o.y + o.h - 4);
    ctx.stroke();
  } else if (o.kind === "top") {
    // a spinning top
    const cx = o.x + o.w / 2;
    ctx.fillStyle = "#7A4E8C";
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + 10);
    ctx.lineTo(o.x + o.w, o.y + 10);
    ctx.lineTo(cx, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#F2B33D";
    ctx.fillRect(o.x + 4 + (Math.sin(o.spin) + 1) * 6, o.y + 11, 6, 6);
    ctx.beginPath(); ctx.moveTo(cx, o.y + 10); ctx.lineTo(cx, o.y - 2); ctx.stroke();
  } else if (o.kind === "tall") {
    rrect(o.x, o.y + o.h / 2, o.w, o.h / 2, 4, o.color);
    rrect(o.x, o.y, o.w, o.h / 2, 4, BLOCK_COLORS[(BLOCK_COLORS.indexOf(o.color) + 2) % 5]);
  } else {
    rrect(o.x, o.y, o.w, o.h, 5, o.color);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(o.x + 5, o.y + 5, o.w - 10, 4);
  }
}

function draw() {
  if (!bot) return;
  ctx.save();
  ctx.scale(scale, scale);
  if (shake && !reducedMotion.matches) ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 8);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // far away: rolling hills of toy boxes (slow parallax)
  ctx.fillStyle = colors.far;
  const hillOff = (dist * 0.2) % 200;
  for (let x = -hillOff - 200; x < W + 200; x += 200) {
    ctx.beginPath();
    ctx.arc(x + 100, GROUND + 30, 110, Math.PI, 0);
    ctx.fill();
  }
  // dotted grid
  ctx.fillStyle = colors.grid;
  const gridOff = (dist * 0.5) % 30;
  for (let x = 15 - gridOff; x < W; x += 30) for (let y = 20; y < GROUND - 10; y += 30) ctx.fillRect(x, y, 2, 2);

  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";

  // the shelf
  ctx.fillStyle = colors.line;
  ctx.fillRect(-10, GROUND, W + 20, H - GROUND + 10);
  ctx.fillStyle = "#F2B33D";
  const stripeOff = dist % 40;
  for (let x = -stripeOff; x < W; x += 40) ctx.fillRect(x, GROUND + 18, 20, 5);

  for (const g of gears) drawGear(g.x, g.y, 9, g.spin);
  for (const o of obstacles) drawObstacle(o);
  drawBot();

  for (const p of puffs) {
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = p.gold ? "#F2B33D" : colors.text;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Controls ----------------------------------------------------------------------------------
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".game-overlay") || !shell.isPlaying()) return;
  e.preventDefault();
  jump();
});
onKeys(() => jump(), {
  active: (name, e) => (name === "action" || name === "up") && !e.repeat && shell.isPlaying(),
});

// ---- Shell ------------------------------------------------------------------------------------
const shell = createShell({
  id: "wind-up-dash",
  title: "Wind-Up Dash",
  hint: "Tap or press Space to jump over the toys. Tap again in the air to double jump!",
  onStart() {
    reset();
    startLoop();
  },
  onPause() { stopLoop(); },
  onResume() { startLoop(); },
});

// Show the robot behind the start screen
reset();
draw();
