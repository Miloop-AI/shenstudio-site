# Live Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Serve `/` from a Vercel Function that renders the page from live YouTube data with a 10-minute CDN cache, falling back to the build-time page on errors; set the page title to 「大道传媒 Shen Studio｜沈琛琛」.

**Architecture:** Move the template-filling code from `scripts/build.mjs` into `scripts/lib/page.mjs` (`renderPage`). `scripts/build.mjs` keeps writing robots/sitemap and now writes the page to `fallback/index.html`. `api/home.mjs` wraps `createHandler` from `scripts/lib/handler.mjs`; `vercel.json` rewrites `/` to `/api/home` and bundles the files the function reads.

**Spec:** `docs/superpowers/specs/2026-11-09-youtube-first-redesign-design.md` §11. Global constraints of `docs/superpowers/plans/2026-11-09-youtube-first-redesign.md` still apply (no npm deps, no JS in the page, tokens, 820px, commit trailer).

### Task 1: Page title
- Test (`tests/render.test.mjs`): `seoHead({...config, pageTitle: '大道传媒 Shen Studio｜沈琛琛'})` contains `<title>大道传媒 Shen Studio｜沈琛琛</title>` and `og:title` with the same text; without `pageTitle` it falls back to `siteName`.
- Code: `seoHead` uses `config.pageTitle || config.siteName` for `<title>` and `og:title`; add `"pageTitle"` to `src/site.json`.

### Task 2: `renderPage`
- Create `scripts/lib/page.mjs`: `renderPage({ root, data, now, siteUrl, assetBase }) -> { html, model, config }`; reads `src/site.json` (validated), `src/icons.json`, the template and the inlined images from `root`; throws when there is no public show video.
- Test (`tests/page.test.mjs`): with the fixture data it returns HTML containing the page title, `noindex` when `siteUrl` is empty and the canonical when it is set.
- `scripts/build.mjs` uses it; default output: page → `fallback/index.html`, robots/sitemap → `public/`; `--out DIR` puts all three in DIR. `.gitignore` gets `fallback/`; `public/index.html` is removed from git.

### Task 3: Function
- Create `scripts/lib/handler.mjs`: `createHandler({ render, readFallback, log })` returns `async (req, res)`. Success: 200, `Content-Type: text/html; charset=utf-8`, `Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=60`, body = `render().html`. Failure: logs, serves `readFallback()` with `Cache-Control: public, max-age=0, s-maxage=60`.
- Test (`tests/handler.test.mjs`) with a fake `res` (`setHeader`, `status`, `send`).
- Create `api/home.mjs`: real `render` = fetch with `process.env.YOUTUBE_API_KEY`, `renderPage` with `root = process.cwd()`, `SITE_URL`/`VERCEL_PROJECT_PRODUCTION_URL` as in the build; real `readFallback` reads `fallback/index.html`.
- `vercel.json`: `"rewrites": [{ "source": "/", "destination": "/api/home" }]` and `"functions": { "api/home.mjs": { "includeFiles": "{src/**,fallback/**,assets/brand/logo_horizontal.png,assets/brand/logo_horizontal_white.png,assets/banners/hero_strip.jpg,assets/banners/hero_strip_mobile.jpg,assets/photos/host_about.jpg}" } }`.

### Task 4: Verify and ship
- `node --test "tests/*.test.mjs"` green; push branch; on the Vercel preview (owner's Chrome) check `/` renders, response headers show `x-vercel-cache` MISS then HIT, and the page matches production.
- Docs: CLAUDE.md (how `/` is served, fallback, local preview is `fallback/index.html`), `docs/next-steps.md`.
- Owner OK → merge to `main` → check https://shenstudio.tv headers and content.
