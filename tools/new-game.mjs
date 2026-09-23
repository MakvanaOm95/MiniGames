// ============================================================================
// tools/new-game.mjs — start a new game from the template
// ----------------------------------------------------------------------------
//   node tools/new-game.mjs <slug> "<Title>" <category> <minutes>
//
// Example:
//   node tools/new-game.mjs 2048 "2048" puzzle 5
//
//   slug      lowercase letters, numbers and dashes (becomes /games/<slug>/)
//   category  arcade | puzzle | quick | word | classic
//   minutes   1, 3 or 5
//
// It will:
//   1. copy templates/game/ to public/games/<slug>/ and fill in the name
//   2. add the game to the list in site.config.mjs
//   3. run tools/sync.mjs so the homepage and sitemap include it
// Then open public/games/<slug>/ and replace every "TODO".
// ============================================================================

import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { CATEGORIES } from "../site.config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [slug, title, category, minutesArg] = process.argv.slice(2);
const minutes = Number(minutesArg);

function fail(msg) {
  console.error(`\n✗ ${msg}\n\nUsage: node tools/new-game.mjs <slug> "<Title>" <category> <minutes>`);
  console.error(`Example: node tools/new-game.mjs 2048 "2048" puzzle 5\n`);
  process.exit(1);
}

if (!slug || !title || !category || !minutesArg) fail("Missing information.");
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail(`"${slug}" isn't a valid slug. Use lowercase letters, numbers and dashes, like "block-drop".`);
if (!CATEGORIES[category]) fail(`Unknown category "${category}". Choose one of: ${Object.keys(CATEGORIES).join(", ")}.`);
if (![1, 3, 5].includes(minutes)) fail("Minutes must be 1, 3 or 5.");

const dest = join(ROOT, "public", "games", slug);
try {
  await access(dest);
  fail(`public/games/${slug}/ already exists.`);
} catch { /* good: it doesn't exist yet */ }

// 1. Copy the template, filling in placeholders
const values = {
  SLUG: slug,
  TITLE: title,
  CATEGORY: category,
  CATEGORY_LABEL: CATEGORIES[category].label,
  MINUTES_LABEL: minutes >= 5 ? "5+ min" : `${minutes} min`,
};
const fill = (text) => text.replace(/\{\{(\w+)\}\}/g, (m, key) => values[key] ?? m);

await mkdir(dest, { recursive: true });
const templateDir = join(ROOT, "templates", "game");
for (const file of await readdir(templateDir)) {
  const text = await readFile(join(templateDir, file), "utf8");
  await writeFile(join(dest, file), fill(text));
  console.log(`✓ created public/games/${slug}/${file}`);
}

// 2. Add it to site.config.mjs (just above the marker line)
const configPath = join(ROOT, "site.config.mjs");
const config = await readFile(configPath, "utf8");
const marker = "  // ⬆ new games are added above this line";
if (!config.includes(marker)) fail("Couldn't find the marker line in site.config.mjs. Add the game there by hand.");
const today = new Date().toISOString().slice(0, 10);
const entry = `  {
    slug: ${JSON.stringify(slug)},
    title: ${JSON.stringify(title)},
    blurb: "TODO: one short, punchy line.",
    category: ${JSON.stringify(category)},
    minutes: ${minutes},
    added: "${today}",
  },
`;
await writeFile(configPath, config.replace(marker, entry + marker));
console.log("✓ added to site.config.mjs");

// 3. Rebuild the homepage, Play next sections and sitemap
execFileSync(process.execPath, [join(ROOT, "tools", "sync.mjs")], { stdio: "inherit" });

console.log(`
Next steps:
  1. Open public/games/${slug}/ and replace every TODO (search for "TODO").
  2. Write the blurb for "${title}" in site.config.mjs.
  3. Draw the thumbnail: public/games/${slug}/thumb.svg
  4. Test it: node tools/serve.mjs  →  http://localhost:8080/games/${slug}/
`);
