// ============================================================================
// input.js — keyboard, swipe and on-screen button controls in one place
// ----------------------------------------------------------------------------
// Every game uses the same simple words for input:
//     "up" "down" "left" "right"  — arrows, WASD, swipes, D-pad buttons
//     "action"                     — Space / Enter / tap
//     "pause"                      — P / Escape
// so controls feel the same across the whole site.
// ============================================================================

const KEYMAP = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "action", Enter: "action",
  KeyP: "pause", Escape: "pause",
};

/**
 * Listen for game keys.
 *   onKeys((name, event) => { … }, { active: (name) => game.isRunning })
 * `active(name)` decides whether this key is used right now. Keys that aren't
 * used are left alone, so arrows/space still scroll the page normally.
 * Returns a function that removes the listener.
 */
export function onKeys(handler, { active = () => true } = {}) {
  function listener(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const name = KEYMAP[e.code];
    if (!name || !active(name)) return;
    // Let Space/Enter work normally on focused buttons and links
    if (name === "action" && /^(BUTTON|A)$/.test(t.tagName)) return;
    e.preventDefault();
    handler(name, e);
  }
  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}

/**
 * Detect swipes on an element (works with finger, pen or mouse drag).
 *   onSwipe(canvas, (dir) => { … }, { onTap: () => { … } })
 * Swipes fire as soon as the finger has moved far enough, and you can keep
 * sliding to change direction again without lifting — feels snappy.
 */
export function onSwipe(el, handler, { threshold = 22, onTap = null } = {}) {
  let start = null;
  let swiped = false;

  el.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY };
    swiped = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    handler(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    start = { x: e.clientX, y: e.clientY }; // measure the next swipe from here
    swiped = true;
  });
  const end = () => {
    if (start && !swiped && onTap) onTap();
    start = null;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => { start = null; });
}

/**
 * Wire up on-screen buttons that have a data-input attribute, e.g.
 *   <button data-input="left">…</button>
 * Fires on press-down (not release) so it responds instantly.
 */
export function bindButtons(container, handler) {
  container.querySelectorAll("[data-input]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("is-pressed");
      handler(btn.dataset.input);
    });
    const release = () => btn.classList.remove("is-pressed");
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    // keyboard users: Enter/Space on the focused button
    btn.addEventListener("click", (e) => { if (e.detail === 0) handler(btn.dataset.input); });
  });
}

/** True on phones/tablets (touch is the main input). */
export const isTouch = () => window.matchMedia("(pointer: coarse)").matches;
