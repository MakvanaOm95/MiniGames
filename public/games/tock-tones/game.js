// ============================================================================
// Tock Tones — Tiny Tock
// ----------------------------------------------------------------------------
// Four colored pads, four notes. Watch and listen as the toy plays a pattern,
// then repeat it. Each round adds one more step and plays a little faster.
// One wrong pad ends the game. Score = the longest pattern you repeated.
//
// Keys: ↑ → ↓ ← (or W D S A) press the top / right / bottom / left pad.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

// top, right, bottom, left — a bright major chord going clockwise
const NOTES = [523.25, 659.25, 783.99, 1046.5];
const KEY_TO_PAD = { up: 0, right: 1, down: 2, left: 3 };

const pads = [...document.querySelectorAll(".pad")];
const ring = document.querySelector("[data-ring]");
const roundEl = document.querySelector("[data-round]");
const msgEl = document.querySelector("[data-msg]");

let seq = [];
let pos = 0;              // how far the player has repeated this round
let phase = "idle";       // idle | showing | input | done
let showToken = 0;        // cancels an old playback if a new one starts

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function light(i, ms) {
  const pad = pads[i];
  pad.classList.add("is-lit");
  sound.note(NOTES[i], { dur: Math.min(0.5, ms / 1000 + 0.05) });
  setTimeout(() => pad.classList.remove("is-lit"), ms);
}

function setMessage(text) { msgEl.textContent = text; }

/** Play the whole pattern for the player to watch. */
async function showSequence() {
  const token = ++showToken;
  phase = "showing";
  ring.classList.add("is-showing");
  roundEl.textContent = seq.length;
  setMessage("Watch…");
  const on = Math.max(220, 480 - seq.length * 16);
  const gap = Math.max(90, 200 - seq.length * 6);
  await wait(650);
  for (const i of seq) {
    if (token !== showToken) return;
    if (!shell.isPlaying()) return; // paused: onResume replays from the start
    light(i, on);
    await wait(on + gap);
  }
  if (token !== showToken || !shell.isPlaying()) return;
  ring.classList.remove("is-showing");
  phase = "input";
  pos = 0;
  setMessage("Your turn!");
}

function nextRound() {
  seq.push(Math.floor(Math.random() * 4));
  showSequence();
}

function press(i) {
  if (!shell.isPlaying()) return;
  if (phase !== "input") {
    pads[i].classList.add("is-denied");
    setTimeout(() => pads[i].classList.remove("is-denied"), 150);
    return;
  }
  if (i !== seq[pos]) return mistake(i);
  light(i, 220);
  pos++;
  if (pos === seq.length) {
    phase = "done";
    shell.setScore(seq.length);
    setMessage(seq.length % 5 === 0 ? "Brilliant!" : "Nice!");
    ring.classList.add("is-happy");
    setTimeout(() => ring.classList.remove("is-happy"), 500);
    setTimeout(() => shell.isPlaying() && phase === "done" && nextRound(), 750);
  }
}

function mistake(i) {
  phase = "failed";
  pads[i].classList.add("is-wrong");
  sound.play("bump");
  setMessage(`Oops! It was the ${["top", "right", "bottom", "left"][seq[pos]]} pad.`);
  pads[seq[pos]].classList.add("is-hint");
  setTimeout(finish, 1100);
}

function finish() {
  pads.forEach((p) => p.classList.remove("is-wrong", "is-hint"));
  const n = seq.length - 1;
  shell.over({ message: n > 0 ? `You remembered ${n} ${n === 1 ? "step" : "steps"}!` : "Oops! Watch closely next time." });
}

// ---- Controls --------------------------------------------------------------------------
pads.forEach((pad, i) => {
  pad.addEventListener("pointerdown", (e) => { e.preventDefault(); press(i); });
  pad.addEventListener("click", (e) => { if (e.detail === 0) press(i); }); // keyboard Enter/Space
});
onKeys((name) => press(KEY_TO_PAD[name]), { active: (name) => name in KEY_TO_PAD && shell.isPlaying() });

// ---- Shell ----------------------------------------------------------------------------------
const shell = createShell({
  id: "tock-tones",
  title: "Tock Tones",
  hint: "Watch the lights and listen. Then repeat the pattern. It grows by one every round!",
  onStart() {
    seq = [];
    shell.setScore(0, { animate: false });
    nextRound();
  },
  onResume() {
    // if we paused while the pattern was playing, play it again from the start
    if (phase === "showing") showSequence();
    if (phase === "failed") finish(); // paused right after a mistake
    if (phase === "done") nextRound(); // paused between rounds
  },
});

roundEl.textContent = "–";
setMessage("Ready?");
