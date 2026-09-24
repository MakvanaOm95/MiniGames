// ============================================================================
// Rock Popper — Tiny Tock
// ----------------------------------------------------------------------------
// A space shooter in the style of the old arcade classic. Your toy rocket
// floats in space surrounded by drifting rocks. Shoot a rock and it pops
// into two smaller ones; the smallest ones vanish. Clear every rock to start
// the next wave. Bump into a rock and you lose a life (you have 3).
// Everything wraps around the edges of the screen.
//
// Controls: hold the mouse / finger on the board: the rocket turns toward
// it and fires, and flies toward it if it's far away. Keyboard: ← → turn,
// ↑ thrust, Space fire.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

// ---- Settings (world is 560 × 420) --------------------------------------------
const W = 560;
const H = 420;
const SHIP_R = 12;
const TURN = 4.2;              // radians per second
const THRUST = 320;
const MAX_SPEED = 300;
const DRAG = 0.55;             // share of speed kept after one second
const BULLET_SPEED = 540;
const BULLET_LIFE = 0.85;
const FIRE_GAP = 0.2;          // seconds between shots
const MAX_BULLETS = 6;
const LIVES = 3;
const SAFE_TIME = 2.5;         // seconds of blinking safety after a respawn
const SIZES = [
  { r: 44, points: 20, speed: 45 },
  { r: 25, points: 50, speed: 75 },
  { r: 13, points: 100, speed: 110 },
];
const ROCK_COLORS = ["#E8553D", "#F2B33D", "#2F8F83", "#6FA9D8", "#7A4E8C", "#F08A6E"];
const FAR = 110;               // pointer farther than this from the ship = fly toward it

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---- State ---------------------------------------------------------------------------
let ship, rocks, bullets, bits, stars, lives, wave, fireWait, shake, respawnAt, waveAt;
let keys = { left: false, right: false, up: false, fire: false };
let pointer = null;            // { x, y } in world space while held down
let raf = 0, last = 0, running = false, time = 0, endTimer = 0;
let scale = 1;

const canvas = document.getElementById("space");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => { scale = w / W; draw(); });

const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (o) => {
  o.x = (o.x + W) % W;
  o.y = (o.y + H) % H;
};
/** Shortest distance on a screen that wraps around. */
function gap(a, b) {
  let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  dx = Math.min(dx, W - dx);
  dy = Math.min(dy, H - dy);
  return Math.hypot(dx, dy);
}

function makeRock(x, y, size) {
  const s = SIZES[size];
  const a = rand(0, Math.PI * 2);
  const speed = s.speed * rand(0.7, 1.3) * (1 + (wave - 1) * 0.08);
  // a lumpy outline: 11 points at slightly different distances
  const shape = Array.from({ length: 11 }, () => rand(0.78, 1.08));
  const craters = Array.from({ length: size === 2 ? 1 : 3 }, () => ({ a: rand(0, 6.3), d: rand(0.1, 0.5), r: rand(0.12, 0.22) }));
  return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size, r: s.r, spin: rand(-1, 1), rot: 0, shape, craters, color: ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)] };
}

function newShip() {
  ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, safe: SAFE_TIME, thrusting: false };
}

function startWave() {
  const count = Math.min(3 + wave, 9);
  for (let i = 0; i < count; i++) {
    // start near the edges, away from the rocket
    let x, y;
    do { x = rand(0, W); y = rand(0, H); } while (Math.hypot(x - W / 2, y - H / 2) < 150);
    rocks.push(makeRock(x, y, 0));
  }
  shell.stat("wave", "Wave", wave);
}

function reset() {
  lives = LIVES;
  wave = 1;
  rocks = [];
  bullets = [];
  bits = [];
  fireWait = 0;
  shake = 0;
  respawnAt = 0;
  waveAt = 0;
  time = 0;
  stars = Array.from({ length: 50 }, () => ({ x: rand(0, W), y: rand(0, H), s: Math.random() < 0.2 ? 2 : 1 }));
  newShip();
  startWave();
  showLives();
}

function showLives() { shell.stat("lives", "Lives", "♥".repeat(Math.max(0, lives)) || "–"); }

