# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Marketing site for Shen Studio (大道传媒), the South Bay Chinese-language media company of 沈琛琛 Cici Shen. Since the November 2026 redesign the site exists to push her YouTube channel 「沈琛琛-大道传媒」 (`@dadaomedia`, channel id `UC5JU8r6Q8uz__uis5ZxQhBQ`): the shows 《财经脱口秀》 and 《硅谷C位》 plus Shorts. The homepage is **rendered on request** by a Vercel Function (`api/home.mjs`) from a template, a settings file and the YouTube Data API, and Vercel's CDN caches it for 10 minutes, so new videos show up within about 10 minutes (since 2026-11-10). Zero-dependency Node; no package manager or framework. Tests use Node's built-in runner. Source lives in the git repo `Miloop-AI/shenstudio-site` (public); Vercel (team 「ShenStudio」, project `shenstudio-site`) hosts it. Live at **https://shenstudio.tv** (domain at Namecheap; `www.shenstudio.tv` 308-redirects to it; the Production env var `SITE_URL` makes the site indexable). The previous podcast-first site is tagged `v1-podcast-site`.

The design spec for the current site is `docs/superpowers/specs/2026-11-09-youtube-first-redesign-design.md` (Chinese) and the plan it was built from is `docs/superpowers/plans/2026-11-09-youtube-first-redesign.md`. The older handoff docs (`docs/shen-studio-website-handoff-EN.md`, `docs/大道传媒网站项目交接文档.md`, identical content, keep both in sync) still hold background, brand history, pricing/legal notes and open decisions; their section 0 lists what the redesign replaced.

**What's still to do** lives in `docs/next-steps.md`; read it at the start of a session and keep it current.

**Git identity:** commit and push as the GitHub account `miloopai` (not `ying2sun`). This repo's local git config already sets `user.name=miloopai`, the no-reply email `309224103+miloopai@users.noreply.github.com` and the credential username; the owner signs `miloopai` into Git Credential Manager themselves. Commits before 2026-09-23 evening are authored as `ying2sun` and are left as they are.

**Console instructions:** when telling the owner what to click in Google Cloud, Vercel, GitHub, AWS and the like, quote the English UI labels.

## Commands

```bash
node --test "tests/*.test.mjs"                                        # all tests (no network needed)
node --test tests/model.test.mjs                                      # one suite
node --test --test-name-pattern="nextWeekly" tests/format.test.mjs    # one test
node scripts/build.mjs                                                # live data (needs .env.local) -> fallback/index.html, public/robots.txt
node scripts/build.mjs --fixture tests/fixtures/channel.json          # offline, from recorded API data
node scripts/build.mjs --save-fixture tests/fixtures/channel.json --out "$(mktemp -d)"   # refresh the fixture
```

No linter or formatter is configured. There is no `vercel dev` here: to try the live function locally, import `api/home.mjs` and call its default export with a fake `res` that has `setHeader`, `status` and `send` (as `tests/handler.test.mjs` does); it reads `.env.local` only if you call `process.loadEnvFile('.env.local')` first.

## How a page gets made

`src/site.json` → `scripts/lib/youtube.mjs` `fetchChannelData` (the configured playlists, public videos only) → `model.mjs` `buildModel` (newest episode, show rows, episode numbers, schedule lines, next-episode tile) → `render.mjs` HTML fragments → `page.mjs` `renderPage` fills `src/index.template.html`. Two callers: `api/home.mjs` on every CDN cache miss (through `handler.mjs`, which adds the cache headers and the fallback), and `scripts/build.mjs` at deploy time (writes the fallback page, robots, sitemap). Everything except the API fetch and the file reads in `page.mjs` is pure, so the tests run offline against `tests/fixtures/channel.json`.

## Folder layout

