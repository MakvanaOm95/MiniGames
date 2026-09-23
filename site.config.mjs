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
  // ⬆ new games are added above this line (tools/new-game.mjs does it for you)
];
