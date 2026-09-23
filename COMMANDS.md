# Commands

Every command you'll need, each with a one-line explanation.
Run them in the **Terminal**, from the project folder:

```bash
cd ~/Downloads/Projects/"Mini Games"
```

> Tip: in Claude Code you can type `! <command>` to run a command yourself.

---

## 1. Run the site on your computer

| Command | What it does |
|---|---|
| `node tools/serve.mjs` | Starts the site at **http://localhost:8080** (behaves like Cloudflare). |
| `node tools/serve.mjs 3000` | Same, but on a different port if 8080 is busy. |
| `Ctrl + C` | Stops the server. |

The server also prints an address like `http://192.168.x.x:8080` that you can open **on your phone** (on the same Wi-Fi) to test touch controls.

Useful test URLs:
- `http://localhost:8080/?ads=preview` shows where ads will appear.
- `http://localhost:8080/nothing-here` shows the 404 page.

## 2. Keep pages in sync

| Command | What it does |
|---|---|
| `node tools/sync.mjs` | Copies the shared head/header/footer into every page and rebuilds the homepage game shelf, "Play next" sections and `sitemap.xml`. Run it after editing anything in `partials/` or `site.config.mjs`. |

## 3. Add a new game

| Command | What it does |
|---|---|
| `node tools/new-game.mjs <slug> "<Title>" <category> <minutes>` | Creates `public/games/<slug>/` from the template, adds it to `site.config.mjs`, and runs sync. |
| `node tools/new-game.mjs 2048 "2048" puzzle 5` | Example: makes the 2048 game page. |

- **category:** `arcade`, `puzzle`, `quick`, `word` or `classic`
- **minutes:** `1`, `3` or `5` (how long one round usually takes)

After running it: search the new folder for `TODO` and replace each one.

## 4. Git basics (saving your work)

| Command | What it does |
|---|---|
| `git status` | Shows which files changed since your last save (commit). |
| `git diff` | Shows exactly what changed, line by line (press `q` to exit). |
| `git add -A` | Marks **all** changes to be saved. |
| `git add public/games/snake/` | Marks only one folder's changes to be saved. |
| `git commit -m "Add 2048 game"` | Saves the marked changes with a short message. |
| `git log --oneline -10` | Lists your last 10 saves. |
| `git push` | Uploads your saves to GitHub, and Cloudflare publishes them in ~1 minute. |
| `git pull` | Downloads changes from GitHub (if you edited on another computer). |

**The everyday combo:**
```bash
git add -A && git commit -m "Describe what you changed" && git push
```

### Undoing mistakes

| Command | What it does |
|---|---|
| `git restore <file>` | Throws away unsaved changes to one file (back to the last commit). ⚠️ Can't be undone. |
| `git restore .` | Throws away **all** unsaved changes. ⚠️ Can't be undone. |
| `git restore --staged <file>` | Un-marks a file you added with `git add` (keeps your changes). |
| `git commit --amend -m "Better message"` | Fixes the message of your last commit (only before you `git push`). |
| `git revert HEAD` | Makes a new commit that undoes the last commit. Safe even after pushing. Then `git push`. |
| `git revert <commit-id>` | Undoes an older commit (get the id from `git log --oneline`). |

> Avoid `git reset --hard` and `git push --force` unless you know exactly why: they can delete work permanently.

## 5. GitHub

| Command | What it does |
|---|---|
| `git remote -v` | Shows which GitHub repo this folder is connected to. |
| `git remote add origin https://github.com/<you>/<repo>.git` | Connects the folder to a GitHub repo (only once). |
| `git remote set-url origin https://github.com/<you>/<repo>.git` | Changes which repo it's connected to. |
| `git push -u origin main` | First push of the `main` branch (after that, just `git push`). |

When Git asks for a password, use a **Personal Access Token**, not your GitHub password (GitHub → Settings → Developer settings → Personal access tokens). Or install GitHub Desktop / the `gh` tool (`brew install gh` then `gh auth login`) to sign in once in the browser.

## 6. Deploy to Cloudflare

**Normal way (automatic):** `git push`. Cloudflare Pages sees the new commit and publishes it. Watch progress at dash.cloudflare.com → Workers & Pages → tinytock → Deployments.

**Backup way (Wrangler CLI)**, if GitHub is down or you need to publish right now:

| Command | What it does |
|---|---|
| `npx wrangler login` | Opens the browser to connect Wrangler to your Cloudflare account (once). |
| `npx wrangler pages deploy public --project-name=tinytock` | Uploads the `public/` folder straight to the Pages project. |
| `npx wrangler pages deployment list --project-name=tinytock` | Lists recent deployments. |

> Your next `git push` will publish over a Wrangler upload, so commit and push the same changes too.

## 7. Domain checks

| Command | What it does |
|---|---|
| `whois tinytock.com` | Shows who owns a domain and when it expires. "No match" means it's available. |
| `whois example.com \| grep -i "No match"` | Quick availability check (prints a line only if it's free). |
| `dig tinytock.com +short` | Shows the IP address the domain points to (checks DNS is working). |
| `curl -I https://tinytock.com` | Shows the live site's response headers (checks HTTPS works). |

## 8. Quick site health checks

| Command | What it does |
|---|---|
| `curl -s https://tinytock.com/sitemap.xml` | Shows the live sitemap. |
| `curl -s https://tinytock.com/ads.txt` | Shows the live ads.txt (must match AdSense after approval). |
| `curl -s -o /dev/null -w "%{http_code}\n" https://tinytock.com/games/snake/` | Prints `200` if a page works, `404` if it's missing. |
