// ============================================================================
// Card Pyramid — Tiny Tock
// ----------------------------------------------------------------------------
// Pyramid solitaire. 28 cards are dealt in a pyramid; the rest make the stock.
// Remove two cards that add up to 13 (J = 11, Q = 12, A = 1). A King is 13 on
// its own, so it goes by itself. You can only use cards that nothing covers,
// plus the top card of the waste pile. Tap the stock to turn a card over;
// when it runs out you can flip the waste back over twice.
// Clear the whole pyramid for a bonus and a fresh deal. The game ends when
// there are no moves left. Score: 5 per card, 50 per cleared pyramid.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import * as sound from "/assets/js/core/sound.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const ROWS = 7;
const REDEALS = 2;
const CARD_POINTS = 5;
const CLEAR_BONUS = 50;

// Layout, in card widths
const STEP_X = 1.08;
const STEP_Y = 0.6;
const BOARD_W = ROWS * STEP_X + 0.3;
const PILE_Y = 0.15 + (ROWS - 1) * STEP_Y + 1.4 + 0.35;
const BOARD_H = PILE_Y + 1.4 + 0.2;

const boardEl = document.querySelector("[data-board]");
const liveEl = document.querySelector("[data-live]");

let pyramid = [];   // pyramid[row][i] = card or null once removed
let stock = [];
let waste = [];
let redealsLeft = REDEALS;
let selected = null;
let round = 1;
let busy = false;
let stockEl, wasteSlotEl;

// ---- Cards -------------------------------------------------------------------------------------
function makeDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ rank: r, suit: s, id: `${r}-${s}` });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardName(c) {
  const names = ["", "Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];
  return `${names[c.rank]} of ${["spades", "hearts", "diamonds", "clubs"][c.suit]}`;
}

function makeEl(card) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "cp-card" + (card.suit === 1 || card.suit === 2 ? " is-red" : "");
  el.innerHTML = `
    <span class="cp-corner">${RANKS[card.rank]}<br>${SUITS[card.suit]}</span>
    <span class="cp-pip">${SUITS[card.suit]}</span>
    <span class="cp-corner cp-corner--end">${RANKS[card.rank]}<br>${SUITS[card.suit]}</span>`;
  el.addEventListener("click", () => tapCard(card));
  card.el = el;
  return el;
}

function place(card, x, y, z) {
  card.el.style.left = `calc(var(--cw) * ${x})`;
  card.el.style.top = `calc(var(--cw) * ${y})`;
  card.el.style.zIndex = z;
}

// ---- Rules ---------------------------------------------------------------------------------------
function isFree(row, i) {
  if (!pyramid[row][i]) return false;
  if (row === ROWS - 1) return true;
  return !pyramid[row + 1][i] && !pyramid[row + 1][i + 1];
}

/** Every card you could use right now. */
function available() {
  const list = [];
  for (let r = 0; r < ROWS; r++) for (let i = 0; i <= r; i++) if (isFree(r, i)) list.push(pyramid[r][i]);
  if (waste.length) list.push(waste[waste.length - 1]);
  return list;
}
const isAvailable = (card) => available().includes(card);

function hasMove() {
  const cards = available();
  if (cards.some((c) => c.rank === 13)) return true;
  for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) if (cards[a].rank + cards[b].rank === 13) return true;
  return stock.length > 0 || (redealsLeft > 0 && waste.length > 0);
}

function pyramidCleared() { return pyramid.every((row) => row.every((c) => !c)); }

// ---- Dealing --------------------------------------------------------------------------------------
function deal() {
  const deck = makeDeck();
  boardEl.innerHTML = "";
  boardEl.style.setProperty("--bw", BOARD_W);
  boardEl.style.setProperty("--bh", BOARD_H);

  pyramid = [];
  for (let r = 0; r < ROWS; r++) {
    pyramid.push([]);
    for (let i = 0; i <= r; i++) {
      const card = deck.pop();
      boardEl.append(makeEl(card));
      card.where = { row: r, i };
      place(card, 0.15 + (ROWS - 1 - r) * (STEP_X / 2) + i * STEP_X, 0.15 + r * STEP_Y, r + 1);
      pyramid[r].push(card);
    }
  }
  stock = deck;
  for (const card of stock) { boardEl.append(makeEl(card)); card.where = "stock"; }
  waste = [];
  redealsLeft = REDEALS;
  selected = null;

  // stock button + empty waste outline
  stockEl = document.createElement("button");
  stockEl.type = "button";
  stockEl.className = "cp-stock";
  stockEl.style.left = `calc(var(--cw) * ${BOARD_W / 2 - 1.15})`;
  stockEl.style.top = `calc(var(--cw) * ${PILE_Y})`;
  stockEl.addEventListener("click", drawCard);
  wasteSlotEl = document.createElement("div");
  wasteSlotEl.className = "cp-slot";
  wasteSlotEl.style.left = `calc(var(--cw) * ${BOARD_W / 2 + 0.15})`;
  wasteSlotEl.style.top = `calc(var(--cw) * ${PILE_Y})`;
  boardEl.append(stockEl, wasteSlotEl);
  render();
}

// ---- Playing -------------------------------------------------------------------------------------
function tapCard(card) {
  if (!shell.isPlaying() || busy) return;
  if (!isAvailable(card)) { nope(card); return; }
  if (card.rank === 13) { remove([card]); return; }
  if (!selected) {
    selected = card;
    sound.play("tick");
  } else if (selected === card) {
    selected = null;
  } else if (selected.rank + card.rank === 13) {
    remove([selected, card]);
    return;
  } else {
    nope(card);
    selected = card;
  }
  render();
}

