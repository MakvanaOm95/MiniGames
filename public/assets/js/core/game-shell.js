// ============================================================================
// game-shell.js — the frame every Tiny Tock game plugs into
// ----------------------------------------------------------------------------
// Gives each game, for free and identical everywhere:
//   • score + best-score bar, with the best saved on the device
//   • start screen, pause screen, game-over screen (with "Play next")
//   • pause on P / Esc, auto-pause when the tab is hidden
//   • mute button, new-best celebration, sounds for start / game over
//
// A game only writes its own rules. Minimal example:
//
//   const shell = createShell({
//     id: "snake", title: "Snake",
//     hint: "Arrow keys or swipe to steer.",
//     onStart()  { resetBoard(); loop(); },   // called on Play / Play again
//     onPause()  { … },  onResume() { … },   // optional
//   });
//   shell.addScore(1);                         // while playing
//   shell.stat("time", "Time", "0:40");        // extra box in the score bar
//   shell.over({ message: "Bonk! You hit the wall." });  // when the round ends
//   shell.over({ message: "Boom!", record: false });     // lost: don't save a best
// ============================================================================

import * as sound from "./sound.js";
import * as storage from "./storage.js";
import { onKeys } from "./input.js";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4.5 3.5v4.5H9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function createShell({
  id,
  title,
  hint = "",
  root = document.querySelector("[data-game]"),
  scoreLabel = "Score",
  lowerIsBetter = false,     // true for games scored by time (faster = better)
  format = (n) => String(n), // how scores are shown, e.g. seconds → "1:05"
  letterKeys = false,        // true if the game uses letter keys (then P won't pause; Esc still does)
  onStart = () => {},
  onPause = () => {},
  onResume = () => {},
}) {
  const stage = root.querySelector(".game__stage");
  let state = "ready"; // ready | playing | paused | over
  let score = 0;
  let best = storage.getBest(id);

  // ---- Build the score bar -------------------------------------------------
  const hud = document.createElement("div");
  hud.className = "game__hud";
  hud.innerHTML = `
    <div class="hud-stat"><span class="hud-stat__label">${scoreLabel}</span><output class="hud-stat__value" data-score>${format(0)}</output></div>
    <div class="hud-stat hud-stat--best"><span class="hud-stat__label">Best</span><span class="hud-stat__value" data-best>${best === null ? "–" : format(best)}</span></div>
    <div class="hud-actions">
      <button class="hud-btn" type="button" data-act="pause" aria-label="Pause" disabled>${ICONS.pause}</button>
      <button class="hud-btn" type="button" data-act="mute" aria-label="Mute sound" aria-pressed="false">${ICONS.sound}</button>
    </div>`;
  root.prepend(hud);
  const $score = hud.querySelector("[data-score]");
  const $best = hud.querySelector("[data-best]");
  const $pause = hud.querySelector('[data-act="pause"]');
  const $mute = hud.querySelector('[data-act="mute"]');

  // ---- Build the overlay screens ---------------------------------------------
  const overlay = document.createElement("div");
  overlay.className = "game-overlay";
  overlay.setAttribute("aria-live", "polite");
  stage.append(overlay);
  stage.tabIndex = -1; // lets us move keyboard focus onto the board

  // Link to the first "Play next" game on the page (falls back to the homepage)
  const nextLink = document.querySelector(".play-next .tile__link");
  const nextHref = nextLink?.getAttribute("href") ?? "/games/";
  const nextName = nextLink?.querySelector(".tile__title")?.textContent ?? "More games";

  function showScreen(html) {
    overlay.innerHTML = `<div class="game-overlay__card">${html}</div>`;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    overlay.querySelector("[data-primary]")?.focus({ preventScroll: true });
  }
  function hideScreen() {
    overlay.classList.remove("is-visible");
    overlay.hidden = true;
    stage.focus({ preventScroll: true });
  }

  function readyScreen() {
    showScreen(`
      <p class="game-overlay__eyebrow">Tiny Tock</p>
      <h2 class="game-overlay__title">${title}</h2>
      ${hint ? `<p class="game-overlay__hint">${hint}</p>` : ""}
      <button class="btn btn--play" type="button" data-primary data-act="start">${ICONS.play}<span>Play</span></button>`);
  }

  // ---- State changes ---------------------------------------------------------
  function start() {
    score = 0;
    $score.textContent = format(0);
    state = "playing";
    $pause.disabled = false;
    hideScreen();
    sound.play("start");
    // On phones, bring the whole board into view
    if (root.getBoundingClientRect().top < 0 || root.getBoundingClientRect().bottom > innerHeight) {
      root.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    }
    onStart();
  }

  function pause() {
    if (state !== "playing") return;
    state = "paused";
    onPause();
    showScreen(`
      <h2 class="game-overlay__title">Paused</h2>
      <p class="game-overlay__hint">Take your time. Your game is waiting.</p>
      <div class="game-overlay__actions">
        <button class="btn btn--play" type="button" data-primary data-act="resume">${ICONS.play}<span>Resume</span></button>
        <button class="btn btn--ghost" type="button" data-act="start">${ICONS.replay}<span>Restart</span></button>
      </div>`);
  }

  function resume() {
    if (state !== "paused") return;
    state = "playing";
    hideScreen();
    onResume();
  }

  function over({ message = "Game over", win = false, record = true } = {}) {
    if (state !== "playing") return;
    state = "over";
    $pause.disabled = true;
    // record: false = the round was lost (e.g. hit a mine), so don't save a best time
    const isBest = record ? storage.submitScore(id, score, { lowerIsBetter }) : false;
    if (isBest) {
      best = score;
      $best.textContent = format(best);
    }
    sound.play(win ? "win" : "over");
    if (isBest && score > 0) setTimeout(() => sound.play("ding"), 380);

    showScreen(`
      <p class="game-overlay__eyebrow">${message}</p>
      <p class="game-overlay__score"><span class="visually-hidden">${scoreLabel}: </span>${format(score)}</p>
      ${isBest && score > 0
        ? `<p class="game-overlay__best is-new">New personal best!</p>`
        : `<p class="game-overlay__best">Best: ${best === null ? "–" : format(best)}</p>`}
      <div class="game-overlay__actions">
        <button class="btn btn--play" type="button" data-primary data-act="start">${ICONS.replay}<span>Play again</span></button>
        <a class="btn btn--ghost" href="${nextHref}"><span>${nextLink ? `Next: ${nextName}` : nextName}</span>${ICONS.next}</a>
      </div>`);
    if (isBest && score > 0) confetti(overlay);
  }

  // ---- Wiring -----------------------------------------------------------------
  overlay.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "start") start();
    if (act === "resume") resume();
  });

  $pause.addEventListener("click", () => (state === "playing" ? pause() : resume()));

  const renderMute = (m) => {
    $mute.innerHTML = m ? ICONS.mute : ICONS.sound;
    $mute.setAttribute("aria-pressed", String(m));
    $mute.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
  };
  renderMute(sound.isMuted());
  sound.onMuteChange(renderMute);
  $mute.addEventListener("click", () => sound.toggleMuted());

  // Track whether the board is on screen (so Space only starts a game you can see)
  let onScreen = true;
  new IntersectionObserver(([entry]) => { onScreen = entry.intersectionRatio > 0.5; }, { threshold: [0, 0.5, 1] }).observe(stage);

  // P / Esc pauses and resumes; Space / Enter starts from the ready or game-over screen
  onKeys(
    (name) => {
      if (name === "pause") state === "playing" ? pause() : resume();
      else start();
    },
    {
      active: (name, e) =>
        name === "pause" ? (state === "playing" || state === "paused") && !(letterKeys && e.code === "KeyP")
        : name === "action" ? onScreen && (state === "ready" || state === "over")
        : false,
    }
  );

  // Switching tabs or apps pauses the game automatically
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  readyScreen();

  // ---- What the game can use ---------------------------------------------------
  return {
    get state() { return state; },
    get score() { return score; },
    get best() { return best; },
    isPlaying: () => state === "playing",
    setScore(n, { animate = true } = {}) {
      score = n;
      $score.textContent = format(score);
      if (animate) bump($score);
    },
    addScore(n = 1) { this.setScore(score + n); },
    /** Show or update an extra box in the score bar (time left, lives, level…). */
    stat(key, label, value) {
      let box = hud.querySelector(`[data-stat="${key}"]`);
      if (!box) {
        box = document.createElement("div");
        box.className = "hud-stat hud-stat--extra";
        box.dataset.stat = key;
        box.innerHTML = `<span class="hud-stat__label">${label}</span><span class="hud-stat__value"></span>`;
        hud.querySelector(".hud-actions").before(box);
      }
      const v = box.querySelector(".hud-stat__value");
      if (v.textContent !== String(value)) v.textContent = value;
      return box;
    },
    start,
    pause,
    resume,
    over,
    sound,
  };
}

