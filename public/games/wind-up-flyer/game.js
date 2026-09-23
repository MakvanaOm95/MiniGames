// ============================================================================
// Wind-Up Flyer — Tiny Tock
// ----------------------------------------------------------------------------
// A little clockwork bird flies through gaps in towers of toy blocks.
// Tap / click / Space to flap. Each tower you pass is 1 point.
// Hitting a tower, the ground or the ceiling ends the round.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

// ---- Settings (world units: the world is always 400 wide × 600 tall) -------
const W = 400;
const H = 600;
const GROUND = 64;          // height of the ground strip
const GRAVITY = 1500;
const FLAP = -440;          // upward speed after a flap
const SPEED = 150;          // how fast towers scroll left
const TOWER_W = 70;
const TOWER_EVERY = 1.45;   // seconds between towers
const GAP_START = 175;      // gap size at the start…
const GAP_MIN = 135;        // …shrinks to this
const BIRD_X = 110;
const BIRD_R = 17;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---- State ----------------------------------------------------------------------
let bird, towers, clouds, particles;
let spawnT = 0, groundX = 0, time = 0;
let alive = true, deathT = 0, flash = 0, cause = "";
let running = false;       // is the loop animating?
let raf = 0, last = 0;
let scale = 1, colors = {};

const canvas = document.getElementById("sky");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => {
  scale = w / W;
  draw();
});

function readColors() {
  const css = getComputedStyle(canvas);
  const v = (n) => css.getPropertyValue(n).trim();
  colors = { sky: v("--fly-sky"), skyLow: v("--fly-sky-low"), cloud: v("--fly-cloud"), line: "#1B2A41", ground: v("--fly-ground"), groundDark: v("--fly-ground-dark"), star: v("--fly-star") };
}
readColors();
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });

const BLOCK_COLORS = ["#E8553D", "#F2B33D", "#2F8F83", "#6FA9D8", "#7A4E8C"];

function reset() {
  bird = { y: H * 0.42, vy: 0, rot: 0, key: 0 };
  towers = [];
  particles = [];
  clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 100 + Math.random() * 60, y: 40 + Math.random() * 220, s: 0.6 + Math.random() * 0.7 }));
  spawnT = 0.6;
  alive = true;
  deathT = 0;
  flash = 0;
}

// ---- Rules -------------------------------------------------------------------------
function flap() {
  if (!shell.isPlaying() || !alive) return;
  bird.vy = FLAP;
  bird.key += 1.2;
  sound.play("tick", { pitch: 0.9 + Math.random() * 0.2 });
}

function addTower() {
  const gap = Math.max(GAP_MIN, GAP_START - shell.score * 2.5);
  const top = 70 + Math.random() * (H - GROUND - gap - 140);
  // each tower is a stack of colored toy blocks
  const seed = Math.floor(Math.random() * 5);
  towers.push({ x: W + 20, top, gap, seed, passed: false });
}

function hit(why) {
  cause = why;
  alive = false;
  deathT = 0;
  flash = 1;
  bird.vy = -250;
  sound.play("bump");
}

function update(dt) {
  time += dt;
  if (alive) {
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;
    bird.rot = Math.max(-0.45, Math.min(1.2, bird.vy / 600));
    bird.key += dt * 3;

    spawnT -= dt;
    if (spawnT <= 0) { addTower(); spawnT += TOWER_EVERY; }

    for (const t of towers) {
      t.x -= SPEED * dt;
      if (!t.passed && t.x + TOWER_W < BIRD_X - BIRD_R) {
        t.passed = true;
        shell.addScore(1);
        sound.play("pop", { pitch: 1 + Math.min(shell.score * 0.02, 0.5) });
        puff(BIRD_X, bird.y);
      }
      // collision: circle vs the two tower rectangles
      if (collides(t.x, 0, TOWER_W, t.top) || collides(t.x, t.top + t.gap, TOWER_W, H)) return hit("tower");
    }
    towers = towers.filter((t) => t.x > -TOWER_W - 10);

    if (bird.y + BIRD_R > H - GROUND) return hit("ground");
    if (bird.y - BIRD_R < 0) return hit("sky");
    groundX = (groundX + SPEED * dt) % 40;
    for (const c of clouds) {
      c.x -= SPEED * 0.25 * c.s * dt;
      if (c.x < -120) { c.x = W + 40; c.y = 40 + Math.random() * 220; }
    }
  } else {
    // falling after a crash
    deathT += dt;
    bird.vy += GRAVITY * dt;
    bird.y = Math.min(H - GROUND - BIRD_R, bird.y + bird.vy * dt);
    bird.rot = Math.min(1.6, bird.rot + dt * 6);
    if (deathT > 0.8) {
      const tips = { tower: "Bonk! You hit a tower.", ground: "Splat! Tap a little sooner.", sky: "Too high! Tap a little less." };
      shell.over({ message: shell.score ? `You flew past ${shell.score} ${shell.score === 1 ? "tower" : "towers"}!` : tips[cause] });
      running = false;
    }
  }
  flash = Math.max(0, flash - dt * 3);
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; }
}

function collides(rx, ry, rw, rh) {
  const cx = Math.max(rx, Math.min(BIRD_X, rx + rw));
  const cy = Math.max(ry, Math.min(bird.y, ry + rh));
  const dx = BIRD_X - cx, dy = bird.y - cy;
  return dx * dx + dy * dy < (BIRD_R - 3) * (BIRD_R - 3);
}

