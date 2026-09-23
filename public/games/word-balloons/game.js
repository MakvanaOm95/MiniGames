// ============================================================================
// Word Balloons — Tiny Tock
// ----------------------------------------------------------------------------
// A secret word is shown as blanks, with a hint (like "Animal").
// Guess one letter at a time. Right letters fill the blanks; each wrong
// letter pops one of the six balloons holding up the basket.
// Solve the word before every balloon pops! Each word you solve scores
// 1 point plus 1 for every balloon still flying, and your balloons refill.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const BALLOONS = 6;
const COLORS = ["#E8553D", "#F2B33D", "#2F8F83", "#6FA9D8", "#7A4E8C", "#F08A6E"];

const WORDS = {
  Animal: "ELEPHANT GIRAFFE KANGAROO PENGUIN DOLPHIN OCTOPUS CHEETAH SQUIRREL HEDGEHOG FLAMINGO TORTOISE BUTTERFLY JELLYFISH RACCOON GORILLA PEACOCK LOBSTER OSTRICH BEAVER HAMSTER",
  Food: "PANCAKE SANDWICH AVOCADO BROCCOLI PINEAPPLE SPAGHETTI CUPCAKE PRETZEL BLUEBERRY POPCORN NOODLES OMELETTE PUMPKIN MUSHROOM CHOCOLATE BISCUIT WATERMELON",
  "Around the house": "BLANKET CURTAIN KETTLE TOASTER CUSHION LANTERN BATHTUB CUPBOARD DOORBELL BOOKSHELF MICROWAVE TEAPOT PILLOW CANDLE MIRROR",
  Nature: "VOLCANO WATERFALL RAINBOW THUNDER GLACIER MEADOW CANYON ISLAND SUNFLOWER BLOSSOM PEBBLE HORIZON SNOWFLAKE",
  Space: "COMET GALAXY PLANET ROCKET ASTEROID TELESCOPE SATELLITE ORBIT ECLIPSE METEOR",
  Sport: "FOOTBALL CRICKET BADMINTON SKATEBOARD VOLLEYBALL MARATHON TRAMPOLINE HOCKEY TENNIS KARATE SWIMMING",
  Music: "GUITAR TRUMPET VIOLIN DRUMMER MELODY ORCHESTRA PIANO UKULELE HARMONICA CONCERT",
  Job: "DOCTOR FARMER PILOT BAKER DENTIST ASTRONAUT TEACHER SCIENTIST PLUMBER ARTIST DETECTIVE",
};
const POOL = Object.entries(WORDS).flatMap(([hint, list]) => list.split(" ").map((w) => ({ word: w, hint })));
const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const skyEl = document.querySelector("[data-sky]");
const hintEl = document.querySelector("[data-hint]");
const wordEl = document.querySelector("[data-word]");
const keysEl = document.querySelector("[data-keys]");
const msgEl = document.querySelector("[data-msg]");

let current = null;
let guessed = new Set();
let left = BALLOONS;
let solved = 0;
let recent = [];
let busy = false;
let pendingEnd = null;
const keyBtns = {};

// ---- Build the balloons and keyboard ------------------------------------------------
function buildBalloons() {
  skyEl.innerHTML = "";
  for (let i = 0; i < BALLOONS; i++) {
    const b = document.createElement("span");
    b.className = "balloon";
    b.style.setProperty("--c", COLORS[i]);
    b.style.setProperty("--i", i);
    b.innerHTML = `<svg viewBox="0 0 40 60" aria-hidden="true"><path d="M20 44c10 0 17-10 17-21A17 17 0 0 0 3 23c0 11 7 21 17 21z" fill="var(--c)" stroke="#1B2A41" stroke-width="2.5"/><path d="M17 44l3 4 3-4z" fill="var(--c)" stroke="#1B2A41" stroke-width="2" stroke-linejoin="round"/><ellipse cx="13" cy="17" rx="3.5" ry="6" fill="#fff" opacity=".35" transform="rotate(20 13 17)"/></svg>`;
    skyEl.append(b);
  }
}

function buildKeys() {
  for (const row of ROWS) {
    const r = document.createElement("div");
    r.className = "wb-keys__row";
    for (const ch of row) {
      const k = document.createElement("button");
      k.type = "button";
      k.className = "wb-key";
      k.textContent = ch;
      k.setAttribute("aria-label", `Letter ${ch}`);
      k.addEventListener("click", () => guess(ch));
      keyBtns[ch] = k;
      r.append(k);
    }
    keysEl.append(r);
  }
}