/** Quick "pop" animation on the score number. */
function bump(el) {
  el.classList.remove("is-bumped");
  void el.offsetWidth; // restart the CSS animation
  el.classList.add("is-bumped");
}

/** A burst of paper confetti in brand colors (skipped for reduced motion). */
function confetti(container) {
  if (reducedMotion()) return;
  const colors = ["#E8553D", "#F2B33D", "#2F8F83", "#6FA9D8", "#7A4E8C"];
  const layer = document.createElement("div");
  layer.className = "confetti";
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement("i");
    bit.style.setProperty("--x", `${(Math.random() - 0.5) * 520}px`);
    bit.style.setProperty("--y", `${-120 - Math.random() * 220}px`);
    bit.style.setProperty("--r", `${(Math.random() - 0.5) * 900}deg`);
    bit.style.setProperty("--d", `${0.9 + Math.random() * 0.7}s`);
    bit.style.background = colors[i % colors.length];
    layer.append(bit);
  }
  container.append(layer);
  setTimeout(() => layer.remove(), 1800);
}

/**
 * Make a <canvas> sharp on high-DPI screens and keep it sized to its box.
 * Calls onResize(width, height) in CSS pixels whenever the size changes.
 * Returns the 2D drawing context.
 */
export function setupCanvas(canvas, onResize = () => {}) {
  const ctx = canvas.getContext("2d");
  const fit = () => {
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize(width, height);
  };
  new ResizeObserver(fit).observe(canvas);
  fit();
  return ctx;
}

/** Seconds → "m:ss" (e.g. 75 → "1:15"). Handy for timers and time-based scores. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