function nope(card) {
  sound.play("bump", { pitch: 1.6 });
  card.el.classList.remove("is-nope");
  void card.el.offsetWidth;
  card.el.classList.add("is-nope");
}

function remove(cards) {
  for (const card of cards) {
    if (card.where === "waste") waste.pop();
    else pyramid[card.where.row][card.where.i] = null;
    card.where = "gone";
    card.el.classList.add("is-gone");
    card.el.disabled = true;
    setTimeout(() => card.el.remove(), 300);
  }
  selected = null;
  shell.addScore(cards.length * CARD_POINTS);
  sound.play("pop", { pitch: cards.length === 1 ? 0.9 : 1.2 });
  say(cards.length === 1 ? "King removed" : `${RANKS[cards[0].rank]} and ${RANKS[cards[1].rank]} make 13!`);

  if (pyramidCleared()) {
    shell.addScore(CLEAR_BONUS);
    round++;
    busy = true;
    sound.play("win");
    boardEl.classList.add("is-won");
    say(`Pyramid cleared! +${CLEAR_BONUS}. Dealing pyramid ${round}.`);
    setTimeout(() => {
      busy = false;
      boardEl.classList.remove("is-won");
      if (shell.isPlaying()) { deal(); shell.stat("round", "Pyramid", round); checkStuck(); }
    }, 1200);
    render();
    return;
  }
  render();
  checkStuck();
}

function drawCard() {
  if (!shell.isPlaying() || busy) return;
  selected = null;
  if (stock.length) {
    const card = stock.pop();
    card.where = "waste";
    waste.push(card);
    sound.play("tock");
  } else if (redealsLeft > 0 && waste.length) {
    redealsLeft--;
    stock = waste.reverse();
    waste = [];
    for (const c of stock) c.where = "stock";
    sound.play("move", { pitch: 0.8 });
    say(`Waste flipped back. ${redealsLeft} flip${redealsLeft === 1 ? "" : "s"} left.`);
  } else {
    sound.play("click");
    return;
  }
  render();
  checkStuck();
}

function checkStuck() {
  if (hasMove() || busy) return;
  const left = pyramid.flat().filter(Boolean).length;
  setTimeout(() => shell.over({ message: `No moves left, ${left} card${left === 1 ? "" : "s"} to go.` }), 500);
}

// ---- Drawing ---------------------------------------------------------------------------------------
function render() {
  const avail = new Set(available());
  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i <= r; i++) {
      const card = pyramid[r][i];
      if (card) setState(card, avail.has(card));
    }
  }
  // stock cards hide under the stock button; only the top two waste cards show
  for (const card of stock) card.el.hidden = true;
  waste.forEach((card, k) => {
    const fromTop = waste.length - 1 - k;
    card.el.hidden = fromTop > 1;
    place(card, BOARD_W / 2 + 0.15 + (fromTop === 0 ? 0.12 : 0), PILE_Y, 20 + k);
    setState(card, fromTop === 0);
  });

  stockEl.classList.toggle("is-empty", !stock.length);
  stockEl.innerHTML = stock.length
    ? `<span class="cp-count">${stock.length}</span>`
    : redealsLeft > 0 && waste.length ? `<span class="cp-flip">↻<small>${redealsLeft} left</small></span>` : `<span class="cp-flip">✕</span>`;
  stockEl.setAttribute("aria-label", stock.length ? `Stock, ${stock.length} cards. Turn over a card` : redealsLeft > 0 && waste.length ? `Flip the waste back over, ${redealsLeft} left` : "Stock is empty");
}

function setState(card, free) {
  const el = card.el;
  el.hidden = false;
  el.classList.toggle("is-free", free);
  el.classList.toggle("is-selected", card === selected);
  el.setAttribute("aria-label", `${cardName(card)}${free ? "" : ", covered"}${card === selected ? ", selected" : ""}`);
  el.setAttribute("aria-pressed", String(card === selected));
  el.tabIndex = free ? 0 : -1;
}

function say(text) { liveEl.textContent = text; }

// card width follows the board's width
new ResizeObserver(([entry]) => {
  const w = entry.contentRect.width;
  boardEl.style.setProperty("--cw", `${Math.min(86, w / BOARD_W)}px`);
}).observe(boardEl.parentElement);

// ---- Keyboard: Tab to a card and press Enter; D turns over a stock card -----------------------
window.addEventListener("keydown", (e) => {
  if (!shell.isPlaying() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "KeyD") { e.preventDefault(); drawCard(); }
});

// ---- Shell ------------------------------------------------------------------------------------------
const shell = createShell({
  id: "card-pyramid",
  title: "Card Pyramid",
  hint: "Remove pairs that add up to 13. Kings go on their own. Clear the pyramid!",
  onStart() {
    round = 1;
    busy = false;
    boardEl.classList.remove("is-won");
    deal();
    shell.stat("round", "Pyramid", round);
    checkStuck();
  },
  // paused right as a pyramid was cleared? deal the next one now
  onResume() { if (!busy && pyramidCleared()) { deal(); shell.stat("round", "Pyramid", round); } },
});

// A pyramid behind the start screen
deal();