// ---- Actions ------------------------------------------------------------------------------------
function fire() {
  if (!ship || fireWait > 0 || bullets.length >= MAX_BULLETS) return;
  fireWait = FIRE_GAP;
  const cos = Math.cos(ship.a), sin = Math.sin(ship.a);
  bullets.push({ x: ship.x + cos * SHIP_R * 1.4, y: ship.y + sin * SHIP_R * 1.4, vx: cos * BULLET_SPEED + ship.vx * 0.5, vy: sin * BULLET_SPEED + ship.vy * 0.5, life: BULLET_LIFE });
  sound.play("click", { pitch: 1.4 });
}

function burst(x, y, color, n) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(40, 200);
    bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), color });
  }
}

function popRock(rock) {
  rocks.splice(rocks.indexOf(rock), 1);
  shell.addScore(SIZES[rock.size].points);
  burst(rock.x, rock.y, rock.color, 6 + (2 - rock.size) * 4);
  sound.play("pop", { pitch: 0.7 + rock.size * 0.35 });
  if (rock.size < 2) {
    rocks.push(makeRock(rock.x, rock.y, rock.size + 1), makeRock(rock.x, rock.y, rock.size + 1));
  }
  if (!rocks.length) {
    wave++;
    waveAt = time + 1.4;   // short breather before the next wave
    sound.play("win");
  }
}

function loseLife() {
  burst(ship.x, ship.y, "#FBF7F0", 22);
  burst(ship.x, ship.y, "#E8553D", 12);
  shake = 1;
  sound.play("bump");
  lives--;
  showLives();
  ship = null;
  if (lives <= 0) {
    endTimer = setTimeout(endGame, 900);
  } else {
    respawnAt = time + 1.1;
  }
}

function endGame() {
  stopLoop();
  shell.over({ message: `Out of rockets on wave ${wave}.` });
}

// ---- Loop ----------------------------------------------------------------------------------
function update(dt) {
  time += dt;
  fireWait = Math.max(0, fireWait - dt);
  shake = Math.max(0, shake - dt * 3);

  if (!ship && lives > 0 && time >= respawnAt) newShip();
  if (waveAt && time >= waveAt) { waveAt = 0; startWave(); }

  if (ship) {
    ship.safe = Math.max(0, ship.safe - dt);
    let thrust = keys.up;
    if (pointer) {
      // turn toward the finger / mouse, and fly there if it's far away
      const target = Math.atan2(pointer.y - ship.y, pointer.x - ship.x);
      const diff = Math.atan2(Math.sin(target - ship.a), Math.cos(target - ship.a));   // -π … π
      ship.a += Math.max(-TURN * 1.4 * dt, Math.min(TURN * 1.4 * dt, diff));
      if (Math.hypot(pointer.x - ship.x, pointer.y - ship.y) > FAR && Math.abs(diff) < 0.6) thrust = true;
      if (Math.abs(diff) < 0.35) fire();
    }
    if (keys.left) ship.a -= TURN * dt;
    if (keys.right) ship.a += TURN * dt;
    if (keys.fire) fire();
    ship.thrusting = thrust;
    if (thrust) {
      ship.vx += Math.cos(ship.a) * THRUST * dt;
      ship.vy += Math.sin(ship.a) * THRUST * dt;
    }
    const keep = Math.pow(DRAG, dt);
    ship.vx *= keep;
    ship.vy *= keep;
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > MAX_SPEED) { ship.vx *= MAX_SPEED / sp; ship.vy *= MAX_SPEED / sp; }
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship);
  }

  for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt; wrap(r); }
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
  bullets = bullets.filter((b) => b.life > 0);
  for (const p of bits) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  bits = bits.filter((p) => p.life > 0);

  // bullets vs rocks
  for (const b of bullets) {
    const hit = rocks.find((r) => gap(b, r) < r.r * 0.95);
    if (hit) { b.life = 0; popRock(hit); }
  }
  bullets = bullets.filter((b) => b.life > 0);

  // rocket vs rocks
  if (ship && !ship.safe && rocks.some((r) => gap(ship, r) < r.r * 0.85 + SHIP_R * 0.8)) loseLife();
}

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
function stopLoop() { running = false; cancelAnimationFrame(raf); }