// ---- Rounds ---------------------------------------------------------------------------------
function newWord() {
  const choices = POOL.filter((p) => !recent.includes(p.word));
  current = choices[Math.floor(Math.random() * choices.length)];
  recent = [current.word, ...recent].slice(0, 30);
  guessed = new Set();
  left = BALLOONS;
  busy = false;
  buildBalloons();
  skyEl.classList.remove("is-falling");
  hintEl.textContent = current.hint;
  msgEl.textContent = "";
  for (const k of Object.values(keyBtns)) { k.disabled = false; k.className = "wb-key"; }
  renderWord();
  updateStat();
}

function renderWord(reveal = false) {
  wordEl.innerHTML = "";
  for (const ch of current.word) {
    const s = document.createElement("span");
    s.className = "wb-letter";
    const known = guessed.has(ch);
    s.textContent = known || reveal ? ch : "";
    if (!known && reveal) s.classList.add("is-missed");
    if (known) s.classList.add("is-found");
    wordEl.append(s);
  }
  wordEl.setAttribute("aria-label", [...current.word].map((ch) => (guessed.has(ch) ? ch : "blank")).join(" "));
}

function updateStat() { shell.stat("balloons", "Balloons", `${left}/${BALLOONS}`).classList.toggle("is-low", left <= 2); }

function guess(ch) {
  if (!shell.isPlaying() || busy || !current || guessed.has(ch)) return;
  guessed.add(ch);
  const key = keyBtns[ch];
  key.disabled = true;

  if (current.word.includes(ch)) {
    key.classList.add("is-right");
    const count = [...current.word].filter((c) => c === ch).length;
    sound.play("tick", { pitch: 1 + guessed.size * 0.03 });
    renderWord();
    msgEl.textContent = count > 1 ? `${count} × ${ch}!` : "";
    if ([...current.word].every((c) => guessed.has(c))) wordSolved();
  } else {
    key.classList.add("is-wrong");
    popBalloon();
  }
}

function popBalloon() {
  left--;
  const b = skyEl.querySelectorAll(".balloon:not(.is-popped)");
  b[b.length - 1]?.classList.add("is-popped");
  sound.play("pop", { pitch: 0.6 });
  updateStat();
  if (left === 0) {
    busy = true;
    skyEl.classList.add("is-falling");
    sound.play("bump");
    renderWord(true);
    msgEl.textContent = `The word was ${current.word}`;
    endLater(() => shell.over({ message: solved ? `You solved ${solved} ${solved === 1 ? "word" : "words"}!` : `The word was ${current.word}.` }), 1600);
  } else if (left <= 2) {
    msgEl.textContent = left === 1 ? "Last balloon!" : "Careful…";
  }
}

function wordSolved() {
  busy = true;
  solved++;
  shell.addScore(1 + left);
  sound.play("win");
  wordEl.classList.add("is-solved");
  msgEl.textContent = left === BALLOONS ? "Perfect! +" + (1 + left) : `+${1 + left}`;
  endLater(() => { wordEl.classList.remove("is-solved"); newWord(); }, 1100);
}

/** Delay a step, but if the game gets paused, run it after resuming instead. */
function endLater(fn, ms) {
  const job = { fn };
  pendingEnd = job;
  setTimeout(() => runJob(job), ms);
}
function runJob(job) {
  if (pendingEnd !== job || !shell.isPlaying()) return;
  pendingEnd = null;
  job.fn();
}

window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); guess(e.key.toUpperCase()); }
});

// ---- Shell ------------------------------------------------------------------------------------------
const shell = createShell({
  id: "word-balloons",
  title: "Word Balloons",
  letterKeys: true,
  hint: "Guess the word one letter at a time. Every wrong letter pops a balloon!",
  onStart() {
    solved = 0;
    recent = [];
    pendingEnd = null;
    newWord();
  },
  onResume() {
    if (pendingEnd) { const job = pendingEnd; setTimeout(() => runJob(job), 300); }
  },
});

buildKeys();
current = { word: "BALLOON", hint: "Ready?" };
guessed = new Set(["B", "L"]);
buildBalloons();
hintEl.textContent = "Ready?";
renderWord();
updateStat();
