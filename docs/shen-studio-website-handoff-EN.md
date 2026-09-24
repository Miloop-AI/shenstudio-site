# Shen Studio (大道传媒) Website Handoff

Last updated: August 2026

## 1. Project background

Shen Studio is a South Bay based Chinese language media company, founded by a close friend of the project owner. Its content covers Silicon Valley tech, South Bay life, current events, finance, and education. The existing brand asset is a black and white folded ribbon "S" mark, paired with the English name Shen Studio.

Core requirements for the website:

- Show podcast episodes (currently distributed on Spotify, Podbean, and Apple Podcast)
- Show YouTube channel content (the channel exists but has no videos yet)
- Articles are a likely future addition, requiring a private backend that only the founder can access to write and publish
- Show pricing, with a future goal of letting businesses view rates and place paid orders directly on the site

## 2. Brand and visual direction

### Color

After a round of six color directions, the founder narrowed it down to two favorites, with no final pick yet:

**Direction A: Ink and Brass** (not chosen)
Lacquer black `#141210`　Warm bone `#EDE6D3`　Brass gold `#C9A227`　Deep bronze `#6B5A2E`

**Direction B: Cinnabar and Paper** (used in prototypes v1–v4, not chosen)
Paper white `#FAF7F2`　Ink black `#141414`　Cinnabar red `#B7211F`　Warm gray `#8A8578`

**Direction C: Teal and Paper** (chosen 2026-09-23)
The founder made her own banner (deep teal textured background `#083B49`, white type, a red tag `#C62828`, circular portrait), and the site now takes its color from it: the page stays warm paper white so long reading stays comfortable, cinnabar is replaced by deep teal for links and labels, and the hero image and footer are teal blocks. The banner's red exists only inside the hero image, not as a token. Values in the code:

```
--paper:   #FAF7F2   paper white, page background
--ink:     #12191B   ink black, headings and body text
--ink-soft:#4E5B5E   secondary body text
--accent:  #0B4A5A   deep teal, links, eyebrow labels, hover
--teal:    #083B49   banner teal, hero backdrop and footer background
--muted:   #657172   secondary text, dates (4.7:1 on paper)
--line:    #E2DFD5   hairline dividers
--thumb:   #083B49   hero placeholder background
--on-teal: #F4F1EA   text on teal
--on-teal-soft: #A9C6CD  secondary text on teal
```

All colors are CSS variables, so any future adjustment only requires updating these values, no structural changes needed.

### Typography

- Headlines (serif): Noto Serif TC / Songti TC / Georgia
- Navigation and body (sans): PingFang TC / Microsoft JhengHei / Helvetica Neue / Arial
- Metadata such as dates and durations (mono): SF Mono / Consolas / Menlo

### Design principles (settled on after several revision rounds)

- No decorative illustrations. Earlier drafts used a seal stamp, an audio waveform, and a dashed empty state box; all of these were removed. The premium feeling now comes from restrained typography, clear type hierarchy, and generous whitespace, not from icons or motifs
- Minimal reliance on images. The entire homepage has exactly one image slot (the hero) — currently the founder's own teal brand banner (see section 11), which is brand-level and needs no per-post swapping. Every other content row is plain text and reads as complete even with zero images
- Layout modeled on Initium Media (theinitium.com): each item is presented as a row with tag, headline, one line deck, and author or date, rather than a card grid

## 3. Content and column model

**Fixed topic categories were explicitly rejected** (for example Silicon Valley tech, South Bay life, current events, finance, education as a preset navigation taxonomy), because the founder's content volume is currently uneven across topics and a fixed category nav risks leaving some categories permanently empty.

The alternative:

- Content is structured primarily by **format**: podcast, video, articles
- Each item can carry a **column (栏目)** tag, meaning a fixed, named recurring show or column (her podcast itself can count as one column). This field is freely extensible rather than a predefined fixed list; having only one column today is fine, new tags get added whenever she launches a new show
- This "no fixed categories, free tagging" approach is validated by Initium Media's real site: each article's tag can be a region, a topic, or a column name, mixed freely with no rigid taxonomy

