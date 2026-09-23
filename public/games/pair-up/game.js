// ============================================================================
// Pair Up — Tiny Tock
// ----------------------------------------------------------------------------
// 16 face-down cards hide 8 pairs. Flip two at a time; matching pairs stay up.
// You have 60 seconds. Clear a whole board for +5 seconds and a fresh deal.
// Score = number of pairs found.
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const ROUND_SECONDS = 60;
const CLEAR_BONUS = 5;
const MISMATCH_MS = 650;

// Eight toy icons (simple SVG shapes in brand colors)
const ICONS = {
  clock: `<circle cx="32" cy="34" r="20" fill="#E8553D"/><circle cx="32" cy="34" r="13" fill="#FBF7F0" stroke="none"/><path d="M32 26v8l6 4" fill="none"/><path d="M14 20a8 8 0 0 1 10-8zM50 20a8 8 0 0 0-10-8z" fill="#F2B33D"/>`,
  star: `<path d="M32 10l6.5 13.5 14.5 2-10.5 10 2.5 14.5L32 43l-13 7 2.5-14.5-10.5-10 14.5-2z" fill="#F2B33D"/>`,
  heart: `<path d="M32 52S12 39 12 25a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 14-20 27-20 27z" fill="#E8553D"/>`,
  moon: `<path d="M44 44A18 18 0 0 1 26 14a20 20 0 1 0 24 26 18 18 0 0 1-6 4z" fill="#6FA9D8"/><circle cx="46" cy="18" r="3" fill="#F2B33D"/>`,
  bolt: `<path d="M36 8L16 36h14l-4 20 22-30H34z" fill="#F2B33D"/>`,
  leaf: `<path d="M14 50C14 26 30 12 52 12c0 24-14 38-38 38z" fill="#2F8F83"/><path d="M14 50L38 26" fill="none"/>`,
  drop: `<path d="M32 8s16 20 16 32a16 16 0 0 1-32 0C16 28 32 8 32 8z" fill="#6FA9D8"/><path d="M25 40a7 7 0 0 0 7 7" fill="none" stroke="#FBF7F0"/>`,
  crown: `<path d="M12 46l-2-26 12 10 10-16 10 16 12-10-2 26z" fill="#7A4E8C"/><path d="M12 46h40" fill="none"/>`,
};

const board = document.querySelector("[data-cards]");
let deck = [];            // [{ icon, el, matched }]
let open = [];            // cards currently face-up and unmatched
let busy = false;         // true while a mismatch is flipping back
let timeLeft = ROUND_SECONDS;
let lastTick = 0;
let raf = 0;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal() {
  const icons = shuffle([...Object.keys(ICONS), ...Object.keys(ICONS)]);
  board.innerHTML = "";
  deck = icons.map((icon, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "card";
    el.style.setProperty("--i", i);
    el.setAttribute("aria-label", "Face-down card");
    el.innerHTML = `
      <span class="card__inner">
        <span class="card__back" aria-hidden="true"></span>
        <span class="card__front" aria-hidden="true"><svg viewBox="0 0 64 64"><g stroke="#1B2A41" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${ICONS[icon]}</g></svg></span>
      </span>`;
    const card = { icon, el, matched: false };
    el.addEventListener("click", () => flip(card));
    board.append(el);
    return card;
  });
  open = [];
  busy = false;
}

function flip(card) {
  if (!shell.isPlaying() || busy || card.matched || open.includes(card)) return;
  card.el.classList.add("is-up");
  card.el.setAttribute("aria-label", `Card: ${card.icon}`);
  sound.play("tick");
  open.push(card);
  if (open.length < 2) return;

  const [a, b] = open;
  if (a.icon === b.icon) {
    a.matched = b.matched = true;
    a.el.classList.add("is-matched");
    b.el.classList.add("is-matched");
    a.el.disabled = b.el.disabled = true;
    open = [];
    shell.addScore(1);
    sound.play("pop", { pitch: 1 + (shell.score % 8) * 0.06 });
    if (deck.every((c) => c.matched)) {
      timeLeft += CLEAR_BONUS;
      sound.play("win");
      flashBonus();
      setTimeout(() => shell.isPlaying() && deal(), 700);
    }
  } else {
    busy = true;
    setTimeout(() => {
      a.el.classList.add("is-wrong");
      b.el.classList.add("is-wrong");
      sound.play("move", { pitch: 0.7 });
    }, 250);
    setTimeout(() => {
      for (const c of [a, b]) {
        c.el.classList.remove("is-up", "is-wrong");
        c.el.setAttribute("aria-label", "Face-down card");
      }
      open = [];
      busy = false;
    }, MISMATCH_MS);
  }
}

function flashBonus() {
  const tag = document.createElement("p");
  tag.className = "bonus-tag";
  tag.textContent = `Board cleared! +${CLEAR_BONUS}s`;
  board.parentElement.append(tag);
  setTimeout(() => tag.remove(), 1200);
}

// ---- Timer ----------------------------------------------------------------------
function showTime() {
  const box = shell.stat("time", "Time", formatTime(Math.ceil(timeLeft)));
  box.classList.toggle("is-low", timeLeft <= 10);
}

function tick(now) {
  const before = Math.ceil(timeLeft);
  timeLeft -= (now - lastTick) / 1000;
  lastTick = now;
  if (timeLeft <= 0) {
    timeLeft = 0;
    showTime();
    shell.over({ message: "Time’s up!" });
    return;
  }
  showTime();
  // tick-tock for the last 5 seconds
  if (timeLeft <= 5 && Math.ceil(timeLeft) !== before) sound.play("tock");
  raf = requestAnimationFrame(tick);
}

function run() {
  lastTick = performance.now();
  raf = requestAnimationFrame(tick);
}

// ---- Shell ------------------------------------------------------------------------
const shell = createShell({
  id: "pair-up",
  title: "Pair Up",
  scoreLabel: "Pairs",
  hint: "Flip two cards at a time and find the matching pairs. You’ve got 60 seconds!",
  onStart() {
    cancelAnimationFrame(raf);
    timeLeft = ROUND_SECONDS;
    deal();
    showTime();
    run();
  },
  onPause() { cancelAnimationFrame(raf); },
  onResume() { run(); },
});

deal();
showTime();
