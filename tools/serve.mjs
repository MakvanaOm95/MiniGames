// ============================================================================
// tools/serve.mjs — run the website on your own computer for testing
// ----------------------------------------------------------------------------
//     node tools/serve.mjs          → open http://localhost:8080
//     node tools/serve.mjs 3000     → use a different port
//
// It behaves like Cloudflare Pages: /about serves about.html,
// /games/snake/ serves games/snake/index.html, unknown pages show 404.html.
// Your phone can open it too (same Wi-Fi): the address is printed at start.
// Stop it with Ctrl + C.
// ============================================================================

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

/** Find the file for a URL path, trying the same fallbacks Cloudflare uses. */
async function resolve(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const base = join(PUBLIC, safe);
  if (!base.startsWith(PUBLIC)) return null;
  for (const candidate of [base, base + ".html", join(base, "index.html")]) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

createServer(async (req, res) => {
  const urlPath = new URL(req.url, "http://x").pathname;
  let file = await resolve(urlPath);
  let status = 200;
  if (!file) { file = join(PUBLIC, "404.html"); status = 404; }
  try {
    const body = await readFile(file);
    res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(500).end("Server error");
  }
  console.log(`${status}  ${urlPath}`);
}).listen(PORT, () => {
  const lan = Object.values(networkInterfaces()).flat().find((n) => n?.family === "IPv4" && !n.internal)?.address;
  console.log(`\n  Tiny Tock is running!\n`);
  console.log(`  On this computer:  http://localhost:${PORT}`);
  if (lan) console.log(`  On your phone:     http://${lan}:${PORT}   (same Wi-Fi)`);
  console.log(`\n  Press Ctrl + C to stop.\n`);
});
