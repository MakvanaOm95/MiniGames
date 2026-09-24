// ============================================================================
// Quick Draw — Tiny Tock
// ----------------------------------------------------------------------------
// A reaction-time test. The wind-up alarm clock waits a random moment, then
// rings: tap as fast as you can. Five tries; your average time is the score
// (lower is better). Tapping before it rings restarts that try.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const TRIES = 5;
const WAIT_MIN = 1400;   // ms before the clock can ring
const WAIT_MAX = 4200;
const RESULT_PAUSE = 1100;
const HUMAN_LIMIT = 100; // faster than this is a lucky guess, not a reaction

const boardEl = document.querySelector("[data-board]");
const bigEl = document.querySelector("[data-big]");
const smallEl = document.querySelector("[data-small]");
const dotsEl = document.querySelector("[data-dots]");

let phase = "idle";   // idle | wait | go | result | early
let times = [];
let goAt = 0;
let timer = 0;

const ms = (n) => `${Math.round(n)} ms`;
const average = () => times.reduce((a, b) => a + b, 0) / times.length;

function rating(avg) {
  if (avg < 200) return "Lightning fast!";
  if (avg < 250) return "Super quick reflexes.";
  if (avg < 300) return "Nice and sharp.";
  if (avg < 380) return "Solid! Practice makes faster.";
  return "Warming up. Try again!";
}

function show(next, big, small = "") {
  phase = next;
  boardEl.dataset.phase = next;
  bigEl.textContent = big;
  smallEl.textContent = small;
}

function renderDots() {
  dotsEl.innerHTML = "";
  for (let i = 0; i < TRIES; i++) {
    const d = document.createElement("li");
    d.className = "qd-dot" + (i < times.length ? " is-done" : i === times.length ? " is-now" : "");
    d.textContent = i < times.length ? Math.round(times[i]) : "";
    dotsEl.append(d);
  }
  shell.stat("try", "Try", `${Math.min(times.length + 1, TRIES)}/${TRIES}`);
}

function waitForRing() {
  clearTimeout(timer);
  show("wait", "Wait for it…", "Tap when the clock rings");
  renderDots();
  timer = setTimeout(ring, WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN));
}

function ring() {
  show("go", "TAP!");
  goAt = performance.now();
  sound.play("ding");
}

/** Every tap or key press lands here. `when` is the event's timestamp. */
function hit(when) {
  if (!shell.isPlaying()) return;
  const guessed = phase === "go" && when - goAt < HUMAN_LIMIT;
  if (phase === "wait" || guessed) {
    clearTimeout(timer);
    sound.play("bump", { pitch: 1.2 });
    show("early", "Too soon!", guessed ? "That was a guess! Wait to see the ring." : "Wait for the ring. Let’s try that one again.");
    timer = setTimeout(waitForRing, RESULT_PAUSE + 300);
  } else if (phase === "go") {
    const t = when - goAt;
    times.push(t);
    shell.setScore(Math.round(t));
    sound.play("pop", { pitch: t < 250 ? 1.4 : 1 });
    renderDots();
    if (times.length === TRIES) {
      show("result", ms(t), "That’s all five!");
      timer = setTimeout(finish, 700);
    } else {
      show("result", ms(t), t < 250 ? "Whoa, quick!" : "Get ready for the next one…");
      timer = setTimeout(waitForRing, RESULT_PAUSE);
    }
  }
}

function finish() {
  const avg = Math.round(average());
  shell.setScore(avg);
  shell.over({ message: `Average of ${TRIES}. ${rating(avg)}`, win: avg < 300 });
}

// ---- Controls ------------------------------------------------------------------------------
boardEl.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  // event timestamps use the same clock as performance.now(), and are more exact
  hit(e.timeStamp || performance.now());
});
window.addEventListener("keydown", (e) => {
  if (e.repeat || !shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code !== "Space" && e.code !== "Enter") return;
  if (e.target.tagName === "BUTTON" || e.target.tagName === "A") return;
  e.preventDefault();
  hit(e.timeStamp || performance.now());
});

// ---- Shell ---------------------------------------------------------------------------------
const shell = createShell({
  id: "quick-draw",
  title: "Quick Draw",
  scoreLabel: "Time",
  lowerIsBetter: true,
  format: (n) => (n ? ms(n) : "–"),
  hint: "Wait for the alarm clock to ring, then tap as fast as you can. Five tries, lowest average wins!",
  onStart() {
    clearTimeout(timer);
    times = [];
    waitForRing();
  },
  // Pausing throws away the try in progress, so nobody can peek at the timer
  onPause() { clearTimeout(timer); },
  onResume() { times.length === TRIES ? finish() : waitForRing(); },
});

show("idle", "Ready?", "");
renderDots();
