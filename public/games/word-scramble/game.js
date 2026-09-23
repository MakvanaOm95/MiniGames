// ============================================================================
// Word Scramble — Tiny Tock
// ----------------------------------------------------------------------------
// Unscramble the letters to find the word. 60 seconds per round.
// Each solved word scores 1 point per letter. Words get longer as you go.
// Tap letters (or type them), Backspace to undo, Skip if you're stuck.
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const ROUND_SECONDS = 60;

// Friendly everyday words. Chosen so each one has only ONE common answer
// (no "heart"/"earth"-style anagrams that would feel unfair).
const WORDS = `
clock watch alarm minute ticket puzzle riddle secret wonder giggle happy brave clever gentle bright
purple yellow orange violet copper pebble crystal diamond journey compass lantern shadow morning
evening weekend holiday picnic apple banana cherry pizza honey sugar butter cookie muffin waffle
noodle pickle cupcake candy cheese yogurt tomato potato carrot pepper garlic onion salad juice
coffee teapot candle pillow blanket window mirror button zipper jacket mitten helmet socks boots
bottle basket bucket hammer ladder bridge tunnel train truck bicycle wagon rocket comet galaxy robot
laptop phone camera piano guitar violin trumpet music drum river island valley beach shell whale
shark octopus dolphin penguin eagle zebra giraffe camel hippo koala panda tiger puppy kitten monkey
rabbit turtle dragon wizard knight crown jewel magic pirate anchor jungle storm breeze frost sunny
school summer winter spring autumn rainbow thunder circle square pencil crayon eraser paper glue
scissors ruler chalk sticker family tent campfire tree acorn
`.trim().split(/\s+/);

const slotsEl = document.querySelector("[data-slots]");
const tilesEl = document.querySelector("[data-tiles]");
const msgEl = document.querySelector("[data-msg]");
const skipBtn = document.querySelector("[data-skip]");
const shuffleBtn = document.querySelector("[data-shuffle]");

let word = "";
let tiles = [];      // [{ ch, el, used }]
let answer = [];     // indexes into tiles, in the order picked
let solvedCount = 0;
let recent = [];
let locked = false;
let timeLeft = ROUND_SECONDS;
let lastTick = 0;
let raf = 0;

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Pick a word: short ones first, longer as you solve more. */
function pickWord() {
  const maxLen = solvedCount < 3 ? 5 : solvedCount < 6 ? 6 : 8;
  const pool = WORDS.filter((w) => w.length <= maxLen && !recent.includes(w));
  const w = pool[Math.floor(Math.random() * pool.length)];
  recent = [w, ...recent].slice(0, 20);
  return w;
}

function scramble(w) {
  let s;
  do s = shuffle([...w]).join("");
  while (s === w);
  return s;
}

function newWord() {
  word = pickWord();
  answer = [];
  locked = false;
  msgEl.textContent = "";
  tiles = [...scramble(word)].map((ch) => ({ ch, used: false, el: null }));
  renderTiles(true);
  renderSlots();
}

function renderTiles(animate = false) {
  tilesEl.innerHTML = "";
  tiles.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "letter";
    b.textContent = t.ch;
    b.disabled = t.used;
    b.setAttribute("aria-label", `Letter ${t.ch.toUpperCase()}`);
    if (animate) b.style.animationDelay = `${i * 40}ms`;
    else b.style.animation = "none";
    b.addEventListener("click", () => pick(i));
    t.el = b;
    tilesEl.append(b);
  });
}

function renderSlots(state = "") {
  slotsEl.innerHTML = "";
  slotsEl.className = `slots ${state}`;
  for (let i = 0; i < word.length; i++) {
    const s = document.createElement("button");
    s.type = "button";
    s.className = "slot";
    s.style.setProperty("--n", i); // staggers the "correct!" bounce
    const t = tiles[answer[i]];
    s.textContent = t ? t.ch : "";
    s.disabled = !t;
    s.setAttribute("aria-label", t ? `Remove ${t.ch.toUpperCase()}` : "Empty");
    s.addEventListener("click", () => unpick(i));
    slotsEl.append(s);
  }
  slotsEl.setAttribute("aria-label", `Your answer: ${answer.map((i) => tiles[i].ch).join("") || "empty"}`);
}

function pick(i) {
  if (!shell.isPlaying() || locked || tiles[i].used) return;
  tiles[i].used = true;
  tiles[i].el.disabled = true;
  answer.push(i);
  sound.play("tick", { pitch: 0.9 + answer.length * 0.05 });
  renderSlots();
  if (answer.length === word.length) check();
}

