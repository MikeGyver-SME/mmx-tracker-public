# MMX Live Tracker — Public GitHub Edition

A public, shareable tracker for JAXA's **MMX (Martian Moons eXploration)**
spacecraft, running entirely on GitHub: **GitHub Pages** serves the site and
**GitHub Actions** refreshes the data from NASA/JPL Horizons every 30 minutes.

This is the edition to link in posts. Mike's private Cloudflare version stays
exactly as it is — this one never touches Cloudflare, a personal server, or
any paid quota. Visitor traffic hits GitHub's CDN, and the only recurring
work is one small scheduled fetch, so the cost is **$0 no matter how many
people visit**.

## How it works

1. `.github/workflows/update-telemetry.yml` runs every 30 minutes.
2. `scripts/fetch-telemetry.mjs` asks JPL Horizons for MMX (spacecraft `-239`),
   using the same query and math as the Cloudflare Worker, and writes the
   reading to `data/latest.json`.
3. The workflow commits `data/latest.json` back to this repo.
4. `index.html` / `telemetry.html` read `data/latest.json` from the same
   origin — no CORS problem, because a script on GitHub's runner (not a
   browser) is what talks to JPL.

## Deploy (one time, ~10 minutes)

You need a **public** GitHub repository — public is what makes Pages and
Actions free.

1. On github.com, click **+ → New repository**.
   - Name it `mmx-tracker-public`.
   - Set it to **Public**.
   - Do **not** add a README or .gitignore (this package has its own).
   - Click **Create repository**.
2. Push this package's files to the repo. From a terminal in this folder:

   ```
   git init
   git add .
   git commit -m "MMX tracker — public GitHub edition v1.0.1"
   git branch -M main
   git remote add origin https://github.com/MikeGyver-SME/mmx-tracker-public.git
   git push -u origin main
   ```

   (Using GitHub Desktop
   or your usual push script works too — the important part is that **all**
   files land in the repo, including the `.github` folder and `.nojekyll`.)
3. Turn on Pages: in the repo, click **Settings → Pages**.
   - Under "Build and deployment", set **Source: Deploy from a branch**.
   - Set the branch to **main** and the folder to **/ (root)**, then **Save**.
   - After a minute or two, the Pages banner shows your live URL:
     `https://mikegyver-sme.github.io/mmx-tracker-public/`
4. Kick off the first data refresh: click the **Actions** tab →
   **Update MMX telemetry** → **Run workflow**. (The packaged
   `data/latest.json` already contains a live reading, so the site works
   even before the first run.)

That's it — that URL is the one to share in posts.

## Good to know

- **Freshness:** data updates on the 30-minute schedule; GitHub sometimes
  starts scheduled runs a few minutes late under load. The T+ clock on the
  page is computed live in the visitor's browser, so it is always exact.
- **Post generator:** `telemetry.html` builds the LinkedIn post from the
  same data, and its "Tracked live:" link automatically uses this site's
  own GitHub Pages address — nothing to configure. (To hard-code a
  different link, edit the `TRACKER_URL` line at the top of `telemetry.js`.)
- **The 60-day gotcha:** GitHub can pause scheduled workflows in repos
  with no activity for 60 days. This workflow's own data commits count as
  activity, so it should keep itself alive — but if updates ever stall,
  go to **Actions → Update MMX telemetry**, click **Run workflow**, and
  check the run for a Horizons error.
- **If Horizons hiccups:** the fetch script retries 3 times, then fails
  the run *without* overwriting the last good data — visitors keep seeing
  the previous reading, never a blank page.
- **Changing the cadence:** edit the `cron:` line in
  `.github/workflows/update-telemetry.yml` (e.g. `0 * * * *` for hourly).
  Don't go below every 5 minutes — GitHub's minimum, and JPL doesn't need
  the attention.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The tracker page (T+ clock, distance, range rate, light time, feed log) |
| `telemetry.html`, `telemetry.js` | LinkedIn post generator with Copy button |
| `data/latest.json` | The latest Horizons reading (auto-updated) |
| `scripts/fetch-telemetry.mjs` | Horizons fetch + parse script (Node 20, no dependencies) |
| `.github/workflows/update-telemetry.yml` | The 30-minute refresh schedule |
| `.nojekyll` | Tells GitHub Pages to serve the files exactly as-is |

Data: NASA/JPL Horizons, spacecraft **-239**. Built by MikeGyver Studio —
Sharing is Caring.
