// ============================================================================
// site.js — small things every page needs
//   • light / dark mode toggle (remembered)
//   • highlights the current page in the menu
//   • switches ad slots on (after AdSense approval) or into preview mode
// ============================================================================

import { load, save } from "./core/storage.js";

// ---------------------------------------------------------------------------
// ADS: keep this `false` until Google AdSense approves the site.
// Then set it to `true` (see SETUP_GUIDE.md, section "After approval").
// Tip: add ?ads=preview to any URL to see where the ad slots will appear.
// ---------------------------------------------------------------------------
const ADS_LIVE = false;

const root = document.documentElement;

if (ADS_LIVE) root.classList.add("ads-live");
if (new URLSearchParams(location.search).get("ads") === "preview") root.classList.add("ads-preview");

// ---- Dark mode toggle -------------------------------------------------------
function currentTheme() {
  return root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

document.querySelectorAll(".theme-toggle").forEach((btn) => {
  const label = () => btn.setAttribute("aria-label", currentTheme() === "dark" ? "Switch to light mode" : "Switch to dark mode");
  label();
  btn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    save("theme", next);
    label();
  });
});

// Keep a saved theme in sync (e.g. changed in another tab)
const saved = load("theme");
if (saved) root.dataset.theme = saved;

// ---- Mark the current page in the main menu ---------------------------------
const here = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
document.querySelectorAll(".site-nav a").forEach((a) => {
  const target = new URL(a.href).pathname.replace(/\/$/, "") || "/";
  if (target === here && !a.hash) a.setAttribute("aria-current", "page");
});

// ---- Footer year ---------------------------------------------------------------
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
