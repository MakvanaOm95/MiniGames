// ============================================================================
// Solitaire (Klondike) — Tiny Tock
// ----------------------------------------------------------------------------
// Goal: move all 52 cards up to the four foundations, Ace to King by suit.
// Tableau (the 7 columns): build DOWN in alternating colors (red 7 on black 8).
// Only a King can go into an empty column. Tap the stock to turn one card.
//
// Controls: drag cards, or just TAP a card and it jumps to the best place.
// Keyboard: Tab to a card and press Enter to auto-move it.
// Score = your time (faster is better). Undo is unlimited.
// ============================================================================

import { createShell, formatTime } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_NAMES = ["", "Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];
const isRed = (c) => c.suit === 1 || c.suit === 2;

const boardEl = document.querySelector("[data-board]");
const undoBtn = document.querySelector("[data-undo]");
const dealBtn = document.querySelector("[data-deal]");

// ---- State ---------------------------------------------------------------------------
const cards = [];          // all 52 cards: { id, suit, rank, up, el }
let stock = [], waste = [], found = [[], [], [], []], tab = [[], [], [], [], [], [], []];
let history = [];
let moves = 0;
let elapsed = 0, lastTick = 0, raf = 0;
let autoFinishing = false;
let won = false;
let geo = null;            // layout sizes, recalculated on resize

// ---- Cards -----------------------------------------------------------------------------
function makeCards() {
  for (let suit = 0; suit < 4; suit++)
    for (let rank = 1; rank <= 13; rank++) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `sc-card ${suit === 1 || suit === 2 ? "is-red" : ""}`;
      el.innerHTML = `
        <span class="sc-face" aria-hidden="true">
          <span class="sc-corner">${RANKS[rank]}<br>${SUITS[suit]}</span>
          <span class="sc-pip">${SUITS[suit]}</span>
          <span class="sc-corner sc-corner--end">${RANKS[rank]}<br>${SUITS[suit]}</span>
        </span>`;
      const card = { id: cards.length, suit, rank, up: false, el };
      cards.push(card);
      boardEl.append(el);
      attach(card);
    }
}

// Empty-slot outlines (stock, foundations, columns)
function makeSlots() {
  const mk = (cls, label, tag = "div") => {
    const s = document.createElement(tag);
    s.className = `sc-slot ${cls}`;
    if (label) s.innerHTML = `<span>${label}</span>`;
    boardEl.prepend(s);
    return s;
  };
  const slots = { stock: mk("sc-slot--stock", "↻", "button"), found: [0, 1, 2, 3].map(() => mk("sc-slot--found", "A")), tab: [0, 1, 2, 3, 4, 5, 6].map(() => mk("sc-slot--tab", "K")) };
  slots.stock.type = "button";
  slots.stock.setAttribute("aria-label", "Stock: turn a card");
  slots.stock.addEventListener("click", draw);
  return slots;
}
let slots = null;

// ---- Layout ---------------------------------------------------------------------------------
function measure() {
  const W = boardEl.clientWidth;
  const gap = Math.max(4, W * 0.014);
  const cw = (W - gap * 8) / 7;
  const ch = cw * 1.4;
  const colX = (i) => gap + i * (cw + gap);
  geo = { W, gap, cw, ch, colX, topY: gap, tabY: gap * 2 + ch + gap * 1.5 };
  boardEl.style.setProperty("--cw", `${cw}px`);
}

function place(el, x, y, z) {
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.style.zIndex = z;
}

