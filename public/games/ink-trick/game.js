// ============================================================================
// Ink Trick — Tiny Tock
// ----------------------------------------------------------------------------
// A color word appears in a different ink. Tap the INK color, not the word.
// 60 seconds per round. Streaks multiply points; a wrong tap costs 3 seconds.
// After a few right answers the rule sometimes flips to "tap the WORD",
// and a fifth color joins in.
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const ROUND_SECONDS = 60;
const WRONG_PENALTY = 3;       // seconds lost on a wrong tap
const FLIP_AFTER = 8;          // right answers before "tap the WORD" can appear
const FIFTH_COLOR_AFTER = 10;  // right answers before purple joins

// Bright inks that read well on the navy card
const COLORS = [
  { key: "red",    name: "Red",    ink: "#FF6B55" },
  { key: "blue",   name: "Blue",   ink: "#5AA8F0" },
  { key: "green",  name: "Green",  ink: "#4CC47A" },
  { key: "yellow", name: "Yellow", ink: "#FFD24D" },
  { key: "purple", name: "Purple", ink: "#C893F2" },
];

const ruleEl = document.querySelector("[data-rule]");
const cardEl = document.querySelector("[data-card]");
const wordEl = document.querySelector("[data-word]");
const msgEl = document.querySelector("[data-msg]");
const choicesEl = document.querySelector("[data-choices]");

let active = [];       // colors in play right now
let word = null;       // the color the word spells
let ink = null;        // the color it's printed in
let rule = "ink";      // "ink" or "word": which one to tap
let right = 0;
let streak = 0;
let bestStreak = 0;
let locked = false;
let timeLeft = ROUND_SECONDS;
let lastTick = 0;
let raf = 0;

const pickFrom = (list, not) => {
  const pool = list.filter((c) => c !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};
const multiplier = () => (streak >= 10 ? 3 : streak >= 5 ? 2 : 1);

function renderChoices() {
  choicesEl.innerHTML = "";
  active.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ink-choice";
    b.dataset.key = c.key;
    b.style.setProperty("--swatch", c.ink);
    b.innerHTML = `<span class="ink-choice__dot" aria-hidden="true"></span><span>${c.name}</span><kbd aria-hidden="true">${i + 1}</kbd>`;
    // pointerdown feels instant; the click handler covers keyboard presses
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); answer(c); });
    b.addEventListener("click", (e) => { if (e.detail === 0) answer(c); });
    choicesEl.append(b);
  });
}

function renderRule(flipped) {
  ruleEl.innerHTML = rule === "ink" ? "Tap the <strong>ink</strong> color" : "Now tap the <strong>word</strong>!";
  ruleEl.classList.toggle("is-word", rule === "word");
  if (flipped) {
    ruleEl.classList.remove("is-flipped");
    void ruleEl.offsetWidth; // restart the animation
    ruleEl.classList.add("is-flipped");
  }
}

function next() {
  if (right === FIFTH_COLOR_AFTER && active.length < COLORS.length) {
    active = COLORS.slice();
    renderChoices();
    msgEl.textContent = "New color: Purple!";
  }
  const prevRule = rule;
  rule = right >= FLIP_AFTER && Math.random() < 0.3 ? "word" : "ink";
  // Usually the word and ink differ; now and then they match, to keep you honest
  word = pickFrom(active, word);
  ink = Math.random() < 0.15 ? word : pickFrom(active, word);
  wordEl.textContent = word.name.toUpperCase();
  wordEl.style.color = ink.ink;
  cardEl.setAttribute("aria-label", `The word ${word.name}, written in ${ink.name.toLowerCase()} ink`);
  cardEl.classList.remove("is-in");
  void cardEl.offsetWidth;
  cardEl.classList.add("is-in");
  renderRule(rule !== prevRule);
  locked = false;
}

function answer(choice) {
  if (!shell.isPlaying() || locked) return;
  const target = rule === "ink" ? ink : word;
  const btn = choicesEl.querySelector(`[data-key="${choice.key}"]`);
  flash(btn, choice === target ? "is-right" : "is-wrong");
  if (choice === target) {
    right++;
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    const pts = multiplier();
    shell.addScore(pts);
    sound.play("pop", { pitch: 1 + Math.min(streak, 15) * 0.04 });
    msgEl.textContent = streak >= 2 ? `Streak ${streak}${pts > 1 ? ` · ×${pts} points!` : ""}` : "";
    next();
  } else {
    streak = 0;
    timeLeft = Math.max(0, timeLeft - WRONG_PENALTY);
    sound.play("bump", { pitch: 1.3 });
    msgEl.textContent = `Oops! That was ${target.name.toLowerCase()}. −${WRONG_PENALTY}s`;
    cardEl.classList.remove("is-wrong");
    void cardEl.offsetWidth;
    cardEl.classList.add("is-wrong");
    locked = true;
    setTimeout(() => shell.isPlaying() && next(), 350);
  }
}

function flash(btn, cls) {
  if (!btn) return;
  btn.classList.remove("is-right", "is-wrong");
  void btn.offsetWidth;
  btn.classList.add(cls);
}

// ---- Timer ---------------------------------------------------------------------------
function tick(now) {
  const before = Math.ceil(timeLeft);
  timeLeft -= (now - lastTick) / 1000;
  lastTick = now;
  const box = shell.stat("time", "Time", formatTime(Math.ceil(Math.max(0, timeLeft))));
  box.classList.toggle("is-low", timeLeft <= 10);
  if (timeLeft <= 5 && timeLeft > 0 && Math.ceil(timeLeft) !== before) sound.play("tock");
  if (timeLeft <= 0) {
    locked = true;
    shell.over({ message: right ? `Time’s up! ${right} right, best streak ${bestStreak}.` : "Time’s up!" });
    return;
  }
  raf = requestAnimationFrame(tick);
}
function run() {
  lastTick = performance.now();
  raf = requestAnimationFrame(tick);
}

// ---- Keyboard: 1–5 pick a color ----------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= active.length) {
    e.preventDefault();
    answer(active[n - 1]);
  }
});

// ---- Shell ---------------------------------------------------------------------------------
const shell = createShell({
  id: "ink-trick",
  title: "Ink Trick",
  hint: "Tap the color of the ink, not the word it spells. Quick! You’ve got 60 seconds.",
  onStart() {
    cancelAnimationFrame(raf);
    timeLeft = ROUND_SECONDS;
    right = 0;
    streak = 0;
    bestStreak = 0;
    rule = "ink";
    active = COLORS.slice(0, 4);
    msgEl.textContent = "";
    renderChoices();
    next();
    run();
  },
  onPause() { cancelAnimationFrame(raf); },
  onResume() { run(); },
});

// What sits behind the start screen: "BLUE" written in red
shell.stat("time", "Time", formatTime(ROUND_SECONDS));
active = COLORS.slice(0, 4);
renderChoices();
wordEl.textContent = "BLUE";
wordEl.style.color = COLORS[0].ink;
renderRule(false);