function unpick(pos) {
  if (!shell.isPlaying() || locked) return;
  const [i] = answer.splice(pos, 1);
  if (i === undefined) return;
  tiles[i].used = false;
  tiles[i].el.disabled = false;
  sound.play("move", { pitch: 0.8 });
  renderSlots();
}

function check() {
  const guess = answer.map((i) => tiles[i].ch).join("");
  // accept the target word, or any other list word made of the same letters
  const ok = guess === word || (WORDS.includes(guess) && [...guess].sort().join("") === [...word].sort().join(""));
  locked = true;
  if (ok) {
    solvedCount++;
    shell.addScore(word.length);
    sound.play("win");
    renderSlots("is-right");
    msgEl.textContent = `+${word.length}`;
    setTimeout(() => shell.isPlaying() && newWord(), 650);
  } else {
    sound.play("bump", { pitch: 1.4 });
    renderSlots("is-wrong");
    setTimeout(() => {
      if (!shell.isPlaying()) return;
      answer = [];
      tiles.forEach((t) => (t.used = false));
      renderTiles();
      renderSlots();
      locked = false;
    }, 450);
  }
}

function skip() {
  if (!shell.isPlaying() || locked) return;
  locked = true;
  msgEl.textContent = `It was “${word.toUpperCase()}”`;
  sound.play("move", { pitch: 0.6 });
  setTimeout(() => shell.isPlaying() && newWord(), 900);
}

function reshuffle() {
  if (!shell.isPlaying() || locked) return;
  const order = shuffle(tiles.map((_, i) => i));
  const map = new Map(order.map((oldIdx, newIdx) => [oldIdx, newIdx]));
  tiles = order.map((i) => tiles[i]);
  answer = answer.map((i) => map.get(i));
  renderTiles(true);
  sound.play("move");
}

// ---- Timer ---------------------------------------------------------------------------
function tick(now) {
  const before = Math.ceil(timeLeft);
  timeLeft -= (now - lastTick) / 1000;
  lastTick = now;
  const box = shell.stat("time", "Time", formatTime(Math.ceil(Math.max(0, timeLeft))));
  box.classList.toggle("is-low", timeLeft <= 10);
  if (timeLeft <= 5 && Math.ceil(timeLeft) !== before) sound.play("tock");
  if (timeLeft <= 0) {
    locked = true;
    msgEl.textContent = `It was “${word.toUpperCase()}”`;
    shell.over({ message: solvedCount ? `Time’s up! You solved ${solvedCount} ${solvedCount === 1 ? "word" : "words"}.` : "Time’s up!" });
    return;
  }
  raf = requestAnimationFrame(tick);
}
function run() {
  lastTick = performance.now();
  raf = requestAnimationFrame(tick);
}

// ---- Controls ---------------------------------------------------------------------------
skipBtn.addEventListener("click", skip);
shuffleBtn.addEventListener("click", reshuffle);

window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[a-z]$/i.test(e.key)) {
    const i = tiles.findIndex((t) => !t.used && t.ch === e.key.toLowerCase());
    if (i !== -1) { e.preventDefault(); pick(i); }
  } else if (e.key === "Backspace") {
    e.preventDefault();
    unpick(answer.length - 1);
  } else if (e.target.tagName === "BUTTON") {
    return; // Space/Enter on a focused button just presses that button
  } else if (e.key === " ") {
    e.preventDefault();
    reshuffle();
  } else if (e.key === "Enter") {
    e.preventDefault();
    skip();
  }
});

// ---- Shell ---------------------------------------------------------------------------------
const shell = createShell({
  id: "word-scramble",
  title: "Word Scramble",
  letterKeys: true,
  hint: "Unscramble the letters to make a word. Tap them or type. You’ve got 60 seconds!",
  onStart() {
    cancelAnimationFrame(raf);
    timeLeft = ROUND_SECONDS;
    solvedCount = 0;
    recent = [];
    newWord();
    run();
  },
  onPause() { cancelAnimationFrame(raf); },
  onResume() { run(); },
});

shell.stat("time", "Time", formatTime(ROUND_SECONDS));
word = "tinytock".slice(0, 4); // "tiny" behind the start screen
tiles = [..."ytin"].map((ch) => ({ ch, used: false, el: null }));
renderTiles();
renderSlots();
