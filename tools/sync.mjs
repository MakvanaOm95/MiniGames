// ============================================================================
// tools/sync.mjs — keeps every page up to date
// ----------------------------------------------------------------------------
// Run it after changing site.config.mjs or anything in partials/:
//
//     node tools/sync.mjs
//
// What it does, for every .html file inside public/:
//   1. Copies partials/head.html, header.html, footer.html into the matching
//      <!-- @head --> … <!-- /@head --> (etc.) markers.
//   2. Rebuilds the homepage game shelf  (<!-- @game-grid --> markers)
//      and the All games page            (<!-- @game-grid-all --> markers).
//   3. Rebuilds each game's "Play next"  (<!-- @play-next --> markers).
//   4. Sets each game page's category tag + schema genre from the config.
//   5. Fills in the number of games      (<!-- @game-count --> markers)
//      and the category filter buttons   (<!-- @category-chips --> markers).
// Then it regenerates public/sitemap.xml.
//
// The website itself never runs this — it only changes files on your computer.
// ============================================================================

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, CATEGORIES, GAMES, TOP_GAMES } from "../site.config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const PARTIALS = join(ROOT, "partials");

// ---- Small helpers --------------------------------------------------------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Recursively list all files under a folder. */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Replace the content between <!-- @name --> and <!-- /@name --> markers. */
function fillBlock(html, name, content) {
  const re = new RegExp(`(<!-- @${name} -->)[\\s\\S]*?(<!-- /@${name} -->)`, "g");
  return html.replace(re, (_, open, close) => `${open}\n${content.trim()}\n${close}`);
}

const minutesLabel = (m) => (m >= 5 ? "5+ min" : `${m} min`);
const isNew = (g) => g.added && Date.now() - new Date(g.added).getTime() < 14 * 864e5;

const CLOCK_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

/** HTML for one game tile. */
function tile(game, { feature = false, extra = false, heading = "h3" } = {}) {
  const cat = CATEGORIES[game.category] ?? { label: game.category };
  const badge = feature ? "Today’s pick" : isNew(game) ? "New" : "";
  const rank = TOP_GAMES.indexOf(game.slug);
  return `
<li class="tile${feature ? " tile--feature" : ""}" data-slug="${game.slug}" data-order="${GAMES.indexOf(game)}" data-category="${game.category}" data-minutes="${game.minutes}"${rank >= 0 ? ` data-rank="${rank}"` : ""}${isNew(game) ? ` data-badge="New"` : ""}${extra ? " data-extra" : ""}>
  <a class="tile__link" href="/games/${game.slug}/">
    <div class="tile__art"><img src="/games/${game.slug}/thumb.svg" alt="" width="320" height="240" loading="lazy" decoding="async"></div>
    <div class="tile__body">
      ${badge ? `<span class="tile__badge">${badge}</span>` : ""}
      <${heading} class="tile__title">${escapeHtml(game.title)}</${heading}>
      <p class="tile__blurb">${escapeHtml(game.blurb)}</p>
      <div class="tile__meta">
        <span class="tag">${escapeHtml(cat.label)}</span>
        <span class="time">${CLOCK_ICON}<span><span class="visually-hidden">About </span>${minutesLabel(game.minutes)}</span></span>
      </div>
    </div>
  </a>
</li>`.trim();
}

/** Pick up to 3 other games to suggest after `slug`: next in list first, then same category. */
function playNextFor(slug) {
  const i = GAMES.findIndex((g) => g.slug === slug);
  const others = GAMES.filter((g) => g.slug !== slug);
  if (i === -1 || others.length === 0) return [];
  const me = GAMES[i];
  const rotated = [...GAMES.slice(i + 1), ...GAMES.slice(0, i)];
  const sameCat = rotated.filter((g) => g.category === me.category);
  const rest = rotated.filter((g) => g.category !== me.category);
  // one from the same category (if any), then fill with the rest in order
  return [...sameCat.slice(0, 1), ...rest, ...sameCat.slice(1)].slice(0, 3);
}

/** Map a file path inside public/ to its public URL. */
function urlFor(file) {
  let path = relative(PUBLIC, file).split(sep).join("/");
  if (path === "index.html") return "/";
  if (path.endsWith("/index.html")) return "/" + path.slice(0, -"index.html".length);
  return "/" + path.replace(/\.html$/, "");
}

// ---- Main -----------------------------------------------------------------

const partial = async (name) => readFile(join(PARTIALS, `${name}.html`), "utf8");
const [head, header, footer] = await Promise.all(["head", "header", "footer"].map(partial));