/** Position every card and slot. Called after every change. */
function render() {
  if (!geo) measure();
  const { cw, ch, colX, topY, tabY } = geo;

  place(slots.stock, colX(0), topY, 0);
  slots.found.forEach((s, i) => place(s, colX(3 + i), topY, 0));
  slots.tab.forEach((s, i) => place(s, colX(i), tabY, 0));

  stock.forEach((c, i) => layCard(c, colX(0), topY, 10 + i, false));
  waste.forEach((c, i) => layCard(c, colX(1) + Math.max(0, i - (waste.length - 3)) * cw * 0.18, topY, 100 + i, i === waste.length - 1));
  found.forEach((pile, f) => pile.forEach((c, i) => layCard(c, colX(3 + f), topY, 200 + i, i === pile.length - 1)));

  // Columns: squeeze the spacing if a column gets very long
  const maxH = Math.max(ch * 3.2, window.innerHeight * 0.95 - tabY - 60);
  let tallest = tabY + ch;
  tab.forEach((pile, t) => {
    const downs = pile.filter((c) => !c.up).length;
    const ups = pile.length - downs;
    let upGap = ch * 0.27;
    const downGap = ch * 0.1;
    const needed = downs * downGap + Math.max(0, ups - 1) * upGap + ch;
    if (needed > maxH && ups > 1) upGap = Math.max(ch * 0.14, (maxH - ch - downs * downGap) / (ups - 1));
    let y = tabY;
    pile.forEach((c, i) => {
      layCard(c, colX(t), y, 300 + i, c.up);
      y += c.up ? upGap : downGap;
    });
    tallest = Math.max(tallest, y - (pile.length ? (pile[pile.length - 1].up ? upGap : downGap) : 0) + ch);
  });
  boardEl.style.height = `${Math.ceil(tallest + geo.gap * 2)}px`;
  undoBtn.disabled = !history.length || won;
}

function layCard(c, x, y, z, focusable) {
  c.x = x; c.y = y;
  place(c.el, x, y, z);
  c.el.classList.toggle("is-down", !c.up);
  c.el.tabIndex = c.up && focusable !== false ? 0 : -1;
  c.el.setAttribute("aria-label", c.up ? `${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}` : "Face-down card");
}

// ---- Rules ------------------------------------------------------------------------------------------
function whereIs(card) {
  if (stock.includes(card)) return { pile: stock, kind: "stock" };
  if (waste.includes(card)) return { pile: waste, kind: "waste" };
  for (let i = 0; i < 4; i++) if (found[i].includes(card)) return { pile: found[i], kind: "found", i };
  for (let i = 0; i < 7; i++) if (tab[i].includes(card)) return { pile: tab[i], kind: "tab", i };
}

const top = (pile) => pile[pile.length - 1];

function canFound(card, f) {
  const t = top(found[f]);
  return t ? t.suit === card.suit && card.rank === t.rank + 1 : card.rank === 1;
}
function canTab(card, t) {
  const tc = top(tab[t]);
  return tc ? tc.up && isRed(tc) !== isRed(card) && card.rank === tc.rank - 1 : card.rank === 13;
}

/** The cards that would move if you pick up `card` (a tableau stack, or a single card). */
function movingStack(card) {
  const w = whereIs(card);
  if (!w || !card.up) return null;
  if (w.kind === "tab") return w.pile.slice(w.pile.indexOf(card));
  return card === top(w.pile) ? [card] : null;
}

function snapshot() {
  const ids = (p) => p.map((c) => c.id);
  history.push({ stock: ids(stock), waste: ids(waste), found: found.map(ids), tab: tab.map(ids), up: cards.map((c) => c.up), moves });
  if (history.length > 500) history.shift();
}

function undo() {
  if (!shell.isPlaying() || !history.length || autoFinishing || won) return;
  const s = history.pop();
  const get = (ids) => ids.map((id) => cards[id]);
  stock = get(s.stock); waste = get(s.waste); found = s.found.map(get); tab = s.tab.map(get);
  cards.forEach((c, i) => (c.up = s.up[i]));
  moves = s.moves + 1;
  shell.stat("moves", "Moves", moves);
  sound.play("move", { pitch: 0.7 });
  render();
}

function moveCards(stack, dest) {
  snapshot();
  const from = whereIs(stack[0]);
  from.pile.splice(from.pile.indexOf(stack[0]), stack.length);
  dest.push(...stack);
  // flip the card that's now on top of the column we took from
  if (from.kind === "tab" && top(from.pile) && !top(from.pile).up) {
    top(from.pile).up = true;
    sound.play("tick", { pitch: 1.3 });
  }
  moves++;
  shell.stat("moves", "Moves", moves);
  render();
  afterMove(dest);
}

