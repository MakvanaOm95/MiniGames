// ============================================================================
// storage.js — save small things (high scores, settings) in the browser
// ----------------------------------------------------------------------------
// Uses localStorage, so data stays on the player's own device only.
// Every key is prefixed with "tinytock:" so nothing clashes with other sites.
// All calls are wrapped in try/catch: private browsing or blocked storage
// must never break a game — it just won't remember anything.
// ============================================================================

const PREFIX = "tinytock:";

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — ignore */
  }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** The player's best score for a game (or null if they haven't played). */
export function getBest(gameId) {
  return load(`best:${gameId}`, null);
}

/**
 * Record a score. Returns true if it's a new personal best.
 * Set lowerIsBetter for games scored by time or moves (e.g. puzzles).
 */
export function submitScore(gameId, score, { lowerIsBetter = false } = {}) {
  const best = getBest(gameId);
  const isBest = best === null || (lowerIsBetter ? score < best : score > best);
  if (isBest) save(`best:${gameId}`, score);
  save(`plays:${gameId}`, load(`plays:${gameId}`, 0) + 1);
  return isBest;
}