## 4. Information architecture

> **Superseded 2026-09-23.** The desktop three-column preview and separate mobile stacking described below were replaced by a single list (newest item, then everything after it, with a side column for video). See section 11.

### Desktop (≥820px)

1. **Hero**: automatically shows the latest published item across all formats (no manual weekly curation needed, solving the "can't realistically update this every week" problem), under the brand banner image (the same on every item), with headline, one line deck, author, and date
2. **Subscribe row**: Spotify, Apple Podcast, and Podbean links, shown once only, not repeated under every episode
3. **Three column format preview**: podcast, video, and articles side by side (uses a wider 1040px layout than the reading sections), each column shows the two or three latest items, the video column shows a "in production" text notice until real videos exist
4. **All content**: podcast and article items (video will join once it exists) mixed together in one chronological list with no category filter, each row tagged with a small format label
5. **Footer**

### Mobile (<820px)

1. Hero (same as desktop)
2. Subscribe row (same as desktop)
3. Stacked sections in a fixed priority order, **podcast, then video, then articles** (no three column layout, no mixed time stream, to avoid over dense mobile screens)
4. Footer

The navigation menu on mobile is a genuinely functional hamburger menu (pure CSS, no JS needed); on desktop it automatically becomes a horizontal row of links.

### Pricing

Pricing is deliberately excluded from every part of the homepage body, reachable only through the top navigation as a standalone page (the current demo does not yet have this page built; the nav link points to a placeholder address, `pricing.html`).

## 5. Podcast

- The hosting platform is confirmed as Podbean: the show ("C想一刻") is at `chenchenshentv.podbean.com`, with a public RSS feed at `chenchenshentv.podbean.com/feed/` (9 episodes as of 2026-08-17). Also distributed on Spotify (`open.spotify.com/show/033R7udpl2Dr1qmaoNHATs`) and Apple Podcasts (`podcasts.apple.com/us/podcast/c想一刻/id6791887956`) — all three are wired into the homepage's subscribe row
- Each episode's headline is itself the link, pointing directly to that episode's page on Podbean, rather than repeating all three platform links under every episode as earlier drafts did. v4 now uses real episode URLs pulled from the public RSS feed
- The host is the founder herself, 沈琛琛 (Cici Shen) — every episode so far is solo-hosted, no guests. Each item's byline on the homepage shows two topic hashtags pulled from that episode's own Podbean show notes instead of the host's name (e.g. `#TikTok #出海红利 · 2026.08.12`), since a repeated host name added no information
- Per-episode cover art is not available through this pipeline: Podbean's own documentation states episode-level images are no longer exposed as `itunes:image` in the RSS feed (only the show-level logo is), confirmed empirically — none of the 9 episodes have any per-item image field in the raw feed. The homepage hero therefore uses the founder's brand banner rather than per-episode art (see section 11)

## 6. YouTube video

The channel exists but currently has no videos. The homepage handles this "temporarily no content" state honestly: the video column in the three column preview shows a single text line, "First video in production, stay tuned," instead of a decorative empty state card that could look broken. Once the first real video is published, this slot will automatically be replaced with a normal content row.

## 7. Article backend (requirements confirmed, not yet built)

The founder needs a private writing backend that only she can log into. Once she publishes, articles automatically appear on the public site; unpublished drafts are invisible to everyone, including the public site's API.

Two technical directions are on the table, no final decision yet:

1. **Headless CMS plus custom frontend** (for example Sanity plus Next.js): maximum design freedom, the best fit for the fully custom visual style already built. The authoring interface (Studio) is deployed at a separate login required URL, entirely apart from the public site
2. **Ghost**: a publishing platform purpose built for exactly this "podcast plus articles plus newsletter" content mix, with a writing interface that is friendlier for a non technical founder. Initium Media, the site used as the layout reference for v4, actually runs on Ghost, which is a real world validation of this option

## 8. Pricing and online payment

Goal: businesses can see rates on the site and place a paid order directly online.

Technical approach: use Stripe Payment Links or Checkout, so card data is never handled directly, satisfying PCI compliance requirements.

