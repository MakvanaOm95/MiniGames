# Tiny Tock

Free, original browser games sized for short breaks. Live at **https://tinytock.com**.

Plain HTML, CSS and JavaScript. No framework, no build step, no server. Hosted on Cloudflare Pages and deployed automatically when you push to GitHub.

- **New here?** Follow [SETUP_GUIDE.md](SETUP_GUIDE.md) from top to bottom.
- **Need a command?** See [COMMANDS.md](COMMANDS.md).

---

## Project structure

```
/
├── public/                  ← THE WEBSITE. Only this folder is published.
│   ├── index.html           homepage (clock dial + today's pick + top 5)
│   ├── about.html, contact.html, privacy.html, 404.html
│   ├── robots.txt, sitemap.xml, ads.txt, favicon.svg, site.webmanifest
│   ├── _headers             Cloudflare caching + security headers
│   ├── assets/
│   │   ├── css/
│   │   │   ├── tokens.css       colors, fonts, spacing: the design system
│   │   │   ├── base.css         page basics and typography
│   │   │   ├── components.css   header, footer, buttons, tiles, ad slots
│   │   │   ├── home.css         homepage only
│   │   │   └── game-shell.css   shared game page + game box styles
│   │   ├── js/
│   │   │   ├── site.js          dark mode, menu, ad switch (every page)
│   │   │   ├── home.js          homepage dial + filters
│   │   │   └── core/            shared game engine
│   │   │       ├── game-shell.js  start/pause/game-over screens, score, best
│   │   │       ├── sound.js       synthesized sound effects
│   │   │       ├── storage.js     saves best scores in the browser
│   │   │       └── input.js       keyboard, swipe and touch buttons
│   │   ├── images/          icons + social share image
│   │   └── fonts/           Bricolage Grotesque + DM Sans (self-hosted)
│   └── games/
│       ├── index.html       All games page
│       └── snake/
│           ├── index.html   game page: game + about + how to play + tips + play next
│           ├── game.js      only Snake's own rules and drawing
│           ├── style.css    only Snake's own styles
│           └── thumb.svg    tile picture
│
├── partials/                shared head, header and footer (edit these, then sync)
├── templates/game/          starting point for every new game
├── tools/
│   ├── serve.mjs            local test server
│   ├── sync.mjs             copies partials into pages, rebuilds shelf + sitemap
│   └── new-game.mjs         creates a new game from the template
├── site.config.mjs          site info + THE LIST OF GAMES
├── README.md, COMMANDS.md, SETUP_GUIDE.md
```

### Why it's organised this way

- **`public/` is the only published folder.** Your notes, tools and templates never end up on the internet.
- **One shared game shell.** Every game gets the same score bar, start screen, pause, game-over screen, sounds and saved best score. A game's own `game.js` only contains its rules, so games stay consistent and are quick to build.
- **One list of games** (`site.config.mjs`). The homepage shelf, the All games page (`/games/`), the "Play next" sections, the category filters and `sitemap.xml` are all generated from it.
- **Homepage = Today's pick + Top 5.** *Today's pick* rotates through every game automatically, one per day (worked out in the visitor's browser, so it changes even when you don't update the site). The *Top 5* are the games listed in `TOP_GAMES` in `site.config.mjs`. Turning the clock or choosing a category on the homepage searches **all** games.
- **Header and footer are written once** (`partials/`). `node tools/sync.mjs` copies them into every page as real HTML. That's best for Google, with no flicker, and Cloudflare still needs no build step.
- **Clean URLs.** `/games/snake/` works because each game is a folder, and Cloudflare serves `about.html` at `/about`.

## Everyday workflow

```bash
node tools/serve.mjs          # 1. run the site locally → http://localhost:8080
# 2. make your changes
node tools/sync.mjs           # 3. only if you changed partials/ or site.config.mjs
git add -A && git commit -m "Describe the change" && git push   # 4. goes live in ~1 min
```

## Adding a game

```bash
node tools/new-game.mjs block-drop "Block Drop" puzzle 3
```

Then fill in every `TODO` in `public/games/block-drop/` (game code, description, how to play, tips, thumbnail) and write the blurb in `site.config.mjs`. Every game page **must** have a real description, how-to-play and tips, because AdSense rejects "thin" pages.

## Design system

Theme **"Wind-Up Toy"**: warm paper, navy ink outlines, toy-bright accents, chunky "toy block" shadows.

| Token | Color | Used for |
|---|---|---|
| `--cream-100` | `#F6EFE3` | page background |
| `--ink-900` | `#1B2A41` | text, outlines |
| `--tomato` | `#E8553D` | brand, Arcade |
| `--mustard` | `#F2B33D` | highlights, Quick |
| `--teal` | `#2F8F83` | Puzzle |
| `--plum` | `#7A4E8C` | Word |
| `--sky` | `#6FA9D8` | Classic |

Fonts: **Bricolage Grotesque** (headings) and **DM Sans** (text). Both are SIL Open Font License, served from `public/assets/fonts/`.

Supported everywhere: light and dark mode, `prefers-reduced-motion`, keyboard play, touch controls, visible focus rings, and readable contrast.

## Ads

Ad spaces are already in the layout (`<aside class="ad-slot">`). They stay hidden until `ADS_LIVE = true` in `public/assets/js/site.js`. Add `?ads=preview` to any URL to see where they'll appear. See SETUP_GUIDE.md → *AdSense*.
