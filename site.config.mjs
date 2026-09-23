// ============================================================================
// Tiny Tock — site settings and the master list of games
// ----------------------------------------------------------------------------
// This is the ONE place that knows about every game. After you edit it, run:
//
//     node tools/sync.mjs
//
// …and the homepage game shelf, every "Play next" section and sitemap.xml
// are rebuilt automatically.
// ============================================================================

export const SITE = {
  name: "Tiny Tock",
  url: "https://tinytock.com",           // no slash at the end
  tagline: "Free little games for the gaps in your day",
  email: "hello@tinytock.com",
};

// Game categories. The `color` is the CSS variable used for tiles and badges.
export const CATEGORIES = {
  arcade:  { label: "Arcade",  color: "var(--cat-arcade)" },
  puzzle:  { label: "Puzzle",  color: "var(--cat-puzzle)" },
  quick:   { label: "Quick",   color: "var(--cat-quick)" },
  word:    { label: "Word",    color: "var(--cat-word)" },
  classic: { label: "Classic", color: "var(--cat-classic)" },
};

// Every game on the site, in the order they appear on the homepage.
//
//   slug      folder name inside public/games/ (also the URL: /games/<slug>/)
//   title     the game's name
//   blurb     one short, punchy line shown on the tile
//   category  one of the keys in CATEGORIES above
//   minutes   how long one round usually takes: 1, 3 or 5 (5 means "5 or more")
//   featured  true = shown as the big tile at the top of the homepage
//   added     date the game went live (YYYY-MM-DD), used for "New" badges
export const GAMES = [
  {
    slug: "snake",
    title: "Snake",
    blurb: "Eat, grow, and don't bite your own tail.",
    category: "arcade",
    minutes: 3,
    featured: true,
    added: "2026-09-23",
  },
  {
    slug: "2048",
    title: "2048",
    blurb: "Slide, merge, and chase the 2048 tile.",
    category: "puzzle",
    minutes: 5,
    added: "2026-09-23",
  },
  {
    slug: "wind-up-flyer",
    title: "Wind-Up Flyer",
    blurb: "Tap to flap through the toy-block towers.",
    category: "arcade",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "pair-up",
    title: "Pair Up",
    blurb: "Flip cards and find the pairs. Fast!",
    category: "quick",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "sudoku",
    title: "Sudoku",
    blurb: "Fill the grid. Every row, column and box gets 1–9.",
    category: "puzzle",
    minutes: 5,
    added: "2026-09-23",
  },
  {
    slug: "brick-breaker",
    title: "Brick Breaker",
    blurb: "Bounce the ball and smash every brick.",
    category: "arcade",
    minutes: 3,
    added: "2026-09-23",
  },
  {
    slug: "bop-a-mole",
    title: "Bop-a-Mole",
    blurb: "Moles pop up. You bop them. 40 seconds.",
    category: "quick",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "word-scramble",
    title: "Word Scramble",
    blurb: "Unscramble as many words as you can in a minute.",
    category: "word",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "minesweeper",
    title: "Minesweeper",
    blurb: "Clear the field without touching a mine.",
    category: "puzzle",
    minutes: 5,
    added: "2026-09-23",
  },
  {
    slug: "four-in-a-row",
    title: "Four in a Row",
    blurb: "Drop discs and line up four before the computer does.",
    category: "classic",
    minutes: 3,
    added: "2026-09-23",
  },
  // ⬆ new games are added above this line (tools/new-game.mjs does it for you)
];
