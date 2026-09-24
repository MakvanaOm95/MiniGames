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
  puzzle:           { label: "Puzzle",         color: "var(--cat-puzzle)" },
  arcade:           { label: "Arcade",         color: "var(--cat-arcade)" },
  classic:          { label: "Classic",        color: "var(--cat-classic)" },
  brain:            { label: "Brain",          color: "var(--cat-brain)" },
  "endless-runner": { label: "Endless Runner", color: "var(--cat-endless-runner)" },
  casual:           { label: "Casual",         color: "var(--cat-casual)" },
  strategy:         { label: "Strategy",       color: "var(--cat-strategy)" },
  card:             { label: "Card",           color: "var(--cat-card)" },
};

// The homepage "Top games" row: your 5 best games, in order.
// List a few extra: if one of them is Today's pick, the next one fills in.
// (Tip: once you have analytics, put your most-played games here.)
export const TOP_GAMES = ["2048", "snake", "sudoku", "wind-up-flyer", "minesweeper", "four-in-a-row", "pair-up"];

// Every game on the site. This order is used on the All games page, and
// "Today's pick" on the homepage cycles through it, one game per day.
//
//   slug      folder name inside public/games/ (also the URL: /games/<slug>/)
//   title     the game's name
//   blurb     one short, punchy line shown on the tile
//   category  one of the keys in CATEGORIES above
//   minutes   how long one round usually takes: 1, 3 or 5 (5 means "5 or more")
//   added     date the game went live (YYYY-MM-DD), used for "New" badges
export const GAMES = [
  {
    slug: "snake",
    title: "Snake",
    blurb: "Eat, grow, and don't bite your own tail.",
    category: "arcade",
    minutes: 3,
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
    category: "endless-runner",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "pair-up",
    title: "Pair Up",
    blurb: "Flip cards and find the pairs. Fast!",
    category: "brain",
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
    category: "casual",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "word-scramble",
    title: "Word Scramble",
    blurb: "Unscramble as many words as you can in a minute.",
    category: "brain",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "minesweeper",
    title: "Minesweeper",
    blurb: "Clear the field without touching a mine.",
    category: "classic",
    minutes: 5,
    added: "2026-09-23",
  },
  {
    slug: "four-in-a-row",
    title: "Four in a Row",
    blurb: "Drop discs and line up four before the computer does.",
    category: "strategy",
    minutes: 3,
    added: "2026-09-23",
  },
  {
    slug: "block-drop",
    title: "Block Drop",
    blurb: "Stack falling blocks and clear lines. Don’t let it reach the top!",
    category: "puzzle",
    minutes: 5,
    added: "2026-09-23",
  },
  {
    slug: "tock-tones",
    title: "Tock Tones",
    blurb: "Watch the lights, hear the notes, repeat the pattern.",
    category: "brain",
    minutes: 1,
    added: "2026-09-23",
  },
  {
    slug: "word-balloons",
    title: "Word Balloons",
    blurb: "Guess the word before all your balloons pop.",
    category: "brain",
    minutes: 3,
    added: "2026-09-23",
  },
  {
    slug: "solitaire",
    title: "Solitaire",
    blurb: "The classic card game. Build every suit from Ace to King.",
    category: "card",
    minutes: 5,
    added: "2026-09-23",
  },
  {
    slug: "dots-and-boxes",
    title: "Dots & Boxes",
    blurb: "Draw lines, close boxes, outsmart the computer.",
    category: "strategy",
    minutes: 3,
    added: "2026-09-23",
  },
  {
    slug: "ink-trick",
    title: "Ink Trick",
    blurb: "Tap the ink, not the word. Harder than it looks!",
    category: "brain",
    minutes: 1,
    added: "2026-09-24",
  },
  {
    slug: "quick-draw",
    title: "Quick Draw",
    blurb: "Wait for the ring, then tap. How fast are you?",
    category: "brain",
    minutes: 1,
    added: "2026-09-24",
  },
  {
    slug: "tower-tock",
    title: "Tower Tock",
    blurb: "Drop the blocks and build the tallest tower.",
    category: "casual",
    minutes: 1,
    added: "2026-09-24",
  },
  {
    slug: "wind-up-dash",
    title: "Wind-Up Dash",
    blurb: "Jump the toys and see how far the robot runs.",
    category: "endless-runner",
    minutes: 1,
    added: "2026-09-24",
  },
  {
    slug: "lane-hopper",
    title: "Lane Hopper",
    blurb: "Hop between three lanes and dodge the traffic.",
    category: "endless-runner",
    minutes: 1,
    added: "2026-09-24",
  },
  {
    slug: "pour-and-sort",
    title: "Pour & Sort",
    blurb: "Pour the colors until every tube matches.",
    category: "puzzle",
    minutes: 3,
    added: "2026-09-24",
  },
  {
    slug: "grid-fit",
    title: "Grid Fit",
    blurb: "Fit the blocks, clear rows and columns.",
    category: "puzzle",
    minutes: 5,
    added: "2026-09-24",
  },
  {
    slug: "card-pyramid",
    title: "Card Pyramid",
    blurb: "Pair cards that make 13 and clear the pyramid.",
    category: "card",
    minutes: 3,
    added: "2026-09-24",
  },
  {
    slug: "peg-jump",
    title: "Peg Jump",
    blurb: "Jump the pegs and leave just one standing.",
    category: "classic",
    minutes: 3,
    added: "2026-09-24",
  },
  {
    slug: "rock-popper",
    title: "Rock Popper",
    blurb: "Pop the space rocks before they bump you.",
    category: "arcade",
    minutes: 3,
    added: "2026-09-24",
  },
  // ⬆ new games are added above this line (tools/new-game.mjs does it for you)
];
