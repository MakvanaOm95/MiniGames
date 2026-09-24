// ============================================================================
// Lane Hopper — Tiny Tock
// ----------------------------------------------------------------------------
// A three-lane dodger. Your toy car drives up a play-mat road on its own;
// hop left or right between the three lanes to dodge cones, blocks and
// parked toy trucks. Every row leaves at least one lane open. Pick up stars
// for bonus points. The road speeds up as you go; one bump ends the run.
// Score = distance + star bonus.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

// ---- Settings (world is 360 × 600) --------------------------------------------
const W = 360;
const H = 600;
const LANES = [70, 180, 290];      // x of each lane's center
const CAR_Y = 470;                 // top of the player's car
const CAR_W = 50;
const CAR_H = 76;
const HOP_TIME = 0.11;             // seconds to slide into the next lane
const START_SPEED = 300;           // px per second
const MAX_SPEED = 780;
const ACCEL = 11;
const STAR_POINTS = 10;

const THINGS = {
  cone:  { w: 44, h: 48 },
  block: { w: 56, h: 56 },
  truck: { w: 58, h: 96 },
};
const BLOCK_COLORS = ["#2F8F83", "#7A4E8C", "#6FA9D8"];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---- State ---------------------------------------------------------------------------
let car, things, stars, sparks, speed, dist, bonus, time, nextRow, lastOpen, shake;
let raf = 0, last = 0, running = false;
let scale = 1, colors = {};

const canvas = document.getElementById("road");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => { scale = w / W; draw(); });

function readColors() {
  const css = getComputedStyle(canvas);
  const v = (n) => css.getPropertyValue(n).trim();
  colors = { bg: v("--lh-bg"), road: v("--lh-road"), mark: v("--lh-mark"), line: v("--lh-line"), text: v("--lh-text") };
}
readColors();
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });

const points = () => Math.floor(dist / 15) + bonus;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function reset() {
  car = { lane: 1, x: LANES[1], from: LANES[1], t: 1, tilt: 0 };
  things = [];
  stars = [];
  sparks = [];
  speed = START_SPEED;
  dist = 0;
  bonus = 0;
  time = 0;
  shake = 0;
  nextRow = 260;
  lastOpen = 1;
}

// ---- Spawning a row -------------------------------------------------------------------------
function spawnRow() {
  // block 1 or 2 lanes; the open lane is never more than one hop from the last open lane,
  // and later on two-lane walls get more common
  const twoChance = Math.min(0.6, 0.2 + time * 0.012);
  const open = Math.max(0, Math.min(2, lastOpen + pick([-1, 0, 1])));
  let blocked = [0, 1, 2].filter((l) => l !== open);
  if (Math.random() > twoChance) blocked = [pick(blocked)];
  lastOpen = open;

  let tallest = 0;
  for (const lane of blocked) {
    const kind = time > 12 && Math.random() < 0.3 ? "truck" : pick(["cone", "cone", "block"]);
    const { w, h } = THINGS[kind];
    things.push({ kind, lane, x: LANES[lane] - w / 2, y: -h, w, h, color: pick(BLOCK_COLORS) });
    tallest = Math.max(tallest, h);
  }
  // a star in the open lane now and then
  if (Math.random() < 0.4) stars.push({ x: LANES[open], y: -tallest / 2, spin: 0 });

  // enough room to react and hop, which shrinks a little as you speed up
  const gap = speed * 0.62 + 150;
  nextRow = tallest + rand(gap, gap + 140);
}

// ---- Hopping lanes ------------------------------------------------------------------------------
function hop(dir) {
  if (!shell.isPlaying()) return;
  const lane = car.lane + dir;
  if (lane < 0 || lane > 2) { sound.play("click"); return; }
  car.from = car.x;
  car.lane = lane;
  car.t = 0;
  car.tilt = dir;
  sound.play("move", { pitch: 1.3 + lane * 0.15 });
}

