// ============================================================================
// {{TITLE}} — Tiny Tock
// ----------------------------------------------------------------------------
// TODO: describe the game in one or two lines.
//
// This starter is a tiny working demo ("tap the target as often as you can in
// 10 seconds") so you can see how a game plugs into the shared shell.
// Replace the demo code with your game's own rules.
// ============================================================================

import { createShell } from "/assets/js/core/game-shell.js";
import { onKeys } from "/assets/js/core/input.js";
import * as sound from "/assets/js/core/sound.js";

const ROUND_SECONDS = 10;

const target = document.querySelector("[data-target]");
let timeLeft = ROUND_SECONDS;
let timer = 0;

function tick() {
  timeLeft -= 1;
  target.textContent = timeLeft > 0 ? `Tap! (${timeLeft}s)` : "Time!";
  if (timeLeft <= 0) {
    clearInterval(timer);
    shell.over({ message: "Time’s up!" });
  }
}

target.addEventListener("pointerdown", () => {
  if (!shell.isPlaying()) return;
  shell.addScore(1);
  sound.play("pop", { pitch: 1 + shell.score * 0.02 });
});

// Keyboard: Space also counts as a tap while playing
onKeys(() => target.dispatchEvent(new Event("pointerdown")), {
  active: (name) => name === "action" && shell.isPlaying(),
});

const shell = createShell({
  id: "{{SLUG}}",                 // used to save the best score — keep it unique
  title: "{{TITLE}}",
  hint: "TODO: one short sentence explaining how to play.",
  onStart() {
    clearInterval(timer);
    timeLeft = ROUND_SECONDS;
    target.textContent = `Tap! (${timeLeft}s)`;
    timer = setInterval(tick, 1000);
  },
  onPause() { clearInterval(timer); },
  onResume() { timer = setInterval(tick, 1000); },
});