function afterMove(dest) {
  if (found.includes(dest)) {
    sound.play("pop", { pitch: 0.9 + top(dest).rank * 0.04 });
    const el = top(dest).el;
    el.classList.remove("is-bounce"); void el.offsetWidth; el.classList.add("is-bounce");
  } else sound.play("tock");
  if (found.every((p) => p.length === 13)) return win();
  maybeAutoFinish();
}

function draw() {
  if (!shell.isPlaying() || autoFinishing) return;
  snapshot();
  if (stock.length) {
    const c = stock.pop();
    c.up = true;
    waste.push(c);
    sound.play("click", { pitch: 1.2 });
  } else if (waste.length) {
    // turn the waste pile back over to make a new stock
    stock = waste.reverse().map((c) => ((c.up = false), c));
    waste = [];
    sound.play("move");
  } else {
    history.pop();
    return;
  }
  moves++;
  shell.stat("moves", "Moves", moves);
  render();
}

/** Tap / Enter: send a card to the best legal place. */
function autoMove(card) {
  if (!shell.isPlaying() || autoFinishing) return;
  const w = whereIs(card);
  if (w.kind === "stock") return draw();
  const stack = movingStack(card);
  if (!stack) return;
  if (stack.length === 1 && w.kind !== "found")
    for (let f = 0; f < 4; f++) if (canFound(card, f)) return moveCards(stack, found[f]);
  // prefer columns that already have cards (don't waste empty columns on non-Kings)
  const order = [0, 1, 2, 3, 4, 5, 6].filter((t) => !(w.kind === "tab" && w.i === t)).sort((a, b) => (tab[a].length ? 0 : 1) - (tab[b].length ? 0 : 1));
  for (const t of order) if (canTab(card, t)) {
    if (!tab[t].length && w.kind === "tab" && w.pile.indexOf(card) === 0) continue; // pointless King shuffle
    return moveCards(stack, tab[t]);
  }
  nope(card);
}

function nope(card) {
  card.el.classList.remove("is-nope"); void card.el.offsetWidth; card.el.classList.add("is-nope");
  sound.play("click", { pitch: 0.6 });
}

// When everything is face up and the stock is empty, finish automatically
function maybeAutoFinish() {
  if (autoFinishing || stock.length || waste.length || tab.some((p) => p.some((c) => !c.up))) return;
  autoFinishing = true;
  const step = () => {
    if (!shell.isPlaying()) { autoFinishing = false; return; } // paused: resume continues
    for (let t = 0; t < 7; t++) {
      const c = top(tab[t]);
      if (!c) continue;
      for (let f = 0; f < 4; f++)
        if (canFound(c, f)) {
          tab[t].pop();
          found[f].push(c);
          render();
          sound.play("pop", { pitch: 0.9 + c.rank * 0.04 });
          if (found.every((p) => p.length === 13)) { autoFinishing = false; return win(); }
          return setTimeout(step, 70);
        }
    }
    autoFinishing = false;
  };
  setTimeout(step, 250);
}

function win() {
  won = true;
  cancelAnimationFrame(raf);
  shell.setScore(Math.max(1, Math.floor(elapsed)), { animate: false });
  boardEl.classList.add("is-won");
  setTimeout(() => {
    boardEl.classList.remove("is-won");
    shell.over({ message: `You won in ${moves} moves!`, win: true });
  }, 900);
}