- `api/home.mjs` — the Vercel Function behind `/` (`vercel.json` rewrites `/` to it and bundles the files it reads via `includeFiles`). The handler logic and cache headers are in `scripts/lib/handler.mjs`.
- `public/` — static files Vercel serves: `og.jpg` (share image), `favicon.png`, `apple-touch-icon.png`, and the generated `robots.txt` (+ `sitemap.xml` once `SITE_URL` is set). **There must be no `public/index.html`**: Vercel serves a static file before applying the rewrite, so it would hide the function.
- `fallback/` (gitignored, generated at every deploy) — `index.html`, the same page from deploy-time data; the function serves it when YouTube can't be read. Also the local preview.
- `src/index.template.html` — page markup and CSS with `{{PLACEHOLDERS}}`.
- `src/site.json` — everything edited by hand: which playlists are shows (playlist id, name, eyebrow, line under the heading, schedule), the Shorts playlist, cards per row and rows per show, the collaboration email, platform accounts, the about-the-host text, page description. `scripts/lib/config.mjs` checks it on every build and fails with a readable message.
- `src/icons.json` — platform icon paths from Simple Icons 16.37.0 (CC0).
- `scripts/build.mjs` — the deploy-time build (fallback page, robots, sitemap). `scripts/lib/`: `page.mjs` (`renderPage`, shared by the build and the function; `siteUrls`), `handler.mjs`, `format.mjs` (titles, durations, view counts, Pacific dates, next weekly date), `youtube.mjs` (API client), `config.mjs`, `model.mjs` (what the page shows), `render.mjs` (HTML fragments, SEO head).
- `tests/` — `node --test` suites; `tests/fixtures/channel.json` is real API data recorded with `--save-fixture` for offline builds.
- `parked/` — `pricing.html`, the rate-card page, taken out of the site on 2026-09-23 (no nav link, not deployed) until the founder confirms real rates and a real contact email. To bring it back: move it into `public/`, add a nav link, replace the placeholder prices and `hello@shenstudio.example`, and drop the `noindex`.
- `assets/brand/` — the official logo files delivered by the founder (`大道传媒 Shen Studio 定稿-01.jpg` stacked, `定稿-02.jpg`/`定稿-02.png` horizontal, 3544×3544, red S mark + black text; the PNG is transparent), `logo_horizontal.png` (nav logo: the horizontal PNG trimmed to 96px tall), `logo_horizontal_white.png` (footer logo on teal: the same file with everything but the red S turned white) and `podcast_cover.jpg` (unused).
- `assets/photos/` — `host_photo_full.jpg` (original), `host_photo_banner_crop.jpg`, `host_about.jpg` (720×1080, used in 关于主持人).
- `assets/banners/` — `youtube_banner_2026-11_2048x1152.jpg` (her current channel banner), `hero_strip.jpg` (2048×338, rows 407–745 of it: the centre band YouTube shows on desktop), `hero_strip_mobile.jpg` (1236×338 centre of the strip: YouTube's mobile-safe area). Older banner files are kept for history only.
- `docs/` — spec, plan, handoff documents, `next-steps.md`.
- `archive/` — superseded material kept locally for reference only (gitignored). Don't build on anything in here.

## Working with the site

- **Local setup:** put `YOUTUBE_API_KEY=...` in `.env.local` at the repo root (gitignored; the build loads it). Open `fallback/index.html` to preview. The committed `public/robots.txt` is rewritten by every build, so on Vercel Production (where `SITE_URL` is set) it allows indexing whatever the committed copy says.
- **How fresh the page is:** `/` is rendered by `api/home.mjs` and cached by Vercel's CDN with `s-maxage=600, stale-while-revalidate=60`, so a new video appears within about 10 minutes for any visitor. If the live render fails (API error, quota used up), the function serves `fallback/index.html` with `s-maxage=60` and logs the error (Vercel → the project → **Logs**). Each render costs about 4 API units; the CDN cache is per region.
- **Automation:** `vercel.json` sets `buildCommand` to `node scripts/build.mjs`, so every deploy refreshes the fallback page. `.github/workflows/rebuild.yml` pings a Vercel Deploy Hook (secret `VERCEL_DEPLOY_HOOK`) every 3 hours (GitHub actually runs it every 8–13 h) to keep the fallback recent, and on the 1st of each month commits a timestamp to `.github/keepalive` so GitHub never pauses the schedule. A missing key, an API error or zero public show videos fails the build; Vercel keeps the last good deployment. Redeploying from the Vercel dashboard asks for an email code sent to shenstudio.ai@gmail.com; GitHub → **Actions** → **Rebuild site** → **Run workflow** redeploys without it.
- **API key:** a Google Cloud project under the project owner's Google account, key restricted to YouTube Data API v3, no billing. Stored as the Vercel environment variable `YOUTUBE_API_KEY` (Production and Preview) and in `.env.local`. To rotate: Google Cloud → APIs & Services → Credentials, create a new key, update both places, delete the old key.
- Colors are CSS custom properties on `:root` (`--bg`, `--ink`, `--ink-2`, `--muted`, `--line`, `--soft`, `--teal`, `--teal-deep`, `--on-teal`, `--on-teal-soft`, `--red`, `--red-dark`, `--on-red`, `--overlay`, `--on-overlay`, `--tile*`) — always change the variable, never hardcode a color. White page and ink text; red `#C62828` (the banner's tag) only for watch/subscribe buttons and the 「最新一期」 dot; deep teal `#083B49` (the banner's background) for the closing band and footer; `#0B4A5A` for eyebrows.
- **No JavaScript of our own in the page.** The newest episode is the YouTube player embedded directly (`youtube-nocookie.com` iframe; one click plays; YouTube's own scripts run inside the iframe). A click-to-load thumbnail in an `<iframe srcdoc>` was tried and dropped on 2026-11-09: Chrome blocked autoplay after the first click, so visitors needed two clicks. The phone nav is a horizontally scrolling row; card rows scroll sideways on phones (CSS scroll-snap).
- Responsive breakpoint is `820px`, mobile first (`@media (min-width:820px)` holds the desktop rules). The desktop show rows assume `cardsPerShow` (cards per row) = 4 (`repeat(4, …)` in the CSS); change both together. `rowsPerShow` (2) only limits how many cards a show gets.
- **Images:** logo, banners and host photo are inlined as base64 data URIs (a past version referenced the logo by relative path and it silently failed to render outside its folder). Video thumbnails are hotlinked from `i.ytimg.com` (the API's `standard` size for cards and Shorts, `maxres` for the newest episode); inlining 20+ thumbnails would add over 1 MB. Shorts reuse the 16:9 thumbnail cropped to 9:16 with `object-fit`, because it holds the same cover frame.
- When publishing a page as a shareable Claude Artifact preview, transform it into an Artifact fragment first (strip `<!DOCTYPE>`/`<html>`/`<head>`/`<body>`, keep `<title>` + `<style>` + body content; images must be data URIs or published files). This is unrelated to Vercel deploys.

## Content rules that aren't obvious from the code alone

- **Shows are her YouTube playlists listed in `src/site.json`** (财经脱口秀 `PLe2uCBU6vnTA`, 硅谷C位 `PLESHS0LcVZv8`, 短视频 `PLFhYsSJNdwHs`). Other playlists (e.g. 「C想一刻」) are ignored. To add a show, add an entry; no code change.
- **Only public videos appear.** Private, unlisted, scheduled videos and upcoming premieres are skipped and appear by themselves once public.
- **YouTube "Test & compare" (title/thumbnail A/B tests):** while a test runs, YouTube shows different titles and thumbnails to different viewers (variant images are named like `hq720_custom_2.jpg`), but the Data API only returns the video's default title and thumbnail, so the site shows those. This looks like "the site didn't update" and is not a bug; when YouTube applies the winner, the API returns it and the site follows within about 15 minutes (10-minute page cache + 5-minute image cache). Seen on 2026-11-10 with 硅谷C位 第3期 (`3QFyh5f_lMU`).
- **Schedule wording:** 《财经脱口秀》 shows 「每周五 18:30 · 下一期 <date> · 美西时间」 (date computed; 「今天 18:30 上线」 on the day). 《硅谷C位》 has no fixed day: never write a frequency for it, not even 「不定期更新」 (the founder finds it unprofessional); it shows 「最新一期 <date> · AI 与科技访谈 · 第N期」.
- The newest episode is the newest public video across the show playlists and is not repeated in its show's block. Episode numbers are the order of public videos in the playlist by publish date. All dates are Pacific time.
- Each show gets up to two rows of 4 cards (newest episode excluded; older ones are reached through 「全部 N 期 →」). When the last row has a free slot, the first one holds a card-sized 「下一期」 tile (thumbnail area: 下一期 + date + time; below: 「订阅，开播提醒 →」 and 「栏目 · 第N期」): 财经脱口秀 shows the next air date, 硅谷C位 shows 「敬请期待」. (Owner, 2026-11-09: with one row, 财经脱口秀 第1期 was pushed out and looked "not synced"; a tile stretched over the rest of the row looked too empty.)
- Titles show only the part before the first ｜ or |, without hashtags. There is no guest byline: titles name guests inconsistently. The line under the 财经脱口秀 heading has no guest names for now (owner, 2026-11-09).
- **Brand:** 大道传媒 (Shen Studio) everywhere. The banner (「大道 / 看清大趋势 过好小日子 / 来自硅谷的财经·科技·商业洞察」) is used untouched; don't retouch or re-lay-out it. When she changes it, download the new one (`=s0` on the channel's banner URL gives the 2048×1152 original) and re-cut the strip, the mobile strip and the share image as in plan Task 6.
- **Updated automatically (within about 10 minutes):** videos, titles, thumbnails, view counts, which show a video belongs to, Shorts, the next 财经脱口秀 date, the newest 硅谷C位 date. **Edited by hand in `src/site.json`:** the collaboration email (a temporary Gmail until she gets a professional address), platform accounts (小红书 / 视频号 / 抖音 have no links yet), about text, show descriptions.
- **Podcast:** Podbean is no longer read. The podcast appears only as the Apple Podcasts and Spotify tiles.
- **No fixed topic-category navigation** (no "tech / finance / education" taxonomy): the page is organised by her own named shows.
- **No articles section** and **no pricing** on the site for now (pricing is parked; when it returns it is reachable only from the top nav).
- **SEO / sharing** comes from `seoHead` in `scripts/lib/render.mjs`: title 「大道传媒 Shen Studio｜沈琛琛」 (`pageTitle` in `src/site.json`, chosen by the owner on 2026-11-10; no show names in it), description from `src/site.json`, Open Graph + Twitter card (`public/og.jpg`, 1200×630 from her banner), favicon (red S mark only), schema.org JSON-LD (Organization, Person), and one visually hidden `<h1>` (site name and tagline). **Indexing switch:** without the env var `SITE_URL` the page is `noindex` and `robots.txt` disallows everything; setting `SITE_URL` in Vercel (Production only, then redeploy) turns on canonical, `og:url`, `sitemap.xml` and an allowing `robots.txt`. It is set to the live domain `https://shenstudio.tv`; Preview deployments have no `SITE_URL` and stay `noindex`. Meta keywords are deliberately absent (Google ignores them). Google Search Console: Domain property `shenstudio.tv` under shenstudio.ai@gmail.com, verified by a TXT record at Namecheap (keep it), sitemap submitted as the full URL `https://shenstudio.tv/sitemap.xml`. Per-video pages on this site would be the next SEO step.
