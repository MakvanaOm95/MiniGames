// ============================================================================
// Tower Tock — Tiny Tock
// ----------------------------------------------------------------------------
// A stacking game. A toy block slides back and forth above the tower: tap to
// drop it. Whatever hangs over the edge is sliced off and falls away, so the
// blocks get narrower. Land a block (almost) exactly on top for a "Perfect!"
// that keeps its full width; three perfects in a row make it grow back.
// Miss the tower completely and the game is over. Score = floors stacked.
// ============================================================================

import { createShell, setupCanvas } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

// ---- Settings (world is 400 × 600) --------------------------------------------
const W = 400;
const H = 600;
const BLOCK_H = 30;
const START_W = 180;
const BASE_Y = H - 150;        // top of the base plinth
const TOWER_LINE = 270;        // the camera keeps the top of the tower near here
const START_SPEED = 150;       // px per second
const SPEED_UP = 7;            // extra speed per floor
const MAX_SPEED = 420;
const PERFECT = 5;             // px of wiggle room for a "Perfect!"
const GROW = 14;               // width won back after 3 perfects in a row

const COLORS = ["#E8553D", "#F2B33D", "#2F8F83", "#6FA9D8", "#7A4E8C", "#F08A6E"];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---- State ---------------------------------------------------------------------------
let stack, mover, debris, popups, camY, camTarget, streak, flash;
let raf = 0, last = 0, running = false, endTimer = 0;
let scale = 1, colors = {};

const canvas = document.getElementById("tower");
const stage = canvas.parentElement;
const ctx = setupCanvas(canvas, (w) => { scale = w / W; draw(); });

function readColors() {
  const css = getComputedStyle(canvas);
  const v = (n) => css.getPropertyValue(n).trim();
  colors = { bg: v("--tt-bg"), grid: v("--tt-grid"), line: v("--tt-line"), text: v("--tt-text") };
}
readColors();
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });

const floorY = (i) => BASE_Y - (i + 1) * BLOCK_H;   // top edge of floor i
const top = () => stack[stack.length - 1];

function reset() {
  // floor 0 is the starting block, already sitting on the base
  stack = [{ x: (W - START_W) / 2, w: START_W, color: COLORS[0] }];
  debris = [];
  popups = [];
  camY = camTarget = 0;
  streak = 0;
  flash = 0;
  spawn();
}

function spawn() {
  const floor = stack.length;
  const w = top().w;
  const fromLeft = floor % 2 === 1;
  mover = {
    x: fromLeft ? -w : W,
    w,
    dir: fromLeft ? 1 : -1,
    speed: Math.min(MAX_SPEED, START_SPEED + (floor - 1) * SPEED_UP),
    color: COLORS[floor % COLORS.length],
  };
}

// ---- Dropping a block ------------------------------------------------------------------------
function drop() {
  if (!shell.isPlaying() || !mover) return;
  const below = top();
  const y = floorY(stack.length);
  const diff = mover.x - below.x;

  // Perfect (or close enough): snap it right on top
  if (Math.abs(diff) <= PERFECT) {
    streak++;
    let w = below.w;
    if (streak >= 3) w = Math.min(START_W, w + GROW);
    const x = below.x - (w - below.w) / 2;
    stack.push({ x: Math.max(0, Math.min(W - w, x)), w, color: mover.color });
    flash = 1;
    sound.play("ding", { pitch: 1 + Math.min(streak, 8) * 0.06 });
    popups.push({ text: streak >= 3 ? "Perfect! Bigger!" : "Perfect!", x: W / 2, y: y - 18, life: 1 });
    return placed();
  }

  // Missed the tower completely: the block tumbles and the game ends
  if (Math.abs(diff) >= below.w) {
    fall(mover.x, y, mover.w, mover.color, mover.dir);
    mover = null;
    sound.play("bump");
    // let the block tumble for a moment before the game-over screen
    endTimer = setTimeout(endGame, 700);
    return;
  }

  // Partly on: slice off the overhang
  streak = 0;
  const w = below.w - Math.abs(diff);
  const x = diff > 0 ? mover.x : below.x;
  const cutX = diff > 0 ? below.x + below.w : mover.x;
  fall(cutX, y, Math.abs(diff), mover.color, diff > 0 ? 1 : -1);
  stack.push({ x, w, color: mover.color });
  sound.play("tock", { pitch: 0.9 + Math.min(stack.length, 30) * 0.015 });
  return placed();
}

function placed() {
  shell.setScore(stack.length - 1);
  // move the camera so the new top stays in view
  camTarget = Math.max(0, TOWER_LINE - floorY(stack.length));
  spawn();
}