// ---- Drawing ---------------------------------------------------------------------------------
/** Draw something, plus copies on the other side if it pokes past an edge (so wrapping looks smooth). */
function wrapped(x, y, r, fn) {
  for (const ox of [0, -W, W]) {
    for (const oy of [0, -H, H]) {
      const px = x + ox, py = y + oy;
      if (px + r < 0 || px - r > W || py + r < 0 || py - r > H) continue;
      fn(px, py);
    }
  }
}

function drawRock(rock, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rock.rot);
  ctx.fillStyle = rock.color;
  ctx.beginPath();
  rock.shape.forEach((d, i) => {
    const a = (i / rock.shape.length) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rock.r * d, Math.sin(a) * rock.r * d);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (const c of rock.craters) {
    ctx.beginPath();
    ctx.arc(Math.cos(c.a) * rock.r * c.d, Math.sin(c.a) * rock.r * c.d, rock.r * c.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShip(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ship.a + Math.PI / 2);
  // flame
  if (ship.thrusting) {
    ctx.fillStyle = "#F2B33D";
    ctx.beginPath();
    const f = 10 + Math.random() * 8;
    ctx.moveTo(-6, 11); ctx.lineTo(0, 11 + f); ctx.lineTo(6, 11);
    ctx.fill();
  }
  // fins
  ctx.fillStyle = "#2F8F83";
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-14, 14); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(14, 14); ctx.lineTo(6, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  // body
  ctx.fillStyle = "#E8553D";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(10, -6, 8, 12);
  ctx.lineTo(-8, 12);
  ctx.quadraticCurveTo(-10, -6, 0, -18);
  ctx.fill();
  ctx.stroke();
  // window
  ctx.fillStyle = "#FBF7F0";
  ctx.beginPath(); ctx.arc(0, -3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function draw() {
  if (!rocks) return;
  ctx.save();
  ctx.scale(scale, scale);
  if (shake && !reducedMotion.matches) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

  ctx.fillStyle = "#1B2A41";
  ctx.fillRect(-12, -12, W + 24, H + 24);
  for (const s of stars) {
    ctx.fillStyle = s.s === 2 ? "rgba(251,247,240,0.7)" : "rgba(251,247,240,0.35)";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  ctx.strokeStyle = "#0B111B";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";

  for (const r of rocks) wrapped(r.x, r.y, r.r, (x, y) => drawRock(r, x, y));

  ctx.fillStyle = "#F2B33D";
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill(); }

  if (ship && (!ship.safe || Math.floor(time * 10) % 2 === 0)) wrapped(ship.x, ship.y, 24, drawShip);

  for (const p of bits) {
    ctx.globalAlpha = Math.min(1, p.life * 2.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
  }
  ctx.globalAlpha = 1;

  if (waveAt && time < waveAt && shell.isPlaying()) {
    ctx.fillStyle = "#FBF7F0";
    ctx.font = "800 34px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Wave ${wave}`, W / 2, H / 2 - 40);
  }
  ctx.restore();
}

// ---- Controls ----------------------------------------------------------------------------------
function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".game-overlay") || !shell.isPlaying()) return;
  e.preventDefault();
  stage.setPointerCapture(e.pointerId);
  pointer = toWorld(e);
});
stage.addEventListener("pointermove", (e) => { if (pointer) pointer = toWorld(e); });
const release = () => { pointer = null; };
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

const KEYS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", Space: "fire" };
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || !KEYS[e.code] || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "Space" && /^(BUTTON|A)$/.test(e.target.tagName)) return;
  e.preventDefault();
  keys[KEYS[e.code]] = true;
});
window.addEventListener("keyup", (e) => { if (KEYS[e.code]) keys[KEYS[e.code]] = false; });

// ---- Shell ------------------------------------------------------------------------------------
const shell = createShell({
  id: "rock-popper",
  title: "Rock Popper",
  hint: "Hold the board to aim and fire (hold far away to fly there). Keys: ← → turn, ↑ thrust, Space fire.",
  onStart() {
    clearTimeout(endTimer);
    reset();
    startLoop();
  },
  onPause() {
    stopLoop();
    clearTimeout(endTimer);
    keys = { left: false, right: false, up: false, fire: false };
    pointer = null;
  },
  // paused just after the last rocket was lost? then the game is over
  onResume() { lives > 0 ? startLoop() : endGame(); },
});

// Rocks drifting behind the start screen
reset();
draw();
