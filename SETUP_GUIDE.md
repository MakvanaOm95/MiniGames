# Setup guide: from zero to live site to AdSense

A beginner-friendly checklist. Do it in order, tick the boxes (`- [x]`) as you go, and do about one section a day.

**Progress so far:** domain bought ✅ · GitHub repo created ✅ · site built and pushed ✅ · next: **Part 4 (Cloudflare Pages)**

---

## Part 1: Tools on your Mac

- [x] **Git** installed (check: `git --version`)
- [x] **Node.js** installed (check: `node -v`). It runs the helper scripts in `tools/`.
- [ ] Optional: install **GitHub Desktop** (desktop.github.com) if you prefer clicking to typing Git commands

## Part 2: GitHub (stores your code)

- [x] Create a free account at **github.com** (use your own name/email)
- [x] Create a repository. Ours: `MakvanaOm95/MiniGames`
  - Public or Private both work with Cloudflare. Public is fine: there are no secrets in this project.
- [x] Connect the project folder to it (`git remote -v` shows the link)
- [x] First push of the code (`git push -u origin main`)
- [ ] Turn on **two-factor authentication**: GitHub → Settings → Password and authentication

## Part 3: Domain

- [x] Bought **tinytock.com** on **Cloudflare Registrar**
- [ ] Verified the contact email Cloudflare/ICANN sent you (check spam too). If you skip this, the domain can be suspended after ~15 days.
- [ ] Cloudflare → Domain Registration → Manage → **Auto-renew: ON**
- [ ] Cloudflare → Profile → **Two-factor authentication: ON**

## Part 4: Cloudflare Pages (puts the site online)

1. - [ ] Go to **dash.cloudflare.com** → left menu **Workers & Pages** → **Create application**.
2. - [ ] Choose the **Pages** option (look for a **Pages** tab, or a link like *"Looking to deploy Pages? Get started"*). Then **Import an existing Git repository**.
   - Don't pick "Workers". We want **Pages**.
3. - [ ] Click **Connect GitHub**, sign in, and allow access to the **MiniGames** repo (choosing "Only select repositories" is fine).
4. - [ ] Select the repo → **Begin setup**, and fill in:

   | Setting | Value |
   |---|---|
   | Project name | `tinytock` (gives you tinytock.pages.dev) |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | *(leave empty)* |
   | Build output directory | **`public`** |

5. - [ ] **Save and Deploy**, then wait ~1 minute.
6. - [ ] Open **https://tinytock.pages.dev** (or whatever address Cloudflare shows) and test:
   - [ ] Homepage loads; the clock dial filters games
   - [ ] Snake plays on your computer (arrow keys) and phone (swipe + buttons)
   - [ ] About, Contact and Privacy pages open; a made-up URL shows the 404 page
   - [ ] Dark mode button works

From now on, **every `git push` to `main` publishes automatically.**

## Part 5: Connect tinytock.com

1. - [ ] Workers & Pages → **tinytock** → **Custom domains** → **Set up a custom domain** → type `tinytock.com` → Continue → **Activate domain**.
   - Your domain is already on Cloudflare, so the DNS record is created for you.
2. - [ ] Do the same for **`www.tinytock.com`**.
3. - [ ] Make `www` redirect to the main address: Cloudflare → click **tinytock.com** (the domain) → **Rules** → **Redirect Rules** → **Create rule** → use the template **"Redirect from WWW to root"** → Deploy.
4. - [ ] Wait until both domains say **Active** (usually 5–30 minutes, occasionally up to 24 hours).
5. - [ ] Test **https://tinytock.com**: the padlock 🔒 appears in the address bar, so HTTPS works.
6. - [ ] Test that **http://tinytock.com** and **https://www.tinytock.com** both end up at `https://tinytock.com`.
7. - [ ] Domain → **SSL/TLS** → **Edge Certificates** → **Always Use HTTPS: ON**.

## Part 6: Free email hello@tinytock.com

The Contact and Privacy pages use **hello@tinytock.com**, so make it work:

- [ ] Cloudflare → tinytock.com → **Email** → **Email Routing** → **Get started**
- [ ] Create address `hello` → forward to your personal Gmail → confirm the email Cloudflare sends
- [ ] Let Cloudflare add the DNS records it suggests
- [ ] Send a test email to hello@tinytock.com from another account and check it arrives

## Part 7: Google Search Console (get found on Google)