function fall(x, y, w, color, dir) {
  debris.push({ x, y, w, color, vx: dir * 40, vy: 0, rot: 0, spin: dir * (reducedMotion.matches ? 0 : 2.5) });
}

function endGame() {
  stopLoop();
  shell.over({ message: overMessage() });
}

function overMessage() {
  const n = stack.length - 1;
  if (n === 0) return "Oops! The block missed the tower.";
  if (n < 10) return `${n} floor${n === 1 ? "" : "s"} high. Keep practicing!`;
  if (n < 25) return `${n} floors! That’s a proper tower.`;
  return `${n} floors! A true skyscraper.`;
}

// ---- Loop ----------------------------------------------------------------------------------
function update(dt) {
  if (mover) {
    mover.x += mover.dir * mover.speed * dt;
    // bounce off the sides (the block may go a little past the edge before turning)
    if (mover.dir > 0 && mover.x > W - mover.w * 0.35) { mover.x = W - mover.w * 0.35; mover.dir = -1; }
    if (mover.dir < 0 && mover.x < -mover.w * 0.65) { mover.x = -mover.w * 0.65; mover.dir = 1; }
  }
  for (const d of debris) { d.vy += 1400 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.spin * dt; }
  debris = debris.filter((d) => d.y + camY < H + 100);
  popups = popups.filter((p) => (p.life -= dt * 0.9) > 0);
  for (const p of popups) p.y -= 30 * dt;
  camY += (camTarget - camY) * Math.min(1, dt * 6);
  flash = Math.max(0, flash - dt * 3);
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
function block(x, y, w, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, BLOCK_H, 5);
  ctx.fill();
  ctx.stroke();
  // a little shine on top, like a painted wooden block
  if (w > 14) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x + 5, y + 5, w - 10, 4);
  }
}

function draw() {
  if (!stack) return;
  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  // dotted grid that scrolls with the tower
  ctx.fillStyle = colors.grid;
  const off = camY % 30;
  for (let x = 15; x < W; x += 30) for (let y = -30 + off; y < H; y += 30) ctx.fillRect(x, y, 2, 2);

  ctx.translate(0, camY);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colors.line;
  ctx.lineJoin = "round";

  // base plinth
  ctx.fillStyle = colors.line;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 130, BASE_Y, 260, 26, 8);
  ctx.fill();
  ctx.fillRect(W / 2 - 100, BASE_Y + 20, 200, H);

  // the tower (only draw floors that are on screen)
  for (let i = 0; i < stack.length; i++) {
    const y = floorY(i);
    if (y + camY > H + BLOCK_H || y + camY < -BLOCK_H) continue;
    block(stack[i].x, y, stack[i].w, stack[i].color);
  }
  // perfect flash: a glow around the top block
  if (flash > 0 && stack.length > 1) {
    const t = top();
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.strokeStyle = "#FBF7F0";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(t.x - 4, floorY(stack.length - 1) - 4, t.w + 8, BLOCK_H + 8, 8);
    ctx.stroke();
    ctx.restore();
  }

  if (mover) block(mover.x, floorY(stack.length), mover.w, mover.color);

  for (const d of debris) {
    ctx.save();
    ctx.translate(d.x + d.w / 2, d.y + BLOCK_H / 2);
    ctx.rotate(d.rot);
    block(-d.w / 2, -BLOCK_H / 2, d.w, d.color);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.font = "800 22px 'Bricolage Grotesque', sans-serif";
  for (const p of popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = colors.text;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // floor counter, big and faint in the corner
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = colors.grid;
  ctx.font = "800 64px 'Bricolage Grotesque', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(stack.length - 1), W - 20, 76);
  ctx.restore();
}

// ---- Controls ----------------------------------------------------------------------------------
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".game-overlay") || !shell.isPlaying()) return;
  e.preventDefault();
  drop();
});
window.addEventListener("keydown", (e) => {
  if (e.repeat || !shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code !== "Space" && e.code !== "Enter" && e.code !== "ArrowDown") return;
  if (e.target.tagName === "BUTTON" || e.target.tagName === "A") return;
  e.preventDefault();
  drop();
});

// ---- Shell ------------------------------------------------------------------------------------
const shell = createShell({
  id: "tower-tock",
  title: "Tower Tock",
  scoreLabel: "Floors",
  hint: "Tap (or press Space) to drop the sliding block. Stack it as high as you can!",
  onStart() {
    clearTimeout(endTimer);
    reset();
    startLoop();
  },
  onPause() { stopLoop(); clearTimeout(endTimer); },
  // paused while the last block was falling? then the game is simply over
  onResume() { mover ? startLoop() : endGame(); },
});

// Show a starting tower behind the start screen
reset();
draw();