// ---- Loop ----------------------------------------------------------------------------------
function update(dt) {
  time += dt;
  speed = Math.min(MAX_SPEED, START_SPEED + time * ACCEL);
  const dy = speed * dt;
  dist += dy;

  // car slides toward its lane
  car.t = Math.min(1, car.t + dt / HOP_TIME);
  const ease = 1 - (1 - car.t) ** 3;
  car.x = car.from + (LANES[car.lane] - car.from) * ease;
  car.tilt *= Math.max(0, 1 - dt * 12);

  nextRow -= dy;
  if (nextRow <= 0) spawnRow();
  for (const t of things) t.y += dy;
  things = things.filter((t) => t.y < H + 20);
  for (const s of stars) { s.y += dy; s.spin += dt * 5; }
  stars = stars.filter((s) => s.y < H + 20 && !s.taken);
  sparks = sparks.filter((p) => (p.life -= dt) > 0);
  for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; }
  shake = Math.max(0, shake - dt * 3);

  // stars
  for (const s of stars) {
    if (Math.abs(s.x - car.x) < 36 && s.y > CAR_Y - 14 && s.y < CAR_Y + CAR_H + 14) {
      s.taken = true;
      bonus += STAR_POINTS;
      sound.play("pop", { pitch: 1.5 });
      if (!reducedMotion.matches) for (let i = 0; i < 7; i++) sparks.push({ x: s.x, y: s.y, vx: rand(-140, 140), vy: rand(-140, 140), life: 0.35 });
    }
  }

  // bumps (hitboxes a little smaller than the drawings)
  const pad = 6;
  const cx = car.x - CAR_W / 2;
  for (const t of things) {
    if (cx + pad < t.x + t.w - pad && cx + CAR_W - pad > t.x + pad &&
        CAR_Y + pad < t.y + t.h - pad && CAR_Y + CAR_H - pad > t.y + pad) {
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
  if (p < 50) return "Crash! Watch the road ahead.";
  if (p < 200) return `Good driving! ${p} points.`;
  if (p < 500) return `Great hopping! ${p} points.`;
  return `Road legend! ${p} points.`;
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

function wheels(x, y, w, h) {
  ctx.fillStyle = colors.line;
  for (const wy of [y + h * 0.18, y + h * 0.66]) {
    ctx.fillRect(x - 5, wy, 7, h * 0.18);
    ctx.fillRect(x + w - 2, wy, 7, h * 0.18);
  }
}

function drawCar() {
  const x = car.x - CAR_W / 2;
  ctx.save();
  ctx.translate(car.x, CAR_Y + CAR_H / 2);
  ctx.rotate(car.tilt * 0.18);
  ctx.translate(-car.x, -(CAR_Y + CAR_H / 2));
  wheels(x, CAR_Y, CAR_W, CAR_H);
  rrect(x, CAR_Y, CAR_W, CAR_H, 14, "#E8553D");
  rrect(x + 8, CAR_Y + 14, CAR_W - 16, 20, 6, "#BFE0F2");   // windscreen
  rrect(x + 8, CAR_Y + 40, CAR_W - 16, 24, 6, "#F08A6E");   // roof
  ctx.fillStyle = "#F2B33D";                                // headlights
  ctx.fillRect(x + 7, CAR_Y + 3, 9, 5);
  ctx.fillRect(x + CAR_W - 16, CAR_Y + 3, 9, 5);
  ctx.restore();
}

function drawThing(t) {
  if (t.kind === "cone") {
    const cx = t.x + t.w / 2;
    rrect(t.x, t.y + t.h - 10, t.w, 10, 3, "#E8553D");
    ctx.fillStyle = "#F08A4B";
    ctx.beginPath();
    ctx.moveTo(cx - 16, t.y + t.h - 10);
    ctx.lineTo(cx - 5, t.y + 2);
    ctx.lineTo(cx + 5, t.y + 2);
    ctx.lineTo(cx + 16, t.y + t.h - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#FBF7F0";
    ctx.fillRect(cx - 10, t.y + 20, 20, 7);
  } else if (t.kind === "block") {
    rrect(t.x, t.y, t.w, t.h, 7, t.color);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(t.x + 7, t.y + 7, t.w - 14, 5);
    ctx.fillStyle = "#FBF7F0";
    ctx.font = "800 26px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ABC"[t.lane], t.x + t.w / 2, t.y + t.h / 2 + 11);
  } else {
    // a parked toy truck
    wheels(t.x, t.y, t.w, t.h);
    rrect(t.x, t.y + 30, t.w, t.h - 30, 6, "#F2B33D");
    rrect(t.x + 4, t.y, t.w - 8, 34, 10, "#6FA9D8");
    rrect(t.x + 11, t.y + 6, t.w - 22, 12, 4, "#BFE0F2");
  }
}

function drawStar(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(Math.sin(s.spin) * 0.3);
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 7 : 16;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function draw() {
  if (!car) return;
  ctx.save();
  ctx.scale(scale, scale);
  if (shake && !reducedMotion.matches) ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);

  // grass edges and the road
  ctx.fillStyle = colors.bg;
  ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = colors.road;
  ctx.fillRect(14, -10, W - 28, H + 20);
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14, -10); ctx.lineTo(14, H + 10);
  ctx.moveTo(W - 14, -10); ctx.lineTo(W - 14, H + 10);
  ctx.stroke();
  // dashed lane lines, scrolling
  ctx.fillStyle = colors.mark;
  const off = dist % 60;
  for (const lx of [125, 235]) for (let y = -60 + off; y < H; y += 60) ctx.fillRect(lx - 3, y, 6, 30);
  // little flowers on the grass
  ctx.fillStyle = "#F2B33D";
  const fOff = dist % 90;
  for (let y = -90 + fOff; y < H; y += 90) { ctx.fillRect(4, y, 5, 5); ctx.fillRect(W - 9, y + 45, 5, 5); }

  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  for (const s of stars) drawStar(s);
  for (const t of things) drawThing(t);
  drawCar();

  for (const p of sparks) {
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = "#F2B33D";
    ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Controls ----------------------------------------------------------------------------------
// Tap the left or right half of the road to hop that way
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".game-overlay") || !shell.isPlaying()) return;
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  hop(e.clientX - r.left < r.width / 2 ? -1 : 1);
});
onKeys((name) => hop(name === "left" ? -1 : 1), {
  active: (name) => (name === "left" || name === "right") && shell.isPlaying(),
});

// ---- Shell ------------------------------------------------------------------------------------
const shell = createShell({
  id: "lane-hopper",
  title: "Lane Hopper",
  hint: "Tap the left or right side (or use ← →) to hop lanes. Dodge everything!",
  onStart() {
    reset();
    startLoop();
  },
  onPause() { stopLoop(); },
  onResume() { startLoop(); },
});

// Show the car behind the start screen
reset();
draw();