**Current status: UI placeholders only, Stripe is not yet wired up.** Each pricing tier card has a payment button styled with a dashed border and a "not yet available" label, plus a line directing businesses to email for now, so a click never leads to a dead end.

## 9. Legal and business prerequisites before charging money (important, not legal or financial advice)

The following needs confirmation from her own accountant or lawyer; this is only a list of what to check:

- **Business entity and bank account**: opening a Stripe or similar payment account typically requires a formally registered business entity (LLC or DBA) and a matching business bank account, a personal account generally will not work
- **Sales tax**: California generally does not tax service type charges such as ad placements or content collaborations the way it taxes physical goods, but the exact rules should be confirmed with her accountant or the latest CDTFA guidance
- **Privacy policy (CCPA)**: as soon as the site collects business contact or payment related information, being a California site it needs a privacy policy that meets CCPA disclosure requirements
- **Collaboration terms**: recommend attaching a clear terms document to the ordering flow (commonly called an insertion order in the ad industry), spelling out exactly what was purchased, in what placement, in what format, and the cancellation and refund rules
- **Sponsored content disclosure (FTC)**: if a paid business collaboration results in something that looks like editorial content (an article or an episode), it needs a clear "sponsored" or "in partnership with" label, to avoid being treated as misleading advertising

## 10. Design references

- **Silicon Valley 101 (sv101.fireside.fm)**: agreed on as a good content reference by both the project owner and the founder, but the site itself is a generic template hosted on Fireside.fm, a podcast hosting platform, so it is not usable as a visual reference. One structural detail worth keeping: they group past episodes loosely by "Season" rather than by topic, which is a useful fallback for later, once pure chronological browsing becomes hard to navigate at higher volume
- **Initium Media (theinitium.com)**: the primary layout reference currently in use. Also a Chinese language outlet, its navigation separates region, format, series, and column into distinct entries, and each piece of content's tag is freely mixed rather than drawn from one fixed taxonomy, matching this project's direction. Its site is actually built on Ghost

## 11. Current status

