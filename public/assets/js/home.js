// ============================================================================
// home.js — game shelf behaviour for the homepage and the All games page
// ----------------------------------------------------------------------------
// Homepage: picks "Today's pick" (changes every day), shows it plus the top 5,
// and powers the clock dial, category chips and "Surprise me".
// Turning the clock or choosing a category searches EVERY game.
// All games page: just the category chips.
//
// The tiles are already in the HTML (written by tools/sync.mjs), so the page
// still works without JavaScript. This file only rearranges and filters.
// ============================================================================

import * as sound from "./core/sound.js";

const dial = document.querySelector("[data-dial]");
const opts = [...document.querySelectorAll(".dial__opt")];
const caption = document.querySelector("[data-dial-caption]");
const chips = [...document.querySelectorAll(".chip")];
const grid = document.querySelector("[data-grid]");
const tiles = [...document.querySelectorAll("[data-grid] .tile")];
const isHome = Boolean(dial); // the All games page has no dial
const status = document.querySelector("[data-shelf-status]");
const empty = document.querySelector("[data-empty]");

const filter = { minutes: "all", category: "all" };
let angle = 360; // where the clock hand points (degrees)

// ---- Draw the 60 little tick marks around the clock face (decoration) -----
const ticks = document.querySelector("[data-ticks]");
if (ticks) {
  const ns = "http://www.w3.org/2000/svg";
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const a = (i / 60) * Math.PI * 2;
    const r1 = 142, r2 = major ? 126 : 134;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", 200 + r1 * Math.sin(a));
    line.setAttribute("y1", 250 - r1 * Math.cos(a));
    line.setAttribute("x2", 200 + r2 * Math.sin(a));
    line.setAttribute("y2", 250 - r2 * Math.cos(a));
    line.setAttribute("stroke-width", major ? 4 : 2);
    ticks.append(line);
  }
}

// ---- Today's pick + top 5 (homepage only) ------------------------------------
// Same formula as tools/sync.mjs: one game per day, cycling through the list.
const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);

function setBadge(tile, text) {
  let badge = tile.querySelector(".tile__badge");
  if (!text) return badge?.remove();
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "tile__badge";
    tile.querySelector(".tile__body").prepend(badge);
  }
  badge.textContent = text;
}

function arrangeToday() {
  const inOrder = [...tiles].sort((a, b) => a.dataset.order - b.dataset.order);
  const pick = inOrder[dayNumber() % inOrder.length];
  const top = tiles
    .filter((t) => t !== pick && t.dataset.rank !== undefined)
    .sort((a, b) => a.dataset.rank - b.dataset.rank)
    .slice(0, 5);
  const rest = inOrder.filter((t) => t !== pick && !top.includes(t));

  for (const t of tiles) {
    t.classList.toggle("tile--feature", t === pick);
    t.toggleAttribute("data-extra", rest.includes(t));
    setBadge(t, t === pick ? "Today’s pick" : t.dataset.badge);
  }
  grid.append(pick, ...top, ...rest); // put them in display order
}

// ---- Apply the current filters to the tiles --------------------------------
function applyFilters() {
  // Not filtering on the homepage = show today's pick + top 5 only
  const browsing = filter.minutes === "all" && filter.category === "all";
  const compact = isHome && browsing;
  grid.classList.toggle("is-filtering", !compact);

  let shown = 0;
  for (const tile of tiles) {
    const okTime = filter.minutes === "all" || tile.dataset.minutes === filter.minutes;
    const okCat = filter.category === "all" || tile.dataset.category === filter.category;
    tile.hidden = compact ? tile.hasAttribute("data-extra") : !(okTime && okCat);
    if (!tile.hidden) shown++;
  }
  empty.hidden = shown > 0;

  const word = shown === 1 ? "game" : "games";
  const timeText = filter.minutes === "all" ? "" : filter.minutes === "5" ? " that take 5+ minutes" : ` that take about ${filter.minutes} ${filter.minutes === "1" ? "minute" : "minutes"}`;
  const catText = filter.category === "all" ? "" : ` in ${document.querySelector(`.chip[data-category="${filter.category}"]`)?.textContent ?? filter.category}`;
  status.textContent = compact
    ? `Today’s pick and our top ${shown - 1}, out of ${tiles.length} games`
    : browsing
      ? `Showing all ${shown} ${word}`
      : `Showing ${shown} ${word}${catText}${timeText}`;
  return shown;
}

// ---- The dial ----------------------------------------------------------------
function choose(btn, { fromUser = true } = {}) {
  const target = Number(btn.dataset.angle);
  const steps = Math.round(Math.abs(target - angle) / 30); // one tick per "hour" turned
  angle = target;

  opts.forEach((o) => {
    o.setAttribute("aria-checked", String(o === btn));
    o.tabIndex = o === btn ? 0 : -1; // arrow keys move within the group
  });
  dial.style.setProperty("--angle", `${angle}deg`);
  dial.style.setProperty("--wind", (angle / 360) * 100);

  filter.minutes = btn.dataset.minutes;
  const shown = applyFilters();

  if (fromUser) {
    // Winding sound: a few quick ticks, then a "ding" if something fits
    for (let i = 0; i < Math.max(steps, 1); i++) setTimeout(() => sound.play(i % 2 ? "tock" : "tick"), i * 55);
    dial.classList.remove("is-wiggling");
    void dial.offsetWidth;
    dial.classList.add("is-wiggling");

    const mins = btn.dataset.minutes;
    caption.innerHTML =
      mins === "all"
        ? `Today’s pick and our <strong>top games</strong>`
        : shown
          ? `<strong>${shown} ${shown === 1 ? "game fits" : "games fit"}</strong> a ${mins === "5" ? "5+" : mins}-minute break`
          : `Nothing that short yet. Try another time!`;
  }
}

opts.forEach((btn) => {
  btn.tabIndex = btn.getAttribute("aria-checked") === "true" ? 0 : -1;
  btn.addEventListener("click", () => choose(btn));
});

// Radio-group keyboard support: arrow keys move around the clock
dial?.addEventListener("keydown", (e) => {
  const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!dir) return;
  e.preventDefault();
  const i = opts.findIndex((o) => o.getAttribute("aria-checked") === "true");
  const next = opts[(i + dir + opts.length) % opts.length];
  choose(next);
  next.focus();
});

// ---- Category chips -------------------------------------------------------------
chips.forEach((chip) =>
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    filter.category = chip.dataset.category;
    applyFilters();
    sound.play("click");
  })
);

// "show every game" link inside the empty message
document.querySelector("[data-reset]")?.addEventListener("click", () => {
  chips[0]?.click();
  if (isHome) choose(opts.find((o) => o.dataset.minutes === "all"));
});

// ---- Surprise me: jump to a random game that matches the current filters -------
document.querySelector("[data-surprise]")?.addEventListener("click", () => {
  // any game that matches the current filters (not just the ones on screen)
  const pool = tiles.filter((t) =>
    (filter.minutes === "all" || t.dataset.minutes === filter.minutes) &&
    (filter.category === "all" || t.dataset.category === filter.category));
  const pick = (pool.length ? pool : tiles)[Math.floor(Math.random() * (pool.length || tiles.length))];
  const link = pick?.querySelector("a");
  if (link) {
    sound.play("pop");
    setTimeout(() => (location.href = link.href), 120);
  }
});

if (isHome) arrangeToday();
applyFilters();
