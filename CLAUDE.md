# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Design/prototype workspace for the Shen Studio (大道传媒) marketing website — a South Bay Chinese-language media company's site (podcast + YouTube + future articles + future paid pricing). There is no build system, package manager, or test suite: the site is two self-contained static HTML files with inline `<style>` blocks, meant to be opened directly in a browser or deployed as-is to Vercel. There is no git repository here.

The authoritative spec is the handoff doc, not just the code: `docs/shen-studio-website-handoff-EN.md` (English) and `docs/大道传媒网站项目交接文档.md` (Chinese) are identical in content — read either one, keep both in sync if either changes. It documents brand/color decisions, content model, information architecture, and a list of decisions still open (CMS choice, real pricing numbers, etc.) — check that "open decisions" section before assuming something is settled.

## Folder layout

- `public/` — the deployable site (Vercel deploy root): just `index.html` for now. Nothing else is needed here because every image is inlined as base64.
- `parked/` — `pricing.html`, the rate-card page, taken out of the site on 2026-09-23 (no nav link, not deployed) until the founder confirms real rates and a real contact email. To bring it back: move it into `public/`, re-add the `价目表` nav pill (see git history), replace the placeholder prices and `hello@shenstudio.example`, and drop the `noindex`.
- `assets/brand/` — logo files (`logo preview.jpg`, `logo_horizontal.png`, `logo_stacked.png`) and `podcast_cover.jpg` (Podbean show cover, no longer used on the page).
- `assets/photos/` — host photos (`host_photo_banner_crop.jpg`, `host_photo_full.jpg`).
- `assets/banners/` — `banner_teal_2026-09-23.png` (the founder's own banner, untouched original) and `hero_teal.jpg` (derived 16:9 version: same banner with the 「硅谷C位」 line removed and the remaining brand line + tag re-centered) and `hero_strip.jpg` (1920×317, the center band of that at the proportions of her YouTube channel banner, 2560×423; this is what is embedded in `index.html`).
- `docs/` — the two handoff documents.
- `archive/` — superseded material kept for reference only: the pre-teal homepage (`homepage_v4_cinnabar.html`), the earlier orange/gold banner rounds, Artifact-preview fragments of the pages (regenerable from `public/`), and debug output. Don't build on anything in here.

## Working with the HTML pages

- No build/lint/test commands exist. To preview, open `public/index.html` in a browser (double-click, or `start` on Windows), or run `python -m http.server` from `public/`.
- Colors are CSS custom properties on `:root` (`--paper`, `--ink`, `--ink-soft`, `--accent`, `--teal`, `--muted`, `--line`, `--thumb`, `--on-teal`, `--on-teal-soft`) — always change the variable, never hardcode a color inline. The palette is Direction C "Teal and Paper", taken from the founder's banner: warm paper page, ink text, deep teal (`--teal` #083B49) for the hero image backdrop and footer, a slightly lighter deep teal (`--accent` #0B4A5A) for links/eyebrows/hover. The banner's red tag (#C62828) is deliberately not a token — it only appears inside the hero image. Text/background pairs were checked for WCAG AA (`--muted` on paper is 4.7:1); re-check if you change a value.
- The mobile nav (hamburger menu) is a pure-CSS checkbox-hack (`<input type="checkbox" class="navcheck">` + sibling selector) — no JS anywhere. Keep it that way unless there's a real reason to introduce JS.
- Responsive breakpoint is `820px` (`.desktop-only` / `.mobile-only` / `@media(min-width:820px)`), not the usual 768px — match it when adding new sections.
- **Embed images as base64 data URIs directly in the HTML (`<img src="data:image/png;base64,...">` or the hero's inline `background-image`), never as a relative file path.** A prior version referenced `logo preview.jpg` by path and the logo silently failed to render anywhere the HTML was opened outside its own folder. `assets/brand/logo_horizontal.png` and `logo_stacked.png` (transparent-background crops of `logo preview.jpg`) are the logo sources to re-encode from; `logo preview.jpg` is a placeholder until the founder provides an official logo file. Keep the hero JPEG around 100–200 KB (1600px wide, quality ~80).
- When publishing a page as a shareable Claude Artifact preview, it needs to be transformed into an Artifact-compliant fragment first (strip `<!DOCTYPE>`/`<html>`/`<head>`/`<body>` wrapper tags, keep `<title>` + `<style>` + body content) — don't publish the full HTML document as-is. This is unrelated to Vercel deploys, which take `public/` as-is.

## Content/IA rules that aren't obvious from the code alone

These are deliberate decisions from the handoff doc that a future edit could easily undo by accident:

- **No fixed topic-category navigation** (no "Silicon Valley tech / South Bay life / finance / education" nav). Content is organized by *format* (podcast/video/articles) with a free-form, extensible "column" (栏目) tag per item — not a preset taxonomy. Don't add a fixed category filter or nav.
- **Exactly one image slot site-wide**: the homepage hero. Every other row is plain text by design ("premium feeling comes from typography and whitespace, not icons/illustrations") — don't add thumbnails or decorative graphics elsewhere.
- **Hero image is the founder's brand banner (`assets/banners/hero_strip.jpg`), not per-episode art.** It renders as a full-width strip directly under the nav with the same proportions as her YouTube banner (~6:1 on desktop, 10:3 crop on phones so the text isn't cut off), and the latest-episode text sits below it. It shows her portrait, 「沈琛琛 Cici Shen | 大道传媒」 and a Finance · Tech · News tag, so it never needs swapping per post (Podbean exposes no per-episode art anyway). It is brand-level, so it also stays valid if a video or article becomes the latest item; a real thumbnail is only worth it if the founder asks for one. Regenerate it from `banner_teal_2026-09-23.png` if the banner changes (paint out the old text block, re-place the brand line and tag, crop a 1920×317 band centered on y=540).
- **Brand naming**: 大道传媒 (Shen Studio) is the brand to promote. Do not use 「硅谷C位」 on the site for now (it is baked into the founder's original banner, hence the derived `hero_teal.jpg`). The podcast itself stays 「C想一刻」, matching Podbean.
- **Desktop vs mobile layouts intentionally diverge**: desktop gets a 3-column format preview (podcast/video/articles side by side, wider 1040px container) followed by one unified chronological feed with no category filter. Mobile instead stacks fixed-order sections (podcast → video → articles), with no 3-column layout and no mixed chronological feed, to avoid overloading a small screen. Don't collapse these into one shared layout.
- **Podcast subscribe links (Spotify/Apple Podcast/Podbean) appear exactly once**, in a dedicated row — not repeated under every episode. Each episode headline links directly to its hosting-platform episode page on Podbean (confirmed; feed at `https://chenchenshentv.podbean.com/feed/`).
- **Each podcast item's meta line shows 2 topic hashtags pulled from that episode's own Podbean show notes, not the host's name** (`#TikTok #出海红利 · 2026.08.12`, not `沈琛琛 · 2026.08.12`) — the founder's Podbean posts always end with a clean space-separated hashtag list, and the user prefers those over a repeated byline (every episode has the same single host, so a name adds no information). When adding new episodes, pull 2 non-generic tags from that list (skip self-tags like `#C想一刻`/`#沈琛琛`).
- **The YouTube video slot must degrade honestly when empty** — a plain text line ("first video in production, stay tuned"), not a decorative empty-state card, since the channel currently has zero videos.
- **Pricing is excluded from the site for now**: the page is parked in `parked/pricing.html` with no nav entry. Its prices are illustrative placeholders and its contact address (`hello@shenstudio.example`) is a placeholder. When it returns, it stays off the homepage body and is reachable only through the top nav.