Completed through the fourth homepage prototype (now `public/index.html`; the pre-teal version is kept as `archive/homepage_v4_cinnabar.html`), recolored to Direction C on 2026-09-23 and now populated with real content rather than placeholders:
- **SEO basics, 2026-09-23.** Added an h1, descriptive title, share card image, favicon, schema.org podcast data and robots/sitemap generation. The site stays `noindex` until the environment variable `SITE_URL` is set to the real domain (planned only once the founder's content is complete; the Namecheap domain is intentionally not connected yet). Each episode row now shows up to 6 hashtags (they have roughly 7–39 per episode in the show notes). Per-episode pages on this site are a possible next step for search visibility, since episode links currently go to Podbean.
- **Layout and automation update, 2026-09-23.** The homepage is now generated by `scripts/build.mjs` from `src/index.template.html` plus her Podbean and YouTube feeds (no hand-written summaries or tags: the summary is the first paragraph of the show notes, the two tags are picked from the notes' hashtag list). Structure: banner strip, a centered intro (「旧金山湾区著名媒体人沈琛琛，立足硅谷，放眼全球。深度时事解析 × 财经干货访谈 × 硅谷前沿科技 × 大健康养生」), a subscribe row, then 「最新发布」 (the single newest item, whatever its format) followed by 「全部内容」 starting with the next item, with a 影片 box in a side column. Episode rows follow the layout of Silicon Valley 101's site (episode number, title, two-line summary, tags · date · length) but stay text-only, keeping the rule of one image site-wide. The articles section was removed for now. Every Vercel deploy re-reads the feeds (`buildCommand` in `vercel.json`), and a GitHub Actions job pings a Vercel Deploy Hook every 3 hours so new episodes and videos appear without manual work.

- Real logo embedded directly in the HTML as base64 (cropped from `logo preview.jpg` into `logo_horizontal.png`), replacing the earlier SVG placeholder in the nav. The prior version referenced the logo by relative file path, which failed to render whenever the page was opened outside its own folder (including as a shared preview link) — hence the base64-embedding rule now documented in `CLAUDE.md`
- Real podcast episodes, pulled from the public RSS feed, populate the hero, the desktop three-column preview, the chronological all-content feed, and the mobile podcast section: titles, dates, and each episode's direct Podbean link are real. One-line decks are hand-written condensed summaries, since the feed has no short subtitle field
- Hero image is the founder's own teal banner, cut to the proportions of her YouTube channel banner (~6:1; `assets/banners/hero_strip.jpg`, embedded as base64, shown as a full-width strip under the nav), replacing the earlier podcast show-cover art. It is a derived version of her original banner (`assets/banners/banner_teal_2026-09-23.png`): the 「硅谷C位」 line was removed and the remaining 「沈琛琛 Cici Shen | 大道传媒」 line and Finance · Tech · News tag re-centered, because the brand to promote is 大道传媒, not 硅谷C位 (the podcast itself remains 「C想一刻」). Being brand-level, it needs no per-post maintenance. On phones it uses a 10:3 crop so the text is not cut off
- A standalone rate-card style pricing page is built but **parked as of 2026-09-23** (`parked/pricing.html`, no nav entry, not deployed) until real rates and a real contact email exist: row-based line items grouped by format (not SaaS-style tier cards, to match the homepage's editorial layout), an honest "pricing TBD" line for video (channel has no videos yet), a disabled "online ordering in development" tag per item per the original no-dead-end-click requirement, and one real mailto contact line as the actual next step. **All listed prices are clearly-labeled illustrative placeholders — not real numbers from the founder** — and should not go live publicly until she provides real rates
- The article section (both the desktop 3-column preview and the mobile section) was changed from placeholder article titles to an honest "writing backend in development" empty state, matching the video section's existing honest-empty-state pattern, since no article backend or drafts exist yet
- Video section is unchanged (channel still has zero videos as of 2026-08-17); the project owner has asked the founder for the channel link but hasn't received it yet

Not yet started: building the article backend (CMS), actual Stripe integration, and drafting the legal documents (privacy policy, collaboration terms).

In progress: deploying the current homepage to the founder's real domain (see section 13).

## 12. Open decisions

- ~~Final color direction~~ — resolved 2026-09-23: Direction C, Teal and Paper (see section 2)
- CMS platform: Sanity (or another headless CMS) versus Ghost
- Setting up the business entity and Stripe account
- Column naming conventions, to be filled in as she launches new shows
- Real numbers for the pricing page — currently illustrative placeholders; a business could mistake them for real rates if the site goes live before these are replaced
- ~~YouTube channel link~~ — received 2026-09-23: `https://www.youtube.com/@ChenchenShen0416` (channel ID `UC5JU8r6Q8uz__uis5ZxQhBQ`, channel currently titled 「硅谷C位」, zero videos). Linked from the video column, the mobile video section and the footer; automatic listing of new videos is planned but not built

## 13. Deployment

- The project owner now has admin access to the founder's Namecheap account (domain registrar) and will handle DNS changes there directly
- Hosting: Vercel. Update 2026-09-23: the account is a **personal Vercel account opened by the project owner with their own email**, not a separate account for the founder as originally planned. The project owner deploys on the founder's behalf. Two things to settle before the site goes live: Vercel's free Hobby plan is limited to non-commercial use, and this is a company's marketing site, so a paid plan may be needed; and moving the project to a team or account under the founder's name later is possible if ownership should be separated
- Credential handling: account creation and any password-based login must be done by the project owner (or founder) directly — this assistant does not create accounts or handle passwords under any circumstances, even with explicit authorization. The working arrangement instead uses a Vercel **access token** (generated from the account's own settings after logging in), which the project owner hands to this assistant to run deploys via the Vercel CLI/API — no password ever changes hands
- Currently waiting on: logging the CLI in (the project owner runs `npx vercel login` themselves; no password is shared) and the confirmed domain name. The deployable site lives in `public/`; the source is on GitHub at `miloopai/shenstudio-site` (repo under the project owner's account)
- Local environment: Node.js v24 and npm 11 are now installed, so the Vercel CLI can be used directly (the earlier note about Node v6 is obsolete)