// Sanity checks on the game list so mistakes are caught early
for (const g of GAMES) {
  if (!CATEGORIES[g.category]) console.warn(`⚠  ${g.slug}: unknown category "${g.category}"`);
  if (![1, 3, 5].includes(g.minutes)) console.warn(`⚠  ${g.slug}: minutes should be 1, 3 or 5`);
  try { await stat(join(PUBLIC, "games", g.slug, "index.html")); }
  catch { console.warn(`⚠  ${g.slug}: public/games/${g.slug}/index.html does not exist`); }
}

// Today's pick: one game per day, cycling through GAMES in order.
// The homepage (home.js) uses the SAME formula, so the pick updates daily
// in the browser even though this file only runs when you sync.
const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const pick = GAMES[dayNumber() % GAMES.length];
const top = TOP_GAMES.map((slug) => GAMES.find((g) => g.slug === slug)).filter((g) => g && g !== pick).slice(0, 5);
const rest = GAMES.filter((g) => g !== pick && !top.includes(g));
for (const slug of TOP_GAMES) if (!GAMES.some((g) => g.slug === slug)) console.warn(`⚠  TOP_GAMES has "${slug}", which isn't in GAMES`);

// Homepage: pick (big) → top 5 → everything else (hidden until you filter)
const gridHtml = [
  tile(pick, { feature: true }),
  ...top.map((g) => tile(g)),
  ...rest.map((g) => tile(g, { extra: true })),
].join("\n");
// All games page: every game, in list order
const gridAllHtml = GAMES.map((g) => tile(g)).join("\n");
const countText = `${GAMES.length} ${GAMES.length === 1 ? "game" : "games"}`;

// Category filter buttons: "All" + only the categories that have games
const usedCats = Object.keys(CATEGORIES).filter((c) => GAMES.some((g) => g.category === c));
const chipsHtml = [
  `<li><button class="chip" type="button" aria-pressed="true" data-category="all">All</button></li>`,
  ...usedCats.map((c) => `<li><button class="chip" type="button" aria-pressed="false" data-category="${c}">${CATEGORIES[c].label}</button></li>`),
].join("\n");

const htmlFiles = (await walk(PUBLIC)).filter((f) => f.endsWith(".html"));
let changed = 0;

for (const file of htmlFiles) {
  const before = await readFile(file, "utf8");
  let html = before;
  html = fillBlock(html, "head", head);
  html = fillBlock(html, "header", header);
  html = fillBlock(html, "footer", footer);
  html = fillBlock(html, "game-grid", gridHtml);
  html = fillBlock(html, "game-grid-all", gridAllHtml);
  html = fillBlock(html, "game-count", countText);
  html = fillBlock(html, "category-chips", chipsHtml);

  const m = relative(PUBLIC, file).split(sep).join("/").match(/^games\/([^/]+)\/index\.html$/);
  if (m) {
    const next = playNextFor(m[1]).map((g) => tile(g)).join("\n");
    html = fillBlock(html, "play-next", next);
    // Keep the game page's own category tag and schema genre in step with the config
    const game = GAMES.find((g) => g.slug === m[1]);
    const cat = game && CATEGORIES[game.category];
    if (cat) {
      html = html.replace(/<span class="tag" style="--tag-color: var\(--cat-[\w-]+\)">[^<]*<\/span>/,
        `<span class="tag" style="--tag-color: ${cat.color}">${escapeHtml(cat.label)}</span>`);
      html = html.replace(/"genre":\["[^"]*"\]/, `"genre":["${cat.label}"]`);
    }
  }

  if (html !== before) {
    await writeFile(file, html);
    changed++;
    console.log(`✓ updated ${relative(ROOT, file)}`);
  }
}

// ---- sitemap.xml ----------------------------------------------------------
const pages = [];
for (const file of htmlFiles) {
  if (file.endsWith(`${sep}404.html`)) continue;
  const html = await readFile(file, "utf8");
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
  const { mtime } = await stat(file);
  pages.push({ url: SITE.url + urlFor(file), lastmod: mtime.toISOString().slice(0, 10) });
}
pages.sort((a, b) => a.url.length - b.url.length || a.url.localeCompare(b.url));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by tools/sync.mjs — do not edit by hand -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${p.url}</loc><lastmod>${p.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;
await writeFile(join(PUBLIC, "sitemap.xml"), sitemap);

console.log(`\nDone: ${changed} page(s) updated, sitemap has ${pages.length} URL(s), ${countText} listed.`);