// ---- Pointer: tap or drag ------------------------------------------------------------------------------
function attach(card) {
  let drag = null;
  card.el.addEventListener("pointerdown", (e) => {
    if (!shell.isPlaying() || autoFinishing || e.button > 0) return;
    const w = whereIs(card);
    if (w.kind === "stock") { e.preventDefault(); return draw(); }
    const stack = movingStack(card);
    if (!stack) return;
    e.preventDefault();
    card.el.setPointerCapture(e.pointerId);
    drag = { stack, sx: e.clientX, sy: e.clientY, moved: false };
  });
  card.el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.stack.forEach((c, i) => { c.el.classList.add("is-dragging"); c.el.style.zIndex = 1000 + i; });
    }
    drag.stack.forEach((c) => (c.el.style.transform = `translate(${c.x + dx}px, ${c.y + dy}px)`));
  });
  const end = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.stack.forEach((c) => c.el.classList.remove("is-dragging"));
    if (!d.moved) return autoMove(card);
    // drop where the middle of the dragged card is
    const r = boardEl.getBoundingClientRect();
    const cx = card.x + (e.clientX - d.sx) + geo.cw / 2;
    const cy = card.y + (e.clientY - d.sy) + geo.ch / 2;
    const target = dropTarget(cx, cy, r);
    if (target?.kind === "found" && d.stack.length === 1 && canFound(card, target.i)) return moveCards(d.stack, found[target.i]);
    if (target?.kind === "tab" && canTab(card, target.i) && !tab[target.i].includes(card)) return moveCards(d.stack, tab[target.i]);
    render(); // snap back
    sound.play("click", { pitch: 0.6 });
  };
  card.el.addEventListener("pointerup", end);
  card.el.addEventListener("pointercancel", () => { if (drag) { drag.stack.forEach((c) => c.el.classList.remove("is-dragging")); drag = null; render(); } });
  card.el.addEventListener("click", (e) => { if (e.detail === 0) autoMove(card); }); // keyboard Enter/Space
}

function dropTarget(x, y) {
  const { cw, ch, colX, topY, tabY } = geo;
  const col = Math.floor((x - geo.gap / 2) / (cw + geo.gap));
  if (col < 0 || col > 6) return null;
  if (y < topY + ch + geo.gap && col >= 3) return { kind: "found", i: col - 3 };
  if (y >= tabY - geo.gap) return { kind: "tab", i: col };
  return null;
}

// ---- Timer --------------------------------------------------------------------------------------------------
function tick(now) {
  elapsed += (now - lastTick) / 1000;
  lastTick = now;
  if (Math.floor(elapsed) !== shell.score) shell.setScore(Math.floor(elapsed), { animate: false });
  raf = requestAnimationFrame(tick);
}
function run() { lastTick = performance.now(); raf = requestAnimationFrame(tick); }

// ---- Deal ---------------------------------------------------------------------------------------------------
function deal() {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  deck.forEach((c) => (c.up = false));
  tab = [[], [], [], [], [], [], []];
  for (let t = 0; t < 7; t++)
    for (let k = 0; k <= t; k++) {
      const c = deck.pop();
      c.up = k === t;
      tab[t].push(c);
    }
  stock = deck;
  waste = [];
  found = [[], [], [], []];
  history = [];
  moves = 0;
  won = false;
  autoFinishing = false;
  shell.stat("moves", "Moves", 0);
  boardEl.classList.add("is-dealing");
  render();
  setTimeout(() => boardEl.classList.remove("is-dealing"), 600);
}

undoBtn.addEventListener("click", undo);
dealBtn.addEventListener("click", () => { if (shell.state === "playing" || shell.state === "over") shell.start(); });
window.addEventListener("keydown", (e) => {
  if (shell.isPlaying() && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
});
new ResizeObserver(() => { measure(); render(); }).observe(boardEl);

// ---- Shell ------------------------------------------------------------------------------------------------------
const shell = createShell({
  id: "solitaire",
  title: "Solitaire",
  scoreLabel: "Time",
  lowerIsBetter: true,
  format: formatTime,
  hint: "Build each suit from Ace to King. Drag cards, or just tap one and it moves to the best spot.",
  onStart() {
    cancelAnimationFrame(raf);
    elapsed = 0;
    deal();
    run();
  },
  onPause() { cancelAnimationFrame(raf); },
  onResume() { if (!won) { run(); maybeAutoFinish(); } },
});

makeCards();
slots = makeSlots();
deal(); // a deal is shown behind the start screen