- [ ] Go to **search.google.com/search-console** → Add property → **Domain** → `tinytock.com`
- [ ] Verify: Google shows a TXT record. Because your DNS is on Cloudflare, Google usually offers **"Verify with Cloudflare"** (one click). Otherwise add the TXT record in Cloudflare → DNS → Records.
- [ ] Left menu **Sitemaps** → enter `sitemap.xml` → **Submit**
- [ ] **URL inspection** → paste `https://tinytock.com/` → **Request indexing** (repeat for new games)
- [ ] Check back weekly: *Pages* shows what's indexed; *Performance* shows searches

## Part 8: Analytics (see how many people visit)

**Easiest: Cloudflare Web Analytics** (free, no cookies, no code):
- [ ] Workers & Pages → tinytock → **Metrics** → **Web Analytics** → **Enable**

**Optional: Google Analytics 4** (more detail; uses cookies, already covered in the privacy policy):
- [ ] analytics.google.com → create a property for tinytock.com → **Web** stream → copy the `<script>` "Google tag"
- [ ] Paste it in `partials/head.html` below the line `ANALYTICS + ADSENSE`
- [ ] Run `node tools/sync.mjs` then commit and push

## Part 9: Before applying for AdSense

AdSense reviews the whole site. Aim to tick **everything**:

- [ ] **15–20 finished games**, each with a real description, how-to-play and tips (no TODOs left: search the project for `TODO`)
- [ ] No empty, "coming soon" or broken pages (test every link)
- [ ] About, Contact and Privacy pages live; the privacy policy mentions cookies and Google ads ✅ (already written)
- [ ] Site works on HTTPS on **tinytock.com** (not only pages.dev)
- [ ] Mobile-friendly and fast. Test at **pagespeed.web.dev** (aim for 90+)
- [ ] Indexed in Google (Search Console → Pages shows your pages)
- [ ] Some real visitors from search or sharing. There's no official minimum, but a few weeks of steady traffic helps. In India, sites around **6 months old** are often approved more easily.
- [ ] You are **18+** and will apply with **your own** Google account
- [ ] `hello@tinytock.com` works

## Part 10: Apply for AdSense

1. - [ ] Go to **adsense.google.com** → Get started → enter `tinytock.com` → your details (country: India, payment currency INR)
2. - [ ] AdSense gives you a code like:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
   Paste it in `partials/head.html` below the `ANALYTICS + ADSENSE` line → `node tools/sync.mjs` → commit and push.
3. - [ ] AdSense also shows an **ads.txt** line. Put it in `public/ads.txt` (replace the comment lines) → commit and push → check `https://tinytock.com/ads.txt`.
4. - [ ] Back in AdSense, tick "I've placed the code" → **Request review**.
5. - [ ] **Privacy & messaging** → create a **European regulations (GDPR) message** (Google's free consent banner). It's required for visitors from Europe/UK.
6. - [ ] Wait. Reviews take from a few days to 2–4 weeks. Keep adding games meanwhile.

**If rejected:** read the reason, fix it (usually "low value content" means you need more or better game text, or more traffic), wait ~2 weeks, and re-apply.

## Part 11: After approval, switch the ads on

1. - [ ] In `public/assets/js/site.js` change `const ADS_LIVE = false;` to **`true`**. This makes the reserved ad spaces visible.
2. - [ ] Choose one:
   - **Auto ads** (easiest): AdSense → Ads → turn on Auto ads for tinytock.com. Google places ads for you.
   - **Manual ad units** (more control): AdSense → Ads → By ad unit → Display ad → copy the `<ins class="adsbygoogle">…</ins><script>…</script>` code and paste it **inside** an `<aside class="ad-slot" …></aside>` on a page. Each slot has a name (`home-top`, `game-sidebar`, `game-bottom`…) so you know where it sits.
3. - [ ] Commit and push, then check on phone and desktop that ads never cover the game.
4. - [ ] AdSense → Payments: add bank details. Google pays once you pass the payment threshold, after PIN verification by post.

## Part 12: Updating the site later

1. `node tools/serve.mjs` → make changes → check at http://localhost:8080
2. If you changed `partials/` or `site.config.mjs`: `node tools/sync.mjs`
3. `git add -A && git commit -m "What you changed" && git push`
4. Live in about a minute. Hard-refresh (`Cmd + Shift + R`) to see it.

**New game each time:** `node tools/new-game.mjs <slug> "<Title>" <category> <minutes>` → fill every `TODO` → test on phone + desktop → push → Search Console → URL inspection → Request indexing.