function puff(x, y) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({ x: x - 10, y, vx: Math.cos(a) * 60 - 60, vy: Math.sin(a) * 60, life: 0.5, r: 3 + Math.random() * 3 });
  }
}

// ---- Loop ------------------------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (shell.isPlaying()) update(dt);
  else time += dt; // idle bobbing on the start screen
  draw();
  if (running) raf = requestAnimationFrame(frame);
}
function startLoop() {
  cancelAnimationFrame(raf);
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

// ---- Drawing ------------------------------------------------------------------------------
function draw() {
  if (!bird) return;
  ctx.save();
  ctx.scale(scale, scale);

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, colors.sky);
  g.addColorStop(1, colors.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (colors.star) {
    ctx.fillStyle = colors.star;
    for (let i = 0; i < 24; i++) ctx.fillRect((i * 97) % W, (i * 53) % 300, 2, 2);
  }
  for (const c of clouds) drawCloud(c.x, c.y, c.s);
  for (const t of towers) drawTower(t);

  // ground: striped toy-box edge
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, H - GROUND, W, GROUND);
  ctx.fillStyle = colors.groundDark;
  for (let x = -groundX; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, H - GROUND + 12);
    ctx.lineTo(x + 20, H - GROUND + 12);
    ctx.lineTo(x + 10, H - GROUND + 30);
    ctx.fill();
  }
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, H - GROUND);
  ctx.lineTo(W, H - GROUND);
  ctx.stroke();

  for (const p of particles) {
    ctx.globalAlpha = p.life * 2;
    ctx.fillStyle = "#FBF7F0";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const bob = shell && !shell.isPlaying() && alive ? Math.sin(time * 4) * 6 : 0;
  drawBird(BIRD_X, bird.y + bob, bird.rot);

  if (flash > 0 && !reducedMotion.matches) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawCloud(x, y, s) {
  ctx.fillStyle = colors.cloud;
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 22 * s, y - 8 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 46 * s, y, 18 * s, 0, Math.PI * 2);
  ctx.rect(x, y, 46 * s, 18 * s);
  ctx.fill();
}

function drawTower(t) {
  const blockH = 34;
  const drawStack = (y0, y1, fromTop) => {
    // blocks stacked from the tower's open end outward
    let i = 0;
    if (fromTop) {
      for (let y = y1; y > y0 - blockH; y -= blockH) block(t.x, y - blockH, i++, t.seed);
    } else {
      for (let y = y0; y < y1; y += blockH) block(t.x, y, i++, t.seed);
    }
  };
  drawStack(0, t.top, true);
  drawStack(t.top + t.gap, H - GROUND, false);
  // chunky caps at the gap
  cap(t.x - 6, t.top - 18);
  cap(t.x - 6, t.top + t.gap);
}

function block(x, y, i, seed) {
  ctx.fillStyle = BLOCK_COLORS[(i + seed) % BLOCK_COLORS.length];
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 3;
  ctx.fillRect(x, y, TOWER_W, 34);
  ctx.strokeRect(x, y, TOWER_W, 34);
  // letter-block dot
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(x + TOWER_W / 2, y + 17, 7, 0, Math.PI * 2);
  ctx.fill();
}

function cap(x, y) {
  ctx.fillStyle = "#FBF7F0";
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, TOWER_W + 12, 18, 6);
  ctx.fill();
  ctx.stroke();
}

function drawBird(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.line;

  // wind-up key on its back (spins)
  ctx.save();
  ctx.translate(-BIRD_R - 2, -2);
  ctx.rotate(bird.key);
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath();
  ctx.ellipse(0, -8, 5, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 8, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // body
  ctx.fillStyle = "#E8553D";
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // belly
  ctx.fillStyle = "#FBF7F0";
  ctx.beginPath();
  ctx.arc(3, 6, 9, 0, Math.PI * 2);
  ctx.fill();
  // wing flaps with speed
  const wing = Math.sin(time * 30) * (bird.vy < 0 ? 6 : 2);
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath();
  ctx.ellipse(-4, 2 + wing * 0.3, 9, 6 + wing * 0.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // eye
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(7, -6, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.line;
  ctx.beginPath();
  ctx.arc(8.5, -6, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = "#F2B33D";
  ctx.beginPath();
  ctx.moveTo(BIRD_R - 2, -2);
  ctx.lineTo(BIRD_R + 10, 2);
  ctx.lineTo(BIRD_R - 2, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---- Controls ------------------------------------------------------------------------------
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".game-overlay")) return; // taps on Play / buttons
  flap();
});
onKeys(flap, { active: (name) => (name === "action" || name === "up") && shell.isPlaying() });

// ---- Shell ------------------------------------------------------------------------------------
const shell = createShell({
  id: "wind-up-flyer",
  title: "Wind-Up Flyer",
  hint: "Tap, click or press Space to flap. Fly through the gaps!",
  onStart() {
    reset();
    bird.vy = FLAP * 0.8; // a first flap so you don't drop straight away
    startLoop();
  },
  onPause() { running = false; cancelAnimationFrame(raf); },
  onResume() { startLoop(); },
});

// Idle animation behind the start screen
reset();
startLoop();
