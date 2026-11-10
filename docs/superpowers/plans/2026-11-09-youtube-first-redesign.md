# YouTube-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the podcast-first generated homepage with the approved white, YouTube-first page, fed automatically from the YouTube Data API every 3 hours with no manual step.

**Architecture:** `scripts/build.mjs` stays the single entry point Vercel runs. It loads `src/site.json` (hand-edited settings), calls the YouTube Data API through a small client (`scripts/lib/youtube.mjs`), turns the result into a page model (`scripts/lib/model.mjs`, pure), renders HTML fragments (`scripts/lib/render.mjs`, pure) into `src/index.template.html`, and writes `public/index.html`. A recorded API response (`tests/fixtures/channel.json`) lets tests and layout work run offline.

**Tech Stack:** Node ≥ 20.12, no npm dependencies, `node --test` for tests, plain HTML/CSS (no JavaScript in the page), Vercel static hosting, GitHub Actions cron + Vercel Deploy Hook. Python 3 + Pillow only for the one-off asset step (already on this machine).

**Spec:** `docs/superpowers/specs/2026-11-09-youtube-first-redesign-design.md` (Chinese). Visual reference (approved): https://claude.ai/artifact/4aVdEghGcWXDrGJeQZtr2m

## Global Constraints

- No npm dependencies, no `package.json`. Node built-ins only (`fetch`, `node:test`, `node:util` `parseArgs`, `process.loadEnvFile`).
- The generated page contains no JavaScript except the JSON-LD data block.
- Responsive breakpoint is 820px, mobile first: base CSS is the phone layout, desktop rules live in `@media (min-width:820px)`.
- Every color is a CSS custom property on `:root`; component rules never use literal colors. (Only exception: the CSS inside the player's `srcdoc` document, which cannot see the parent's variables.)
- Logo, banner and host photo are inlined as base64 data URIs. Video thumbnails are hotlinked from `i.ytimg.com`.
- Only **public** videos appear. Only the playlists listed in `src/site.json` are read (财经脱口秀 `PLe2uCBU6vnTA`, 硅谷C位 `PLESHS0LcVZv8`, 短视频 `PLFhYsSJNdwHs`); 「C想一刻」 `PLezIS9Mxq6fo` is ignored.
- 财经脱口秀 shows 「每周五 18:30 · 下一期 <date> · 美西时间」 (date computed; 「今天」 before 18:30 on the day). 硅谷C位 never shows a frequency (not even 「不定期更新」); it shows 「最新一期 <date> · 第N期」.
- All dates are shown in Pacific time (`America/Los_Angeles`).
- If `YOUTUBE_API_KEY` is missing, the API fails, or no public show video exists, the build throws (Vercel keeps the last good deployment).
- Page copy is Simplified Chinese, `lang="zh-Hans"`.
- Commits are made as the git identity already configured (`miloopai`). Every commit message ends with the line `Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e`.
- Work happens on branch `youtube-redesign`. Do not push or merge without the project owner's explicit OK (Task 11).

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/format.mjs` (new) | Pure text helpers: clean titles, first paragraph, durations, view counts, Pacific dates, next weekly air date |
| `scripts/lib/config.mjs` (new) | `validateConfig()` for `src/site.json` |
| `scripts/lib/youtube.mjs` (new) | YouTube Data API client: playlist items (paged, public only), video details (batched), `fetchChannelData()` |
| `scripts/lib/model.mjs` (new) | `buildModel()`: latest episode, per-show cards, episode numbers, filler span, schedule lines, shorts |
| `scripts/lib/render.mjs` (new) | HTML fragments + `seoHead()` + `fillTemplate()` |
| `scripts/build.mjs` (rewrite) | Orchestration, CLI flags, `.env.local`, robots/sitemap, writes `public/index.html` |
| `src/site.json` (new) | Hand-edited settings: shows, shorts, email, platforms, about text, page description |
| `src/icons.json` (new) | Simple Icons path data for the 6 platform tiles |
| `src/index.template.html` (rewrite) | Page markup + CSS with `{{PLACEHOLDERS}}` |
| `tests/*.test.mjs` (new) | One suite per lib module + an offline build test |
| `tests/fixtures/channel.json` (new) | Recorded real API data |
| `assets/banners/youtube_banner_2026-11_2048x1152.jpg`, `hero_strip.jpg`, `hero_strip_mobile.jpg`; `assets/brand/logo_horizontal_white.png`; `assets/photos/host_about.jpg`; `public/og.jpg` | Images |
| `.github/workflows/rebuild.yml`, `.github/keepalive` | 3-hourly rebuild + monthly keepalive commit |
| `CLAUDE.md`, both handoff docs, `docs/next-steps.md` | Docs |

---

### Task 1: Formatting helpers

**Files:**
- Create: `scripts/lib/format.mjs`
- Test: `tests/format.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported, all pure):
  - `cleanTitle(raw: string): string`
  - `firstParagraph(desc: string, max = 160): string`
  - `parseDuration(iso: string): number` (seconds)
  - `formatDuration(sec: number): string` (`"25:48"`, `"1:02:03"`)
  - `formatViews(n: number|string): string` (`"5,958 次观看"`, `"3.1万次观看"`)
  - `formatDate(iso: string, now = new Date()): string` (`"11月1日"`, `"2025年12月31日"`)
  - `nextWeekly(weekday: 0..6, time: "HH:MM", now = new Date()): string` (`"11月13日"` or `"今天"`)

- [ ] **Step 1: Write the failing tests** — create `tests/format.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, firstParagraph, parseDuration, formatDuration, formatViews, formatDate, nextWeekly } from '../scripts/lib/format.mjs';

test('cleanTitle keeps the part before the first ｜ or | and drops hashtags', () => {
  assert.equal(cleanTitle('当AI接管工厂和代码：普通人未来10年最大的危机与出路｜硅谷C位'), '当AI接管工厂和代码：普通人未来10年最大的危机与出路');
  assert.equal(cleanTitle('特斯拉飞车现场炸裂，为什么华尔街不买账？|《硅谷C位》EP1 | 沈琛琛'), '特斯拉飞车现场炸裂，为什么华尔街不买账？');
  assert.equal(cleanTitle('401K一次性全转成Roth可以吗？ #财经脱口秀 #硅谷华人#在美华人'), '401K一次性全转成Roth可以吗？');
  assert.equal(cleanTitle('｜沈琛琛'), '沈琛琛');
  assert.equal(cleanTitle('退休不是看你有多少钱，而是看你需要多少钱💰'), '退休不是看你有多少钱，而是看你需要多少钱💰');
});

test('firstParagraph returns the first prose paragraph, joins Chinese lines without spaces, cuts long text', () => {
  const desc = '在硅谷辛勤打拼20年，\n坐拥$1000万美元身家。\n\n本期《财经脱口秀》……\n\n00:00 开场';
  assert.equal(firstParagraph(desc), '在硅谷辛勤打拼20年，坐拥$1000万美元身家。');
  assert.equal(firstParagraph('#财经脱口秀 #退休\n\n真正的第一段'), '真正的第一段');
  assert.equal(firstParagraph('https://example.com\n\nSecond line\nof English'), 'Second line of English');
  assert.equal(firstParagraph(''), '');
  assert.equal(firstParagraph('一'.repeat(200), 10), '一'.repeat(10) + '…');
});

test('parseDuration and formatDuration', () => {
  assert.equal(parseDuration('PT25M48S'), 1548);
  assert.equal(parseDuration('PT8M19S'), 499);
  assert.equal(parseDuration('PT1H2M3S'), 3723);
  assert.equal(parseDuration('P0D'), 0);
  assert.equal(parseDuration('nonsense'), 0);
  assert.equal(formatDuration(1548), '25:48');
  assert.equal(formatDuration(499), '8:19');
  assert.equal(formatDuration(3723), '1:02:03');
  assert.equal(formatDuration(45), '0:45');
});

test('formatViews switches to 万 from 10,000', () => {
  assert.equal(formatViews(163), '163 次观看');
  assert.equal(formatViews('5958'), '5,958 次观看');
  assert.equal(formatViews(31234), '3.1万次观看');
  assert.equal(formatViews(20000), '2万次观看');
  assert.equal(formatViews(48049), '4.8万次观看');
});

test('formatDate shows Pacific dates and adds the year only when it differs', () => {
  const now = new Date('2026-11-09T20:00:00Z');
  assert.equal(formatDate('2026-11-02T02:00:33Z', now), '11月1日');   // 18:00 PST on Nov 1
  assert.equal(formatDate('2026-10-31T03:00:00Z', now), '10月30日');  // 20:00 PDT on Oct 30
  assert.equal(formatDate('2025-12-31T20:00:00Z', now), '2025年12月31日');
});

test('nextWeekly finds the next Friday 18:30 Pacific', () => {
  assert.equal(nextWeekly(5, '18:30', new Date('2026-11-09T20:00:00Z')), '11月13日'); // Monday noon
  assert.equal(nextWeekly(5, '18:30', new Date('2026-11-14T01:00:00Z')), '今天');     // Friday 17:00
  assert.equal(nextWeekly(5, '18:30', new Date('2026-11-14T03:00:00Z')), '11月20日'); // Friday 19:00
  assert.equal(nextWeekly(5, '18:30', new Date('2026-12-28T20:00:00Z')), '1月1日');   // across New Year
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/format.test.mjs`
Expected: FAIL — `Cannot find module '.../scripts/lib/format.mjs'`.

- [ ] **Step 3: Implement** — create `scripts/lib/format.mjs`:

```js
// Pure helpers that turn YouTube API values into the text shown on the page. No I/O.
const TZ = 'America/Los_Angeles';
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function pacific(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, weekday: WEEKDAY[p.weekday], hour: +p.hour, minute: +p.minute };
}

const CJK_END = /[\u3000-\u9fff\uff00-\uffef]$/;
const joinLines = (p) => p.split('\n').map((l) => l.trim()).filter(Boolean)
  .reduce((acc, l) => (!acc ? l : CJK_END.test(acc) ? acc + l : `${acc} ${l}`), '');

/** "股票涨了10倍却不敢卖？…｜沈琛琛 x Shannon｜财经脱口秀 #tag" -> "股票涨了10倍却不敢卖？…" */
export function cleanTitle(raw) {
  const noTags = String(raw ?? '').replace(/#[^\s#]+/g, ' ');
  const parts = noTags.split(/[｜|]/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return parts[0] || '';
}

/** First prose paragraph of a description (skips hashtag, link and timestamp paragraphs), cut to `max` characters. */
export function firstParagraph(desc, max = 160) {
  const paras = String(desc ?? '').split(/\n\s*\n/).map(joinLines);
  const prose = paras.find((p) => p && !/^(#|https?:\/\/|\d{1,2}:\d{2})/.test(p));
  if (!prose) return '';
  const chars = [...prose];
  return chars.length > max ? chars.slice(0, max).join('') + '…' : prose;
}

/** ISO 8601 duration ("PT25M48S") -> seconds. Anything else -> 0. */
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso ?? ''));
  if (!m) return 0;
  const n = (i) => Number(m[i] || 0);
  return n(1) * 86400 + n(2) * 3600 + n(3) * 60 + n(4);
}

/** 1548 -> "25:48", 3723 -> "1:02:03" */
export function formatDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 5958 -> "5,958 次观看", 31234 -> "3.1万次观看", 20000 -> "2万次观看" */
export function formatViews(n) {
  const v = Number(n) || 0;
  if (v < 10000) return `${v.toLocaleString('en-US')} 次观看`;
  const wan = Math.round(v / 1000) / 10;
  return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万次观看`;
}

/** Pacific-time "11月1日"; the year is added when it differs from `now`'s Pacific year. */
export function formatDate(iso, now = new Date()) {
  const p = pacific(new Date(iso)), q = pacific(now);
  return `${p.year !== q.year ? `${p.year}年` : ''}${p.month}月${p.day}日`;
}

/** Next weekly air date in Pacific time: "今天" before today's air time, else "11月13日". weekday: 0 = Sunday … 6 = Saturday. */
export function nextWeekly(weekday, time, now = new Date()) {
  const p = pacific(now);
  const [hh, mm] = String(time).split(':').map(Number);
  let add = (weekday - p.weekday + 7) % 7;
  if (add === 0 && p.hour * 60 + p.minute >= hh * 60 + mm) add = 7;
  if (add === 0) return '今天';
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + add));
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/format.test.mjs`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/format.mjs tests/format.test.mjs
git commit -F - <<'EOF'
Add formatting helpers for titles, durations, views and Pacific dates

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 2: Site settings file and its validation

**Files:**
- Create: `src/site.json`
- Create: `scripts/lib/config.mjs`
- Test: `tests/config.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `validateConfig(config: object): object` — returns the same object or throws `Error("src/site.json: …")`.
  - The `src/site.json` shape used by every later task (keys: `siteName, tagline, description, host{name, alternateName}, channel{id, handle, title}, shows[{key, playlistId, name, eyebrow, sub, schedule}], shorts{playlistId, name, eyebrow}, cardsPerShow, shortsCount, email, about{eyebrow, heading, paragraphs[], stats[{value,label}]}, collab{eyebrow, heading, text}, platforms[{name, handle, url?, icon, wide?}]`). `schedule` is `{type:"weekly", weekday, time, label}` or `{type:"latest"}`.

- [ ] **Step 1: Write the failing tests** — create `tests/config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../scripts/lib/config.mjs';

const real = () => JSON.parse(readFileSync(new URL('../src/site.json', import.meta.url), 'utf8'));

test('the real src/site.json is valid', () => {
  assert.doesNotThrow(() => validateConfig(real()));
});

test('a missing email is reported', () => {
  const c = real(); delete c.email;
  assert.throws(() => validateConfig(c), /src\/site\.json: "email"/);
});

test('a weekly schedule needs weekday 0-6 and HH:MM', () => {
  const c = real(); c.shows[0].schedule.weekday = 7;
  assert.throws(() => validateConfig(c), /weekday/);
  const d = real(); d.shows[0].schedule.time = '6:30pm';
  assert.throws(() => validateConfig(d), /time/);
});

test('schedule type must be weekly or latest', () => {
  const c = real(); c.shows[1].schedule = { type: 'biweekly' };
  assert.throws(() => validateConfig(c), /"weekly" or "latest"/);
});

test('show keys must be unique and not clash with fixed page anchors', () => {
  const c = real(); c.shows[1].key = c.shows[0].key;
  assert.throws(() => validateConfig(c), /used twice/);
  const d = real(); d.shows[0].key = 'about';
  assert.throws(() => validateConfig(d), /reserved/);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/config.test.mjs`
Expected: FAIL — `Cannot find module` (or ENOENT for `src/site.json`).

- [ ] **Step 3: Create `src/site.json`** (exact content):

```json
{
  "siteName": "大道传媒 Shen Studio",
  "tagline": "来自硅谷的财经·科技·商业洞察",
  "description": "沈琛琛 Cici Shen 的 YouTube 频道「大道」：来自硅谷的财经·科技·商业洞察。每周五《财经脱口秀》，以及 AI 与科技访谈《硅谷C位》。",
  "host": { "name": "沈琛琛", "alternateName": "Cici Shen" },
  "channel": { "id": "UC5JU8r6Q8uz__uis5ZxQhBQ", "handle": "@dadaomedia", "title": "沈琛琛-大道传媒" },
  "shows": [
    {
      "key": "finance",
      "playlistId": "PLe2uCBU6vnTA",
      "name": "财经脱口秀",
      "eyebrow": "北美财经干货 · 每周五更新",
      "sub": "退休精算 · 资产配置 · 财商突破　｜　常驻嘉宾 Frank Ho、Shannon Wang 博士",
      "schedule": { "type": "weekly", "weekday": 5, "time": "18:30", "label": "每周五" }
    },
    {
      "key": "cwei",
      "playlistId": "PLESHS0LcVZv8",
      "name": "硅谷C位",
      "eyebrow": "AI 与科技访谈",
      "sub": "前沿技术 · 商业落地 · 创投趋势",
      "schedule": { "type": "latest" }
    }
  ],
  "shorts": { "playlistId": "PLFhYsSJNdwHs", "name": "短视频", "eyebrow": "一分钟看懂" },
  "cardsPerShow": 4,
  "shortsCount": 6,
  "email": "chenchenshentv@gmail.com",
  "about": {
    "eyebrow": "关于主持人",
    "heading": "看清大趋势，过好小日子",
    "paragraphs": [
      "Hi，我是沈琛琛 Cici Shen。我在中美两地有 15 年电视与电台主持经验，毕业于上海戏剧学院主持专业、旧金山艺术大学导演硕士，目前在硅谷媒体创业。",
      "取名「大道」，源于大道至简。复杂的局势、硬核的 AI 与财经，都应该被深入浅出地讲明白。我会常邀硅谷科技大佬、财经专家，带来一手的趋势分析。"
    ],
    "stats": [
      { "value": "15 年", "label": "中美电视与电台主持" },
      { "value": "千集", "label": "评论节目" },
      { "value": "百位", "label": "大咖专访" }
    ]
  },
  "collab": { "eyebrow": "商务合作", "heading": "品牌合作 · 嘉宾邀约", "text": "节目赞助、品牌合作与嘉宾邀约，欢迎来信。" },
  "platforms": [
    { "name": "YouTube", "handle": "@dadaomedia", "url": "https://www.youtube.com/@dadaomedia", "icon": "youtube" },
    { "name": "Apple Podcasts", "handle": "沈琛琛｜大道传媒", "url": "https://podcasts.apple.com/us/podcast/id6791887956", "icon": "applepodcasts" },
    { "name": "Spotify", "handle": "沈琛琛｜大道传媒", "url": "https://open.spotify.com/show/033R7udpl2Dr1qmaoNHATs", "icon": "spotify" },
    { "name": "小红书", "handle": "沈琛琛cici", "icon": "xiaohongshu", "wide": true },
    { "name": "视频号", "handle": "沈琛琛cici", "icon": "wechat" },
    { "name": "抖音", "handle": "沈琛琛Cici", "icon": "tiktok" }
  ]
}
```

- [ ] **Step 4: Implement** — create `scripts/lib/config.mjs`:

```js
// Checks src/site.json so a typo fails the build with a clear message instead of producing a broken page.
const RESERVED = new Set(['top', 'latest', 'shorts', 'about', 'connect']);

export function validateConfig(c) {
  const need = (ok, msg) => { if (!ok) throw new Error(`src/site.json: ${msg}`); };
  need(c && typeof c === 'object', 'must be a JSON object');
  for (const k of ['siteName', 'tagline', 'description', 'email']) need(typeof c[k] === 'string' && c[k].trim(), `"${k}" is required`);
  need(c.email.includes('@'), '"email" must be an email address');
  need(c.host?.name, '"host.name" is required');
  need(c.channel?.id && String(c.channel?.handle || '').startsWith('@'), '"channel.id" and "channel.handle" (starting with @) are required');
  need(Array.isArray(c.shows) && c.shows.length > 0, '"shows" must be a non-empty list');
  const keys = new Set();
  for (const s of c.shows) {
    const name = s.name || s.key || '?';
    need(/^[a-z][a-z0-9-]*$/.test(s.key || ''), `show "${name}": "key" must be lower-case letters/digits (it is the page anchor)`);
    need(!RESERVED.has(s.key), `show "${name}": key "${s.key}" is reserved for another part of the page`);
    need(!keys.has(s.key), `show key "${s.key}" is used twice`);
    keys.add(s.key);
    need(s.playlistId && s.name && s.eyebrow, `show "${name}": "playlistId", "name" and "eyebrow" are required`);
    const sc = s.schedule || {};
    if (sc.type === 'weekly') {
      need(Number.isInteger(sc.weekday) && sc.weekday >= 0 && sc.weekday <= 6, `show "${name}": schedule.weekday must be 0 (Sunday) … 6 (Saturday)`);
      need(/^([01]\d|2[0-3]):[0-5]\d$/.test(sc.time || ''), `show "${name}": schedule.time must look like "18:30"`);
      need(sc.label, `show "${name}": schedule.label is required (for example "每周五")`);
    } else {
      need(sc.type === 'latest', `show "${name}": schedule.type must be "weekly" or "latest"`);
    }
  }
  need(c.shorts?.playlistId && c.shorts?.name, '"shorts.playlistId" and "shorts.name" are required');
  need(Number.isInteger(c.cardsPerShow) && c.cardsPerShow > 0, '"cardsPerShow" must be a positive whole number');
  need(Number.isInteger(c.shortsCount) && c.shortsCount > 0, '"shortsCount" must be a positive whole number');
  need(c.about?.heading && Array.isArray(c.about?.paragraphs), '"about.heading" and "about.paragraphs" are required');
  need(c.collab?.heading, '"collab.heading" is required');
  need(Array.isArray(c.platforms), '"platforms" must be a list');
  for (const p of c.platforms) need(p.name && p.handle && p.icon, `platform "${p.name || '?'}": "name", "handle" and "icon" are required`);
  return c;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `node --test tests/config.test.mjs`
Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/site.json scripts/lib/config.mjs tests/config.test.mjs
git commit -F - <<'EOF'
Add src/site.json for shows, accounts and copy, with validation

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 3: YouTube Data API client

**Files:**
- Create: `scripts/lib/youtube.mjs`
- Test: `tests/youtube.test.mjs`

**Interfaces:**
- Consumes: `parseDuration` from `scripts/lib/format.mjs` (Task 1); the `src/site.json` shape (Task 2).
- Produces:
  - `listPlaylist(playlistId, { key, fetch }) -> Promise<Array<{ videoId, publishedAt }>>` — public items only, newest first.
  - `getVideos(ids, { key, fetch }) -> Promise<Record<id, Video>>` where `Video = { id, title, description, publishedAt, durationSec, views, thumb, thumbLarge }` — public, already-published videos only.
  - `fetchChannelData(config, { key, fetch, now }) -> Promise<{ fetchedAt, playlists: Record<playlistId, Array<{videoId, publishedAt}>>, videos: Record<id, Video> }>` — this object is also the format of `tests/fixtures/channel.json`.

- [ ] **Step 1: Write the failing tests** — create `tests/youtube.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listPlaylist, getVideos, fetchChannelData } from '../scripts/lib/youtube.mjs';

// Routes are keyed "<endpoint>:<playlistId or id list>:<pageToken>".
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const key = `${u.pathname.split('/').pop()}:${u.searchParams.get('playlistId') || u.searchParams.get('id')}:${u.searchParams.get('pageToken') || ''}`;
    const r = routes[key];
    if (!r) return new Response(JSON.stringify({ error: { message: `no route ${key}`, errors: [{ reason: 'test' }] } }), { status: 404 });
    return new Response(JSON.stringify(r.body ?? r), { status: r.status ?? 200 });
  };
  return { impl, calls };
}
const item = (videoId, publishedAt, privacyStatus = 'public') =>
  ({ contentDetails: { videoId, ...(publishedAt && { videoPublishedAt: publishedAt }) }, status: { privacyStatus } });
const video = (id, extra = {}) => ({
  id,
  snippet: { title: `t-${id}`, description: `d-${id}`, publishedAt: '2026-11-01T00:00:00Z', liveBroadcastContent: 'none',
    thumbnails: { high: { url: `h-${id}` }, standard: { url: `s-${id}` }, maxres: { url: `m-${id}` } } },
  contentDetails: { duration: 'PT1M5S' },
  statistics: { viewCount: '1234' },
  status: { privacyStatus: 'public' },
  ...extra,
});

test('listPlaylist follows pages, keeps public items only and sorts newest first', async () => {
  const { impl, calls } = fakeFetch({
    'playlistItems:PL1:': { items: [item('a', '2026-10-01T00:00:00Z'), item('p', null, 'private')], nextPageToken: 'n2' },
    'playlistItems:PL1:n2': { items: [item('b', '2026-11-01T00:00:00Z'), item('u', '2026-11-02T00:00:00Z', 'unlisted')] },
  });
  const out = await listPlaylist('PL1', { key: 'K', fetch: impl });
  assert.deepEqual(out, [{ videoId: 'b', publishedAt: '2026-11-01T00:00:00Z' }, { videoId: 'a', publishedAt: '2026-10-01T00:00:00Z' }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get('key'), 'K');
  assert.equal(calls[0].searchParams.get('part'), 'contentDetails,status');
});

test('getVideos batches 50 ids per call, maps fields and skips non-public or upcoming videos', async () => {
  const ids = Array.from({ length: 51 }, (_, i) => `v${i}`);
  const { impl, calls } = fakeFetch({
    [`videos:${ids.slice(0, 50).join(',')}:`]: { items: [video('v0'), video('v1', { status: { privacyStatus: 'private' } }),
      video('v2', { snippet: { ...video('v2').snippet, liveBroadcastContent: 'upcoming' } })] },
    'videos:v50:': { items: [video('v50', { snippet: { ...video('v50').snippet, thumbnails: { high: { url: 'h-v50' } } } })] },
  });
  const out = await getVideos(ids, { key: 'K', fetch: impl });
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(out).sort(), ['v0', 'v50']);
  assert.deepEqual(out.v0, { id: 'v0', title: 't-v0', description: 'd-v0', publishedAt: '2026-11-01T00:00:00Z', durationSec: 65, views: 1234, thumb: 's-v0', thumbLarge: 'm-v0' });
  assert.equal(out.v50.thumb, 'h-v50');
  assert.equal(out.v50.thumbLarge, 'h-v50');
});

test('fetchChannelData reads every configured playlist and the details of their videos', async () => {
  const config = { shows: [{ playlistId: 'PA' }, { playlistId: 'PB' }], shorts: { playlistId: 'PS' } };
  const { impl } = fakeFetch({
    'playlistItems:PA:': { items: [item('a', '2026-10-01T00:00:00Z')] },
    'playlistItems:PB:': { items: [item('b', '2026-10-02T00:00:00Z')] },
    'playlistItems:PS:': { items: [item('a', '2026-10-01T00:00:00Z')] },
    'videos:a,b:': { items: [video('a'), video('b')] },
  });
  const data = await fetchChannelData(config, { key: 'K', fetch: impl, now: new Date('2026-11-09T00:00:00Z') });
  assert.equal(data.fetchedAt, '2026-11-09T00:00:00.000Z');
  assert.deepEqual(Object.keys(data.playlists), ['PA', 'PB', 'PS']);
  assert.deepEqual(Object.keys(data.videos), ['a', 'b']);
});

test('a missing key and an API error both stop with a readable message', async () => {
  await assert.rejects(fetchChannelData({ shows: [], shorts: {} }, { key: '' }), /YOUTUBE_API_KEY is not set/);
  const { impl } = fakeFetch({ 'playlistItems:PX:': { status: 403, body: { error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } } } });
  await assert.rejects(listPlaylist('PX', { key: 'K', fetch: impl }), /HTTP 403 \(quotaExceeded\)/);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/youtube.test.mjs`
Expected: FAIL — `Cannot find module '.../scripts/lib/youtube.mjs'`.

- [ ] **Step 3: Implement** — create `scripts/lib/youtube.mjs`:

```js
// Reads the channel's public videos from the YouTube Data API v3. All network access goes through the
// injected `fetch`, so tests run offline. Quota: about 1 unit per 50 playlist items plus 1 per 50 videos.
import { parseDuration } from './format.mjs';

const API = 'https://www.googleapis.com/youtube/v3';
const MAX_PAGES = 20; // 50 items per page; a safety stop, not an expected size

async function call(fetchImpl, key, endpoint, params) {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetchImpl(`${API}/${endpoint}?${qs}`, { signal: AbortSignal.timeout(20000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || 'unknown';
    throw new Error(`YouTube API ${endpoint} -> HTTP ${res.status} (${reason}) ${body?.error?.message || ''}`.trim());
  }
  return body;
}

/** Public items of a playlist, newest first. Private/unlisted/scheduled items have no videoPublishedAt or a non-public status. */
export async function listPlaylist(playlistId, { key, fetch: fetchImpl = fetch }) {
  const out = [];
  let pageToken;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await call(fetchImpl, key, 'playlistItems', {
      part: 'contentDetails,status', playlistId, maxResults: '50', ...(pageToken && { pageToken }),
    });
    for (const it of body.items || []) {
      const publishedAt = it.contentDetails?.videoPublishedAt;
      if (it.status?.privacyStatus === 'public' && publishedAt) out.push({ videoId: it.contentDetails.videoId, publishedAt });
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Details keyed by id. Skips videos that are not public or not watchable yet (upcoming premieres, live streams). */
export async function getVideos(ids, { key, fetch: fetchImpl = fetch }) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const body = await call(fetchImpl, key, 'videos', {
      part: 'snippet,contentDetails,statistics,status', id: ids.slice(i, i + 50).join(','), maxResults: '50',
    });
    for (const v of body.items || []) {
      if (v.status?.privacyStatus !== 'public' || (v.snippet?.liveBroadcastContent || 'none') !== 'none') continue;
      const t = v.snippet.thumbnails || {};
      const fallback = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
      out[v.id] = {
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description || '',
        publishedAt: v.snippet.publishedAt,
        durationSec: parseDuration(v.contentDetails?.duration),
        views: Number(v.statistics?.viewCount || 0),
        thumb: (t.standard || t.high || t.medium || t.default)?.url || fallback,
        thumbLarge: (t.maxres || t.standard || t.high)?.url || fallback,
      };
    }
  }
  return out;
}

/** Everything the page needs as plain JSON (also the format of tests/fixtures/channel.json). */
export async function fetchChannelData(config, { key, fetch: fetchImpl = fetch, now = new Date() } = {}) {
  if (!key) {
    throw new Error('YOUTUBE_API_KEY is not set. Add it in Vercel (Settings → Environment Variables), or put YOUTUBE_API_KEY=... in .env.local for a local build.');
  }
  const playlists = {};
  for (const id of [...config.shows.map((s) => s.playlistId), config.shorts.playlistId]) {
    playlists[id] = await listPlaylist(id, { key, fetch: fetchImpl });
  }
  const ids = [...new Set(Object.values(playlists).flat().map((p) => p.videoId))];
  const videos = await getVideos(ids, { key, fetch: fetchImpl });
  return { fetchedAt: now.toISOString(), playlists, videos };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/youtube.test.mjs`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/youtube.mjs tests/youtube.test.mjs
git commit -F - <<'EOF'
Add YouTube Data API client (public videos only, paged and batched)

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 4: Page model

**Files:**
- Create: `scripts/lib/model.mjs`
- Test: `tests/model.test.mjs`

**Interfaces:**
- Consumes: `cleanTitle, firstParagraph, formatDuration, formatViews, formatDate, nextWeekly` (Task 1); `src/site.json` shape (Task 2); data shape from `fetchChannelData` (Task 3).
- Produces: `buildModel(config, data, now = new Date())` returning

```
{
  channelUrl: "https://www.youtube.com/@dadaomedia",
  subscribeUrl: "https://www.youtube.com/@dadaomedia?sub_confirmation=1",
  latest: Card & { thumbLarge, description } | null,
  shows: [ { ...showConfig, url, total, cards: Card[], fillerSpan: number, airing: { label, value, note } | null } ],
  shorts: { ...shortsConfig, url, cards: [ { id, url, title, thumb, views } ] },
}
Card = { id, url, title, thumb, duration, date, views, publishedAt, ep, showKey, showName }
```

- [ ] **Step 1: Write the failing tests** — create `tests/model.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../scripts/lib/model.mjs';

const config = {
  channel: { handle: '@dadaomedia' },
  shows: [
    { key: 'a', playlistId: 'PA', name: '节目A', eyebrow: 'A 小标题', schedule: { type: 'weekly', weekday: 5, time: '18:30', label: '每周五' } },
    { key: 'b', playlistId: 'PB', name: '节目B', eyebrow: 'B 小标题', schedule: { type: 'latest' } },
  ],
  shorts: { playlistId: 'PS', name: '短视频', eyebrow: '一分钟看懂' },
  cardsPerShow: 4,
  shortsCount: 2,
};
const v = (id, publishedAt) => ({ id, title: `${id} 标题｜沈琛琛`, description: `${id} 第一段\n\n第二段`, publishedAt,
  durationSec: 1548, views: 31234, thumb: `t-${id}`, thumbLarge: `T-${id}` });
const data = {
  playlists: {
    PA: [{ videoId: 'a3', publishedAt: '2026-11-07T02:30:00Z' }, { videoId: 'a2', publishedAt: '2026-10-31T01:30:00Z' },
      { videoId: 'gone', publishedAt: '2026-10-25T01:30:00Z' }, { videoId: 'a1', publishedAt: '2026-10-24T01:30:00Z' }],
    PB: [{ videoId: 'b1', publishedAt: '2026-10-19T01:30:00Z' }, { videoId: 'b2', publishedAt: '2026-11-02T02:00:00Z' }],
    PS: [{ videoId: 's1', publishedAt: '2026-11-05T00:00:00Z' }, { videoId: 's2', publishedAt: '2026-11-04T00:00:00Z' }, { videoId: 's3', publishedAt: '2026-11-03T00:00:00Z' }],
  },
  videos: Object.fromEntries([
    v('a1', '2026-10-24T01:30:00Z'), v('a2', '2026-10-31T01:30:00Z'), v('a3', '2026-11-07T02:30:00Z'),
    v('b1', '2026-10-19T01:30:00Z'), v('b2', '2026-11-02T02:00:00Z'),
    v('s1', '2026-11-05T00:00:00Z'), v('s2', '2026-11-04T00:00:00Z'), v('s3', '2026-11-03T00:00:00Z'),
  ].map((x) => [x.id, x])),
};
const now = new Date('2026-11-09T20:00:00Z');

test('latest is the newest public show video, with description and large thumbnail', () => {
  const m = buildModel(config, data, now);
  assert.equal(m.latest.id, 'a3');
  assert.equal(m.latest.title, 'a3 标题');
  assert.equal(m.latest.ep, 3);
  assert.equal(m.latest.showName, '节目A');
  assert.equal(m.latest.date, '11月6日');
  assert.equal(m.latest.duration, '25:48');
  assert.equal(m.latest.views, '3.1万次观看');
  assert.equal(m.latest.description, 'a3 第一段');
  assert.equal(m.latest.thumbLarge, 'T-a3');
  assert.equal(m.subscribeUrl, 'https://www.youtube.com/@dadaomedia?sub_confirmation=1');
});

test('episode numbers skip videos that are no longer public; latest is not repeated in its show row', () => {
  const m = buildModel(config, data, now);
  const a = m.shows.find((s) => s.key === 'a');
  assert.equal(a.total, 3);
  assert.deepEqual(a.cards.map((c) => [c.id, c.ep]), [['a2', 2], ['a1', 1]]);
  assert.equal(a.fillerSpan, 2);
  assert.equal(a.url, 'https://www.youtube.com/playlist?list=PA');
});

test('playlist order does not matter: cards are sorted by publish date', () => {
  const b = buildModel(config, data, now).shows.find((s) => s.key === 'b');
  assert.deepEqual(b.cards.map((c) => [c.id, c.ep]), [['b2', 2], ['b1', 1]]);
});

test('weekly shows get the next air date; latest-type shows get their newest episode', () => {
  const m = buildModel(config, data, now);
  assert.deepEqual(m.shows[0].airing, { label: '每周五', value: '18:30', note: '下一期 11月13日 · 美西时间' });
  assert.deepEqual(m.shows[1].airing, { label: '最新一期', value: '11月1日', note: 'B 小标题 · 第2期' });
  const friday = buildModel(config, data, new Date('2026-11-14T01:00:00Z'));
  assert.equal(friday.shows[0].airing.note, '今天 18:30 上线 · 美西时间');
});

test('shorts are limited to shortsCount, newest first', () => {
  const m = buildModel(config, data, now);
  assert.deepEqual(m.shorts.cards.map((c) => c.id), ['s1', 's2']);
  assert.equal(m.shorts.cards[0].url, 'https://www.youtube.com/shorts/s1');
  assert.equal(m.shorts.url, 'https://www.youtube.com/@dadaomedia/shorts');
});

test('no public show videos means no latest', () => {
  const empty = { playlists: { PA: [], PB: [], PS: [] }, videos: {} };
  const m = buildModel(config, empty, now);
  assert.equal(m.latest, null);
  assert.equal(m.shows[1].airing, null);
  assert.equal(m.shows[0].fillerSpan, 4);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/model.test.mjs`
Expected: FAIL — `Cannot find module '.../scripts/lib/model.mjs'`.

- [ ] **Step 3: Implement** — create `scripts/lib/model.mjs`:

```js
// Turns src/site.json plus the fetched YouTube data into what the page shows. Pure: no I/O; `now` is passed in.
import { cleanTitle, firstParagraph, formatDuration, formatViews, formatDate, nextWeekly } from './format.mjs';

export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const shortUrl = (id) => `https://www.youtube.com/shorts/${id}`;
export const playlistUrl = (id) => `https://www.youtube.com/playlist?list=${id}`;

const newestFirst = (a, b) => b.publishedAt.localeCompare(a.publishedAt);

export function buildModel(config, data, now = new Date()) {
  const channelUrl = `https://www.youtube.com/${config.channel.handle}`;
  const subscribeUrl = `${channelUrl}?sub_confirmation=1`;
  const publicIn = (playlistId) => (data.playlists[playlistId] || []).filter((p) => data.videos[p.videoId]).sort(newestFirst);
  const card = (v, extra) => ({
    id: v.id, url: watchUrl(v.id), title: cleanTitle(v.title), thumb: v.thumb,
    duration: formatDuration(v.durationSec), date: formatDate(v.publishedAt, now), views: formatViews(v.views),
    publishedAt: v.publishedAt, ...extra,
  });

  const shows = config.shows.map((s) => {
    const items = publicIn(s.playlistId);
    const all = items.map((p, i) => card(data.videos[p.videoId], { ep: items.length - i, showKey: s.key, showName: s.name }));
    return { ...s, url: playlistUrl(s.playlistId), total: all.length, all };
  });

  const newest = shows.flatMap((s) => s.all).sort(newestFirst)[0];
  const latest = newest
    ? { ...newest, thumbLarge: data.videos[newest.id].thumbLarge, description: firstParagraph(data.videos[newest.id].description) }
    : null;

  for (const s of shows) {
    s.airing = airing(s, now);
    s.cards = s.all.filter((c) => !latest || c.id !== latest.id).slice(0, config.cardsPerShow);
    s.fillerSpan = Math.max(0, config.cardsPerShow - s.cards.length);
    delete s.all;
  }

  const shortsCards = publicIn(config.shorts.playlistId).slice(0, config.shortsCount).map((p) => {
    const v = data.videos[p.videoId];
    return { id: v.id, url: shortUrl(v.id), title: cleanTitle(v.title), thumb: v.thumb, views: formatViews(v.views) };
  });

  return { channelUrl, subscribeUrl, latest, shows, shorts: { ...config.shorts, url: `${channelUrl}/shorts`, cards: shortsCards } };
}

// The schedule strip line for one show. 硅谷C位 has no fixed day, so it shows its newest episode instead of a frequency.
function airing(show, now) {
  const sc = show.schedule;
  if (sc.type === 'weekly') {
    const next = nextWeekly(sc.weekday, sc.time, now);
    return { label: sc.label, value: sc.time, note: next === '今天' ? `今天 ${sc.time} 上线 · 美西时间` : `下一期 ${next} · 美西时间` };
  }
  const newest = show.all[0];
  return newest ? { label: '最新一期', value: newest.date, note: `${show.eyebrow} · 第${newest.ep}期` } : null;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/model.test.mjs`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/model.mjs tests/model.test.mjs
git commit -F - <<'EOF'
Add page model: latest episode, show rows, episode numbers, schedule lines

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 5: HTML renderers

**Files:**
- Create: `scripts/lib/render.mjs`
- Test: `tests/render.test.mjs`

**Interfaces:**
- Consumes: the model from Task 4; `src/site.json` shape (Task 2); an icons object `{ [name]: svgPathData }` (created in Task 6).
- Produces (all return strings, all pure):
  - `esc(s)`
  - `fillTemplate(template, values: Record<NAME, string>)` — throws on a `{{NAME}}` without a value.
  - `renderNav(model, config)`, `renderLatest(latest, model)`, `renderSchedule(model)`, `renderShows(model)`, `renderShorts(model)`, `renderAbout(config, model, photoDataUri)`, `renderConnect(config, icons)`, `seoHead(config, { siteUrl, assetBase })`.

- [ ] **Step 1: Write the failing tests** — create `tests/render.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, fillTemplate, renderNav, renderLatest, renderSchedule, renderShows, renderShorts, renderConnect, seoHead } from '../scripts/lib/render.mjs';

const latest = { id: 'abc', url: 'https://www.youtube.com/watch?v=abc', title: '涨了10倍<不敢卖>"?', thumb: 't', thumbLarge: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
  duration: '25:48', date: '11月6日', views: '5,958 次观看', ep: 6, showKey: 'finance', showName: '财经脱口秀', description: '第一段 & 更多' };
const model = {
  subscribeUrl: 'https://www.youtube.com/@dadaomedia?sub_confirmation=1',
  latest,
  shows: [
    { key: 'finance', name: '财经脱口秀', eyebrow: '北美财经干货', sub: '退休精算', url: 'https://www.youtube.com/playlist?list=PA', total: 6,
      cards: [{ ...latest, id: 'k', url: 'https://www.youtube.com/watch?v=k', title: '401k', ep: 5 }], fillerSpan: 0,
      airing: { label: '每周五', value: '18:30', note: '下一期 11月13日 · 美西时间' } },
    { key: 'cwei', name: '硅谷C位', eyebrow: 'AI 与科技访谈', sub: '', url: 'https://www.youtube.com/playlist?list=PB', total: 2,
      cards: [{ ...latest, id: 'w', ep: 2 }, { ...latest, id: 'o', ep: 1 }], fillerSpan: 2,
      airing: { label: '最新一期', value: '11月1日', note: 'AI 与科技访谈 · 第2期' } },
  ],
  shorts: { name: '短视频', eyebrow: '一分钟看懂', url: 'https://www.youtube.com/@dadaomedia/shorts',
    cards: [{ id: 's1', url: 'https://www.youtube.com/shorts/s1', title: 'Roth?', thumb: 'st', views: '163 次观看' }] },
};
const config = { siteName: '大道传媒 Shen Studio', description: '描述', host: { name: '沈琛琛', alternateName: 'Cici Shen' },
  channel: { handle: '@dadaomedia' }, email: 'chenchenshentv@gmail.com',
  collab: { eyebrow: '商务合作', heading: '品牌合作 · 嘉宾邀约', text: '欢迎来信。' },
  platforms: [{ name: 'YouTube', handle: '@dadaomedia', url: 'https://www.youtube.com/@dadaomedia', icon: 'youtube' },
    { name: '小红书', handle: '沈琛琛cici', icon: 'xiaohongshu', wide: true }] };
const icons = { youtube: 'M1 1h22', xiaohongshu: 'M2 2h20' };

test('esc escapes HTML special characters', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('fillTemplate replaces placeholders and refuses unknown ones', () => {
  assert.equal(fillTemplate('<p>{{A}} {{B_C}}</p>', { A: '1', B_C: '$&2' }), '<p>1 $&2</p>');
  assert.throws(() => fillTemplate('{{MISSING}}', {}), /\{\{MISSING\}\}/);
});

test('renderNav links every show and the fixed sections', () => {
  const html = renderNav(model, config);
  for (const href of ['#latest', '#finance', '#cwei', '#shorts', '#about', '#connect']) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(html.includes('关于沈琛琛'));
});

test('renderLatest builds a click-to-load player with escaped srcdoc and escaped title', () => {
  const html = renderLatest(latest, model);
  assert.match(html, /<iframe class="player"[^>]* srcdoc="[^"<]*youtube-nocookie\.com\/embed\/abc\?autoplay=1/);
  assert.ok(!/srcdoc="[^"]*</.test(html), 'srcdoc attribute contains no raw <');
  assert.ok(html.includes('涨了10倍&lt;不敢卖&gt;&quot;?'));
  assert.ok(html.includes('财经脱口秀 · 第6期'));
  assert.ok(html.includes('第一段 &amp; 更多'));
  assert.ok(html.includes(model.subscribeUrl));
});

test('renderSchedule shows one cell per show plus the subscribe cell', () => {
  const html = renderSchedule(model);
  assert.ok(html.includes('<strong>18:30</strong>') && html.includes('下一期 11月13日 · 美西时间'));
  assert.ok(html.includes('<span>最新一期</span><strong>11月1日</strong>') && html.includes('AI 与科技访谈 · 第2期'));
  assert.ok(!html.includes('不定期'));
  assert.ok(html.includes('订阅并打开小铃铛'));
});

test('renderShows writes cards, the 全部 link and a filler spanning the empty columns', () => {
  const html = renderShows(model);
  assert.ok(html.includes('id="finance"') && html.includes('id="cwei"'));
  assert.ok(html.includes('全部 6 期 →') && html.includes('全部 2 期 →'));
  assert.ok(html.includes('第5期 · 11月6日 · 5,958 次观看'));
  assert.equal((html.match(/class="next"/g) || []).length, 1);
  assert.ok(html.includes('style="--span:2"'));
});

test('renderShorts writes vertical cards and returns nothing when there are none', () => {
  assert.ok(renderShorts(model).includes('href="https://www.youtube.com/shorts/s1"'));
  assert.equal(renderShorts({ ...model, shorts: { ...model.shorts, cards: [] } }), '');
});

test('renderConnect links platforms that have a URL and shows the others as text', () => {
  const html = renderConnect(config, icons);
  assert.ok(html.includes('<a class="tile" href="https://www.youtube.com/@dadaomedia">'));
  assert.ok(html.includes('<div class="tile">') && html.includes('沈琛琛cici'));
  assert.ok(html.includes('class="wide"'));
  assert.ok(html.includes('mailto:chenchenshentv@gmail.com'));
  assert.throws(() => renderConnect({ ...config, platforms: [{ name: 'X', handle: 'x', icon: 'nope' }] }, icons), /icons\.json has no icon "nope"/);
});

test('seoHead is noindex without SITE_URL and canonical with it', () => {
  assert.ok(seoHead(config, {}).includes('<meta name="robots" content="noindex, nofollow">'));
  const live = seoHead(config, { siteUrl: 'https://example.com', assetBase: 'https://example.com' });
  assert.ok(live.includes('<link rel="canonical" href="https://example.com/">'));
  assert.ok(live.includes('content="https://example.com/og.jpg"'));
  assert.ok(live.includes('"sameAs":["https://www.youtube.com/@dadaomedia"]'));
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/render.test.mjs`
Expected: FAIL — `Cannot find module '.../scripts/lib/render.mjs'`.

- [ ] **Step 3: Implement** — create `scripts/lib/render.mjs`:

```js
// Turns the page model into the HTML fragments that fill src/index.template.html. Pure: no I/O.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"></path></svg>';
const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>';
const MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>';

/** Replaces every {{NAME}}; throws when the template asks for a value that was not given. */
export function fillTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => {
    if (!(name in values)) throw new Error(`template placeholder {{${name}}} has no value`);
    return values[name];
  });
}

export function renderNav(model, config) {
  const links = [['latest', '最新'], ...model.shows.map((s) => [s.key, s.name]), ['shorts', model.shorts.name], ['about', `关于${config.host.name}`], ['connect', '合作']];
  return links.map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join('\n      ');
}

// The document inside the player iframe: the thumbnail and a play button; clicking loads the real YouTube player.
// Its colors are literals because an iframe document cannot read the parent page's CSS variables.
function playerSrcdoc(v) {
  const css = '*{margin:0;padding:0}html,body{height:100%;overflow:hidden;background:#0A0E0F}'
    + 'a{position:absolute;inset:0;display:block}img{width:100%;height:100%;object-fit:cover}'
    + 'b{position:absolute;left:18px;bottom:18px;width:64px;height:64px;border-radius:50%;background:#C62828;box-shadow:0 6px 20px rgba(10,14,15,.3)}'
    + 'b::after{content:"";position:absolute;left:25px;top:20px;border-style:solid;border-width:12px 0 12px 19px;border-color:transparent transparent transparent #fff}'
    + 'a:hover b{background:#A61F1F}'
    + 'i{position:absolute;right:10px;bottom:10px;padding:1px 6px;border-radius:4px;background:rgba(10,14,15,.78);color:#fff;font:12px/1.5 system-ui,sans-serif;font-style:normal}'
    + '@media (max-width:560px){b{left:12px;bottom:12px;width:52px;height:52px}b::after{left:20px;top:16px;border-width:10px 0 10px 16px}}';
  const embed = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0`;
  return `<meta name="referrer" content="strict-origin-when-cross-origin"><style>${css}</style>`
    + `<a href="${esc(embed)}" aria-label="播放：${esc(v.title)}"><img src="${esc(v.thumbLarge)}" alt=""><b></b><i>${esc(v.duration)}</i></a>`;
}

export function renderLatest(v, model) {
  return `<iframe class="player" title="${esc(v.title)}" srcdoc="${esc(playerSrcdoc(v))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  <div class="latest-text">
    <p class="kicker"><span class="tag-new">最新一期</span><span>${esc(v.showName)} · 第${v.ep}期</span></p>
    <h2 class="latest-title">${esc(v.title)}</h2>
    <p class="meta"><span class="nw">${esc(v.date)}</span> · <span class="nw">${esc(v.duration)}</span> · <span class="nw">${esc(v.views)}</span></p>${v.description ? `
    <p class="desc">${esc(v.description)}</p>` : ''}
    <div class="actions">
      <a class="btn btn-red" href="${esc(v.url)}">${PLAY}在 YouTube 观看</a>
      <a class="btn btn-ghost" href="${esc(model.subscribeUrl)}">订阅频道</a>
    </div>
  </div>`;
}

export function renderSchedule(model) {
  const cells = model.shows.filter((s) => s.airing).map((s) => `<div class="sched-item">
      <div class="when"><span>${esc(s.airing.label)}</span><strong>${esc(s.airing.value)}</strong></div>
      <div><div class="sched-show">${esc(s.name)}</div><div class="meta">${esc(s.airing.note)}</div></div>
    </div>`);
  cells.push(`<a class="sched-item" href="${esc(model.subscribeUrl)}">
      ${BELL}
      <div><div class="sched-show">订阅并打开小铃铛</div><div class="meta">新节目上线第一时间通知你</div></div>
    </a>`);
  return cells.join('\n    ');
}

function card(c) {
  return `<a class="card" href="${esc(c.url)}">
      <span class="thumb"><img src="${esc(c.thumb)}" alt="" width="640" height="360" loading="lazy"><span class="dur">${esc(c.duration)}</span></span>
      <span class="card-title">${esc(c.title)}</span>
      <span class="card-meta">第${c.ep}期 · ${esc(c.date)} · ${esc(c.views)}</span>
    </a>`;
}

function filler(span, model) {
  return `<div class="next" style="--span:${span}">
      <p class="eyebrow">下一期</p>
      <p class="next-when">新一期上线，第一时间通知你</p>
      <p class="meta">订阅频道并打开小铃铛</p>
      <a class="btn btn-red" href="${esc(model.subscribeUrl)}">订阅，开播提醒</a>
    </div>`;
}

export function renderShows(model) {
  return model.shows.map((s) => `<section id="${esc(s.key)}" class="wrap shelf">
  <div class="shelf-head">
    <div>
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.name)}</h2>${s.sub ? `
      <p class="sub">${esc(s.sub)}</p>` : ''}
    </div>${s.total ? `
    <a class="more" href="${esc(s.url)}">全部 ${s.total} 期 →</a>` : ''}
  </div>
  <div class="cards">
    ${[...s.cards.map(card), ...(s.fillerSpan ? [filler(s.fillerSpan, model)] : [])].join('\n    ')}
  </div>
</section>`).join('\n\n');
}

export function renderShorts(model) {
  const sh = model.shorts;
  if (!sh.cards.length) return '';
  return `<section id="shorts" class="wrap shelf">
  <div class="shelf-head">
    <div>
      <p class="eyebrow">${esc(sh.eyebrow)}</p>
      <h2>${esc(sh.name)}</h2>
    </div>
    <a class="more" href="${esc(sh.url)}">看更多 →</a>
  </div>
  <div class="cards shorts">
    ${sh.cards.map((c) => `<a class="card" href="${esc(c.url)}"><span class="thumb"><img src="${esc(c.thumb)}" alt="" width="360" height="640" loading="lazy"></span><span class="card-title">${esc(c.title)}</span><span class="card-meta">${esc(c.views)}</span></a>`).join('\n    ')}
  </div>
</section>`;
}

export function renderAbout(config, model, photo) {
  const a = config.about;
  return `<img class="host" src="${esc(photo)}" alt="${esc(config.host.name)} ${esc(config.host.alternateName || '')}" width="720" height="1080" loading="lazy">
  <div class="about-text">
    <p class="eyebrow">${esc(a.eyebrow)}</p>
    <h2>${esc(a.heading)}</h2>
    ${a.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n    ')}${a.stats?.length ? `
    <dl class="stats">
      ${a.stats.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('\n      ')}
    </dl>` : ''}
    <div><a class="btn btn-red" href="${esc(model.subscribeUrl)}">${PLAY}订阅「大道」</a></div>
  </div>`;
}

function icon(icons, name, wide) {
  const d = icons[name];
  if (!d) throw new Error(`src/icons.json has no icon "${name}"`);
  return `<svg${wide ? ' class="wide"' : ''} viewBox="0 0 24 24" aria-hidden="true"><path d="${esc(d)}" fill="currentColor"></path></svg>`;
}

export function renderConnect(config, icons) {
  const c = config.collab;
  const tiles = config.platforms.map((p) => {
    const inner = `<span class="tile-icon">${icon(icons, p.icon, p.wide)}</span><span class="tile-text"><span class="tile-name">${esc(p.name)}${p.url ? ' ↗' : ''}</span><span class="tile-handle">${esc(p.handle)}</span></span>`;
    return p.url ? `<li><a class="tile" href="${esc(p.url)}">${inner}</a></li>` : `<li><div class="tile">${inner}</div></li>`;
  });
  return `<div class="collab">
      <p class="eyebrow">${esc(c.eyebrow)}</p>
      <h2>${esc(c.heading)}</h2>
      <p class="sub">${esc(c.text)}</p>
      <a class="mail" href="mailto:${esc(config.email)}">${MAIL}${esc(config.email)}</a>
    </div>
    <div class="follow">
      <p class="eyebrow">在其他平台关注${esc(config.host.name)}</p>
      <ul class="tiles">
        ${tiles.join('\n        ')}
      </ul>
    </div>`;
}

export function seoHead(config, { siteUrl = '', assetBase = '' } = {}) {
  const id = (frag) => `${siteUrl}/#${frag}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': id('org'), name: config.siteName, ...(siteUrl && { url: `${siteUrl}/` }), sameAs: config.platforms.filter((p) => p.url).map((p) => p.url) },
      { '@type': 'Person', '@id': id('host'), name: config.host.name, alternateName: config.host.alternateName, worksFor: { '@id': id('org') }, sameAs: [`https://www.youtube.com/${config.channel.handle}`] },
    ],
  };
  const meta = (attr, key, val) => `<meta ${attr}="${key}" content="${esc(val)}">`;
  return [
    `<title>${esc(config.siteName)}</title>`,
    meta('name', 'description', config.description),
    siteUrl ? `<link rel="canonical" href="${esc(siteUrl)}/">` : '<meta name="robots" content="noindex, nofollow">',
    '<link rel="icon" type="image/png" href="/favicon.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', config.siteName),
    meta('property', 'og:locale', 'zh_CN'),
    meta('property', 'og:title', config.siteName),
    meta('property', 'og:description', config.description),
    ...(siteUrl ? [meta('property', 'og:url', `${siteUrl}/`)] : []),
    meta('property', 'og:image', `${assetBase}/og.jpg`),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('name', 'twitter:card', 'summary_large_image'),
    `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/render.test.mjs`
Expected: all 10 tests PASS. (The `seoHead` sameAs assertion uses the test config's single platform with a URL.)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render.mjs tests/render.test.mjs
git commit -F - <<'EOF'
Add HTML renderers: click-to-load player, schedule, show rows, shorts, platforms, SEO head

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 6: Images and platform icons

**Files:**
- Create: `assets/banners/youtube_banner_2026-11_2048x1152.jpg`, `assets/banners/hero_strip_mobile.jpg`, `assets/brand/logo_horizontal_white.png`, `assets/photos/host_about.jpg`, `src/icons.json`
- Modify (overwrite): `assets/banners/hero_strip.jpg`, `public/og.jpg`

**Interfaces:**
- Consumes: `assets/brand/logo_horizontal.png`, `assets/photos/host_photo_full.jpg` (existing).
- Produces: the five image files above (exact sizes below) and `src/icons.json` = `{ "_source": "...", "youtube": "<path d>", "applepodcasts": "…", "spotify": "…", "xiaohongshu": "…", "wechat": "…", "tiktok": "…" }`, used by `renderConnect` (Task 5) and `scripts/build.mjs` (Task 7).

- [ ] **Step 1: Cut the images** (run from the repo root; the banner URL is her current channel banner at full size):

```bash
python -I -X utf8 - "$(pwd)" <<'EOF'
import os, sys, urllib.request
from PIL import Image
ROOT = sys.argv[1]
p = lambda f: os.path.join(ROOT, f)
URL = 'https://yt3.googleusercontent.com/ftogIR_awR_de_Tzrc3fdxGPFQG40ItfFBLmfGlcVdT8Qn4XexUMJhzsUXFOOroDImThBa3GVw=s0'
urllib.request.urlretrieve(URL, p('assets/banners/youtube_banner_2026-11_2048x1152.jpg'))
full = Image.open(p('assets/banners/youtube_banner_2026-11_2048x1152.jpg')).convert('RGB')
assert full.size == (2048, 1152), full.size
strip = full.crop((0, 407, 2048, 745))                    # the centre band YouTube shows on desktop
strip.save(p('assets/banners/hero_strip.jpg'), quality=82, optimize=True, progressive=True)
x0 = round((2048 - 2048 * 1546 / 2560) / 2)               # YouTube's mobile-safe area: 1546/2560 of the width
strip.crop((x0, 0, 2048 - x0, 338)).save(p('assets/banners/hero_strip_mobile.jpg'), quality=82, optimize=True, progressive=True)
full.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652)).save(p('public/og.jpg'), quality=85, optimize=True)
logo = Image.open(p('assets/brand/logo_horizontal.png')).convert('RGBA')
px = logo.load()
for y in range(logo.size[1]):
    for x in range(logo.size[0]):
        r, g, b, a = px[x, y]
        if a and not (r > 120 and r - max(g, b) > 60):    # everything except the red S mark becomes white
            px[x, y] = (255, 255, 255, a)
logo.save(p('assets/brand/logo_horizontal_white.png'))
host = Image.open(p('assets/photos/host_photo_full.jpg')).convert('RGB')
host.thumbnail((720, 1080), Image.LANCZOS)
host.save(p('assets/photos/host_about.jpg'), quality=80, optimize=True, progressive=True)
for f in ['assets/banners/hero_strip.jpg', 'assets/banners/hero_strip_mobile.jpg', 'public/og.jpg',
          'assets/brand/logo_horizontal_white.png', 'assets/photos/host_about.jpg']:
    print(f, Image.open(p(f)).size, os.path.getsize(p(f)), 'bytes')
EOF
```

Expected output (sizes in bytes will vary a little):
```
assets/banners/hero_strip.jpg (2048, 338) ~80000 bytes
assets/banners/hero_strip_mobile.jpg (1237, 338) ~60000 bytes
public/og.jpg (1200, 630) ~90000 bytes
assets/brand/logo_horizontal_white.png (377, 96) ~20000 bytes
assets/photos/host_about.jpg (720, 1080) ~60000 bytes
```

- [ ] **Step 2: Look at the results** — open `assets/banners/hero_strip.jpg`, `assets/banners/hero_strip_mobile.jpg`, `public/og.jpg` and `assets/brand/logo_horizontal_white.png` (Read tool). Check: the strip shows 「大道 / 看清大趋势 过好小日子 / 来自硅谷的财经·科技·商业洞察」 and her portrait uncut; the mobile crop keeps all three text lines; the white logo has a red S and white text.

- [ ] **Step 3: Write `src/icons.json`** from Simple Icons (CC0):

```bash
node --input-type=module -e "
import { writeFileSync } from 'node:fs';
const V = '16.37.0';
const out = { _source: 'Simple Icons ' + V + ' (CC0 1.0), https://simpleicons.org' };
for (const n of ['youtube', 'applepodcasts', 'spotify', 'xiaohongshu', 'wechat', 'tiktok']) {
  const svg = await (await fetch('https://cdn.jsdelivr.net/npm/simple-icons@' + V + '/icons/' + n + '.svg')).text();
  const m = svg.match(/<path d=\"([^\"]+)\"/);
  if (!m) throw new Error('no path in ' + n);
  out[n] = m[1];
}
writeFileSync('src/icons.json', JSON.stringify(out, null, 2) + '\n');
console.log(Object.keys(out).join(', '));
"
```

Expected: `_source, youtube, applepodcasts, spotify, xiaohongshu, wechat, tiktok`

- [ ] **Step 4: Commit**

```bash
git add assets/banners/youtube_banner_2026-11_2048x1152.jpg assets/banners/hero_strip.jpg assets/banners/hero_strip_mobile.jpg \
  assets/brand/logo_horizontal_white.png assets/photos/host_about.jpg public/og.jpg src/icons.json
git commit -F - <<'EOF'
Add her new banner (desktop and mobile strips, share image), white logo, host photo, platform icons

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 7: Template and build script

**Files:**
- Modify (full rewrite): `src/index.template.html`
- Modify (full rewrite): `scripts/build.mjs`
- Create: `tests/fixtures/channel.json` (recorded in Step 4)
- Test: `tests/build.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–6. Template placeholders filled by the build: `SEO, SITE_NAME, TAGLINE, LOGO, LOGO_WHITE, BANNER, BANNER_M, SUBSCRIBE_URL, NAV, LATEST, SCHEDULE, SHOWS, SHORTS, ABOUT, CONNECT, YEAR`.
- Produces: `node scripts/build.mjs [--fixture FILE] [--save-fixture FILE] [--out DIR]` writing `<out>/index.html` and `<out>/robots.txt` (+ `sitemap.xml` when `SITE_URL` is set).

- [ ] **Step 1: Write the integration test** — create `tests/build.test.mjs`. Do **not** run it before Step 3: the old `scripts/build.mjs` ignores `--fixture`/`--out`, reads Podbean over the network and overwrites `public/index.html`. It runs in Step 5, once the fixture exists.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the build renders the page from the recorded fixture without network access', () => {
  const out = mkdtempSync(join(tmpdir(), 'dadao-'));
  execFileSync(process.execPath, ['scripts/build.mjs', '--fixture', 'tests/fixtures/channel.json', '--out', out],
    { cwd: ROOT, env: { ...process.env, SITE_URL: '' } });
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.ok(!html.includes('{{'), 'no template placeholder left');
  assert.match(html, /<html lang="zh-Hans">/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /id="finance"/);
  assert.match(html, /id="cwei"/);
  assert.match(html, /id="shorts"/);
  assert.match(html, /youtube-nocookie\.com\/embed\//);
  assert.match(html, /chenchenshentv@gmail\.com/);
  assert.match(html, /每周五/);
  assert.ok(!html.includes('不定期'), '硅谷C位 has no frequency text');
  assert.ok(!html.includes('Private video'), 'private videos never appear');
  assert.ok(!/<script(?![^>]*application\/ld\+json)/.test(html), 'no JavaScript besides JSON-LD');
  assert.ok(existsSync(join(out, 'robots.txt')));
  assert.ok(!existsSync(join(out, 'sitemap.xml')));
});
```

- [ ] **Step 2: Rewrite `src/index.template.html`** (exact content):

```html
<!DOCTYPE html>
<html lang="zh-Hans">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{{SEO}}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
<style>
/* One 1120px column: banner, the newest episode, a schedule strip, one row per show, shorts, the host,
   then a deep-teal band with collaboration, platforms and the footer. White page, ink type; red only for
   watch/subscribe. Mobile first; the desktop layout starts at 820px. No JavaScript. */
:root{
  --bg:#FFFFFF;
  --ink:#14191B;
  --ink-2:#3D474A;
  --muted:#5F6A6D;
  --line:#E6E8E7;
  --soft:#F4F6F5;
  --teal:#0B4A5A;
  --teal-deep:#083B49;
  --on-teal:#F4F1EA;
  --on-teal-soft:#A9C6CD;
  --red:#C62828;
  --red-dark:#A61F1F;
  --on-red:#FFFFFF;
  --overlay:rgba(10,14,15,0.78);
  --on-overlay:#FFFFFF;
  --tile:rgba(255,255,255,0.06);
  --tile-hover:rgba(255,255,255,0.12);
  --tile-line:rgba(255,255,255,0.14);
  --tile-icon:rgba(255,255,255,0.10);
  --font:"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
  --r-thumb:10px;
  --r-panel:16px;
  color-scheme:light;
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
a:focus-visible{outline:2px solid var(--teal);outline-offset:3px;border-radius:6px}
.connect a:focus-visible{outline-color:var(--on-teal)}
img{max-width:100%}
p,h1,h2{margin:0}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.wrap{max-width:1152px;margin-inline:auto;padding-left:max(16px, env(safe-area-inset-left, 0px));padding-right:max(16px, env(safe-area-inset-right, 0px))}

/* header */
.site-head{border-bottom:1px solid var(--line);background:var(--bg)}
.head-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 32px;padding-block:12px 4px}
.logo{display:block;line-height:0;border-radius:4px}
.logo img{height:32px;width:auto;display:block}
.nav{order:3;width:100%;display:flex;gap:22px;overflow-x:auto;font-size:14px;font-weight:500;scrollbar-width:none}
.nav a{color:var(--ink-2);text-decoration:none;padding-block:10px;white-space:nowrap}
.nav a:hover{color:var(--ink)}
.btn-sub{margin-left:auto}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding-inline:20px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none;white-space:nowrap;transition:background-color .15s,border-color .15s}
.btn svg{width:15px;height:15px;flex:none}
.btn-red{background:var(--red);color:var(--on-red)}
.btn-red:hover{background:var(--red-dark)}
.btn-ghost{border:1px solid var(--line);color:var(--ink)}
.btn-ghost:hover{border-color:var(--ink)}

/* banner */
.banner-wrap{padding-block:16px 0}
.banner{display:block;width:100%;height:auto;border-radius:12px}

/* thumbnails */
.thumb{position:relative;display:block;aspect-ratio:16/9;max-width:100%;border-radius:var(--r-thumb);overflow:hidden;background:var(--soft)}
.thumb img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .35s ease}
a:hover .thumb img{transform:scale(1.03)}
.dur{position:absolute;right:8px;bottom:8px;background:var(--overlay);color:var(--on-overlay);font-size:12px;line-height:1.5;padding:1px 6px;border-radius:4px;font-variant-numeric:tabular-nums}

/* newest episode: a click-to-load YouTube player (iframe srcdoc, no JavaScript) */
.latest{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;padding-block:28px 36px}
.player{display:block;width:100%;max-width:100%;aspect-ratio:16/9;border:0;border-radius:14px;background:var(--soft)}
.latest-text{display:flex;flex-direction:column;gap:12px;min-width:0}
.kicker{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:14px;font-weight:700;color:var(--teal)}
.tag-new{display:inline-flex;align-items:center;gap:7px;color:var(--red)}
.tag-new::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--red)}
.latest-title{margin:0;font-size:clamp(23px,3vw,32px);line-height:1.32;font-weight:700;text-wrap:balance}
.meta{color:var(--muted);font-size:14px}
.nw{white-space:nowrap}
.desc{color:var(--ink-2);max-width:62ch;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}

/* schedule strip */
.sched{display:grid;grid-template-columns:minmax(0,1fr);background:var(--soft);border-radius:var(--r-panel)}
.sched-item{display:flex;align-items:center;gap:18px;padding:16px 20px;text-decoration:none;color:var(--ink)}
.sched-item + .sched-item{border-top:1px solid var(--line)}
.when{display:flex;flex-direction:column;align-items:center;min-width:62px}
.when span{font-size:12px;color:var(--muted)}
.when strong{font-size:24px;line-height:1.15;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.sched-show{font-weight:700}
.sched-item svg{width:28px;height:28px;flex:none;margin-inline:17px;color:var(--teal)}
a.sched-item:hover .sched-show{color:var(--red)}

/* show rows and shorts */
.shelf{padding-block:56px 0}
.shelf-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 24px;margin-bottom:20px}
.eyebrow{color:var(--teal);font-size:13px;font-weight:700;letter-spacing:.08em}
h2{margin:4px 0;font-size:clamp(24px,2.6vw,30px);line-height:1.25;font-weight:700;text-wrap:balance}
.sub{color:var(--muted);font-size:15px}
.more{font-weight:700;font-size:15px;text-decoration:none;color:var(--ink);padding-block:10px;white-space:nowrap}
.more:hover{color:var(--red)}
.cards{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:thin}
.card{flex:0 0 78%;scroll-snap-align:start;display:flex;flex-direction:column;gap:10px;color:var(--ink);text-decoration:none;min-width:0}
.card-title{font-weight:700;font-size:16px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-meta{font-size:13px;color:var(--muted)}
.card:hover .card-title{color:var(--teal)}
.next{flex:0 0 78%;scroll-snap-align:start;background:var(--soft);border-radius:var(--r-thumb);padding:22px 24px;display:flex;flex-direction:column;justify-content:center;gap:6px;min-width:0}
.next-when{font-size:22px;font-weight:700;line-height:1.3}
.next .btn{align-self:flex-start;margin-top:8px}
.shorts .card{flex-basis:42%}
.shorts .thumb{aspect-ratio:9/16}
.shorts .card-title{font-size:14px}

/* about the host */
.about{display:grid;grid-template-columns:minmax(0,1fr);gap:28px;padding-block:72px}
.host{display:block;width:100%;height:auto;max-width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center 25%;border-radius:var(--r-panel);background:var(--soft)}
.about-text{display:flex;flex-direction:column;gap:16px;min-width:0}
.about-text p:not(.eyebrow){color:var(--ink-2);max-width:60ch;line-height:1.85}
.stats{display:flex;flex-wrap:wrap;gap:16px 36px;margin:4px 0}
.stats div{display:flex;flex-direction:column-reverse}
.stats dt{font-size:13px;color:var(--muted)}
.stats dd{margin:0;font-size:26px;font-weight:700;line-height:1.25}

/* collaboration + platforms: a deep-teal closing band that echoes the banner; the footer sits inside it */
.connect{background:var(--teal-deep);color:var(--on-teal)}
.connect-inner{display:grid;grid-template-columns:minmax(0,1fr);gap:40px;padding-block:56px 0}
.connect .eyebrow{color:var(--on-teal-soft)}
.connect h2{color:var(--on-teal);font-size:clamp(26px,3.2vw,38px);margin:6px 0 10px}
.collab{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.collab .sub{color:var(--on-teal-soft);max-width:30em}
.mail{display:inline-flex;align-items:center;gap:10px;max-width:100%;min-height:52px;margin-top:22px;padding:8px 24px;border-radius:999px;background:var(--on-teal);color:var(--teal-deep);font-weight:700;font-size:16px;text-decoration:none;overflow-wrap:anywhere;transition:background-color .15s}
.mail:hover{background:var(--bg)}
.mail svg{width:18px;height:18px;flex:none}
.follow{min-width:0}
.tiles{list-style:none;margin:16px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tile{display:flex;flex-direction:column;align-items:flex-start;gap:12px;height:100%;padding:14px;border-radius:14px;background:var(--tile);border:1px solid var(--tile-line);color:var(--on-teal);text-decoration:none;min-width:0;transition:background-color .15s}
a.tile:hover{background:var(--tile-hover)}
.tile-icon{width:40px;height:40px;flex:none;border-radius:10px;background:var(--tile-icon);display:grid;place-items:center}
.tile-icon svg{width:20px;height:20px}
.tile-icon svg.wide{width:32px;height:32px}
.tile-text{display:flex;flex-direction:column;min-width:0}
.tile-name{font-size:12px;color:var(--on-teal-soft)}
.tile-handle{font-size:15px;font-weight:700;line-height:1.35;overflow-wrap:anywhere}

/* footer, inside the teal band */
.site-foot{display:flow-root;background:var(--teal-deep);color:var(--on-teal-soft)}
.foot-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 40px;margin-top:48px;padding-block:28px 36px;border-top:1px solid var(--tile-line);font-size:13px}
.foot-brand{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px}
.foot-logo{height:28px;width:auto;display:block}

@media (min-width:820px){
  .head-row{flex-wrap:nowrap;padding-block:16px}
  .logo img{height:38px}
  .nav{order:0;width:auto;margin-left:auto;gap:30px;font-size:15px;overflow:visible}
  .btn-sub{margin-left:0}
  .banner-wrap{padding-block:24px 0}
  .banner{border-radius:var(--r-panel)}
  .latest{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:48px;align-items:center;padding-block:48px 56px}
  .sched{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
  .sched-item{padding:20px 24px}
  .sched-item + .sched-item{border-top:0;border-left:1px solid var(--line)}
  .shelf{padding-block:80px 0}
  .shelf-head{margin-bottom:24px}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px 20px;overflow:visible;padding-bottom:0;align-items:start}
  .next{grid-column:span var(--span,2);align-self:stretch}
  .shorts{grid-template-columns:repeat(6,minmax(0,1fr))}
  .about{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:64px;align-items:center;padding-block:104px}
  .host{aspect-ratio:4/5;object-position:center 32%}
  .connect-inner{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:64px;padding-block:88px 0;align-items:start}
  .tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .tile{padding:16px}
  .foot-row{margin-top:72px}
}
@media (prefers-reduced-motion:reduce){
  .thumb img{transition:none}
  a:hover .thumb img{transform:none}
}
</style>
</head>
<body id="top">
<header class="site-head">
  <div class="wrap head-row">
    <a class="logo" href="#top"><img src="{{LOGO}}" alt="{{SITE_NAME}}" width="377" height="96"></a>
    <nav class="nav" aria-label="主导航">
      {{NAV}}
    </nav>
    <a class="btn btn-red btn-sub" href="{{SUBSCRIBE_URL}}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"></path></svg>订阅频道</a>
  </div>
</header>

<main>
<h1 class="sr-only">{{SITE_NAME}}：{{TAGLINE}}</h1>
<div class="wrap banner-wrap">
  <picture>
    <source media="(max-width: 819px)" srcset="{{BANNER_M}}">
    <img class="banner" src="{{BANNER}}" alt="大道：看清大趋势，过好小日子。{{TAGLINE}}" width="2048" height="338">
  </picture>
</div>

<section id="latest" class="wrap latest">
  {{LATEST}}
</section>

<section class="wrap" aria-label="节目时间">
  <div class="sched">
    {{SCHEDULE}}
  </div>
</section>

{{SHOWS}}

{{SHORTS}}

<section id="about" class="wrap about">
  {{ABOUT}}
</section>
</main>

<section id="connect" class="connect">
  <div class="wrap connect-inner">
    {{CONNECT}}
  </div>
</section>

<footer class="site-foot">
  <div class="wrap">
    <div class="foot-row">
      <div class="foot-brand"><img class="foot-logo" src="{{LOGO_WHITE}}" alt="{{SITE_NAME}}" width="377" height="96" loading="lazy"><span>{{TAGLINE}}</span></div>
      <p>© {{YEAR}} {{SITE_NAME}}</p>
    </div>
  </div>
</footer>
</body>
</html>
```

- [ ] **Step 3: Rewrite `scripts/build.mjs`** (exact content):

```js
// Builds public/index.html from src/index.template.html, src/site.json and her public YouTube data.
// No dependencies (Node 20.12+). Run: node scripts/build.mjs        (Vercel runs it on every deploy)
//   --fixture <file>       use saved data instead of calling the API (tests, offline layout work)
//   --save-fixture <file>  after fetching, also save the data to <file>
//   --out <dir>            write the site somewhere other than public/
// Needs YOUTUBE_API_KEY (Vercel env var; for local builds put YOUTUBE_API_KEY=... in .env.local).
// Any API failure stops the build on purpose, so Vercel keeps serving the last good deployment.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateConfig } from './lib/config.mjs';
import { fetchChannelData } from './lib/youtube.mjs';
import { buildModel } from './lib/model.mjs';
import { esc, fillTemplate, seoHead, renderNav, renderLatest, renderSchedule, renderShows, renderShorts, renderAbout, renderConnect } from './lib/render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({ options: { fixture: { type: 'string' }, 'save-fixture': { type: 'string' }, out: { type: 'string' } } });
const OUT = resolve(ROOT, args.out || 'public');
if (existsSync(join(ROOT, '.env.local'))) process.loadEnvFile(join(ROOT, '.env.local'));
// Set SITE_URL (e.g. https://example.com) in the Vercel project's environment variables when the real domain goes live.
// Until then the page tells search engines not to index it, and robots.txt/sitemap.xml/canonical are left out.
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const ASSET_BASE = SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const inline = (file, mime) => `data:${mime};base64,${readFileSync(join(ROOT, file)).toString('base64')}`;
const now = new Date();

const config = validateConfig(JSON.parse(readFileSync(join(ROOT, 'src/site.json'), 'utf8')));
const icons = JSON.parse(readFileSync(join(ROOT, 'src/icons.json'), 'utf8'));
const data = args.fixture
  ? JSON.parse(readFileSync(resolve(ROOT, args.fixture), 'utf8'))
  : await fetchChannelData(config, { key: process.env.YOUTUBE_API_KEY, now });
if (args['save-fixture']) writeFileSync(resolve(ROOT, args['save-fixture']), JSON.stringify(data, null, 2) + '\n');

const model = buildModel(config, data, now);
if (!model.latest) throw new Error('No public videos in the show playlists; refusing to publish an empty page.');

const page = fillTemplate(readFileSync(join(ROOT, 'src/index.template.html'), 'utf8'), {
  SEO: seoHead(config, { siteUrl: SITE_URL, assetBase: ASSET_BASE }),
  SITE_NAME: esc(config.siteName),
  TAGLINE: esc(config.tagline),
  LOGO: inline('assets/brand/logo_horizontal.png', 'image/png'),
  LOGO_WHITE: inline('assets/brand/logo_horizontal_white.png', 'image/png'),
  BANNER: inline('assets/banners/hero_strip.jpg', 'image/jpeg'),
  BANNER_M: inline('assets/banners/hero_strip_mobile.jpg', 'image/jpeg'),
  SUBSCRIBE_URL: esc(model.subscribeUrl),
  NAV: renderNav(model, config),
  LATEST: renderLatest(model.latest, model),
  SCHEDULE: renderSchedule(model),
  SHOWS: renderShows(model),
  SHORTS: renderShorts(model),
  ABOUT: renderAbout(config, model, inline('assets/photos/host_about.jpg', 'image/jpeg')),
  CONNECT: renderConnect(config, icons),
  YEAR: String(now.getFullYear()),
});

mkdirSync(OUT, { recursive: true });
if (SITE_URL) {
  writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  writeFileSync(join(OUT, 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${SITE_URL}/</loc><lastmod>${model.latest.publishedAt.slice(0, 10)}</lastmod></url>`,
    '</urlset>', '',
  ].join('\n'));
} else {
  writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  rmSync(join(OUT, 'sitemap.xml'), { force: true });
}
writeFileSync(join(OUT, 'index.html'), page);
const counts = model.shows.map((s) => `${s.name} ${s.total}`).join(', ');
console.log(`${SITE_URL ? `indexable at ${SITE_URL}` : 'NOT indexable (no SITE_URL)'}; ${relative(ROOT, join(OUT, 'index.html'))} (${Math.round(page.length / 1024)} KB): `
  + `latest "${model.latest.title}" (${model.latest.showName} 第${model.latest.ep}期); ${counts}; ${model.shorts.cards.length} shorts`);
```

- [ ] **Step 4: Record the fixture from the real API** (needs `.env.local` with the key; writes to a temp dir so `public/` is untouched):

Run: `node scripts/build.mjs --save-fixture tests/fixtures/channel.json --out "$(mktemp -d)"`
Expected: one line like `NOT indexable (no SITE_URL); …/index.html (… KB): latest "股票涨了10倍却不敢卖？…" (财经脱口秀 第6期); 财经脱口秀 6, 硅谷C位 2, 短视频 11; 6 shorts` (numbers reflect the channel on the day). Then confirm the fixture has no private items: `grep -c '"Private video"' tests/fixtures/channel.json` → `0`.

- [ ] **Step 5: Run the integration test and the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: every suite passes (format 6, config 5, youtube 4, model 6, render 10, build 1).

- [ ] **Step 6: Build the real site into `public/`**

Run: `node scripts/build.mjs`
Expected: the same one-line summary, pointing at `public/index.html`; page size roughly 250–400 KB (inlined logo, banners and host photo).

- [ ] **Step 7: Commit**

```bash
git add src/index.template.html scripts/build.mjs tests/build.test.mjs tests/fixtures/channel.json public/index.html public/robots.txt
git commit -F - <<'EOF'
Rebuild the homepage around YouTube: white layout, API data, offline fixture build

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 8: Visual check at desktop and phone width

**Files:**
- Modify only if the check finds a problem: `src/index.template.html` and/or `scripts/lib/render.mjs`, then rebuild.

**Interfaces:**
- Consumes: `public/index.html` from Task 7.
- Produces: a confirmed-good `public/index.html`.

- [ ] **Step 1: Screenshot both widths in one headless Chrome run** (scratch files go outside the repo, in this session's scratchpad):

```bash
SCRATCH="C:/Users/ying2/AppData/Local/Temp/claude/f171f8156c3c3ff4/b05d6414-a8fa-4673-81d0-b48f6690aa86/scratchpad/shots"; mkdir -p "$SCRATCH"
cp public/index.html "$SCRATCH/page.html"
cat > "$SCRATCH/compare.html" <<'EOF'
<!doctype html><html><body style="margin:0;background:#888;display:flex;gap:20px;align-items:flex-start">
<iframe src="page.html" style="width:1280px;height:4200px;border:0;background:#fff"></iframe>
<iframe src="page.html" style="width:390px;height:6200px;border:0;background:#fff"></iframe>
</body></html>
EOF
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --virtual-time-budget=10000 --window-size=1700,6220 --screenshot="$(cygpath -w "$SCRATCH/shot.png")" "file:///$(cygpath -m "$SCRATCH/compare.html")"
python -I -X utf8 -c "
from PIL import Image; import sys
d = sys.argv[1]; im = Image.open(d + '/shot.png')
for i in range(4): im.crop((0, i*1050, 1280, (i+1)*1050)).save(f'{d}/desk{i}.png')
for i in range(3): im.crop((1300, i*2070, 1690, (i+1)*2070)).save(f'{d}/phone{i}.png')
" "$SCRATCH"
```

- [ ] **Step 2: Look at every crop** (`desk0..3.png`, `phone0..2.png`, Read tool) and check against the approved mockup:
  - header: logo, nav, red 订阅频道; phone: nav is one scrollable row under logo + button.
  - banner uncut; phone shows the mobile crop.
  - newest episode: thumbnail with red play button bottom-left and duration bottom-right inside the player; kicker 「最新一期 财经脱口秀 · 第N期」; title; 「日期 · 时长 · 播放量」; description; two buttons.
  - schedule strip: 财经脱口秀 「每周五 18:30 · 下一期 …」, 硅谷C位 「最新一期 11月1日 · AI 与科技访谈 · 第2期」, subscribe cell; three equal columns on desktop, stacked on phone.
  - 财经脱口秀 row: 4 cards; 硅谷C位 row: its cards + the 「下一期」 filler filling the rest of the row; shorts: 6 vertical cards; on phone each row scrolls sideways.
  - about: photo cropped (not a full-length tall image), text, stats, button.
  - teal band: heading, mail pill, 6 tiles (3×2 desktop, 2×3 phone), footer with white logo; no white gap between band and footer.
  - nothing overflows horizontally; no broken image icons.

- [ ] **Step 3: Fix anything found, rebuild and re-run Step 1** (`node scripts/build.mjs`, then the screenshot). One fix pass; describe remaining nits to the project owner instead of looping.

- [ ] **Step 4: Commit fixes, if any**

```bash
git add src/index.template.html scripts/lib/render.mjs public/index.html
git commit -F - <<'EOF'
Fix layout issues found in the desktop/phone check

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 9: Keep the 3-hourly rebuild alive forever

**Files:**
- Modify (full rewrite): `.github/workflows/rebuild.yml`
- Create: `.github/keepalive`

**Interfaces:**
- Consumes: the existing repository secret `VERCEL_DEPLOY_HOOK`.
- Produces: rebuild every 3 hours (unchanged) plus a commit to `.github/keepalive` on the 1st of every month, so GitHub never pauses the schedule for inactivity.

- [ ] **Step 1: Rewrite `.github/workflows/rebuild.yml`** (exact content):

```yaml
# Rebuilds the site every 3 hours so new YouTube videos appear on their own.
# It only pings a Vercel Deploy Hook; Vercel then runs `node scripts/build.mjs` (see vercel.json).
# GitHub pauses scheduled workflows in a repository with no activity for 60 days, so on the 1st of each
# month the keepalive job commits a timestamp to .github/keepalive; that push counts as activity.
name: Rebuild site
on:
  schedule:
    - cron: "17 */3 * * *"
    - cron: "41 9 1 * *"
  workflow_dispatch:
    inputs:
      keepalive:
        description: "Also commit the keepalive timestamp"
        type: boolean
        default: false
permissions:
  contents: write
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel deploy hook
        env:
          HOOK: ${{ secrets.VERCEL_DEPLOY_HOOK }}
        run: |
          if [ -z "$HOOK" ]; then echo "Secret VERCEL_DEPLOY_HOOK is not set"; exit 1; fi
          curl -fsS -X POST "$HOOK"
  keepalive:
    if: github.event.schedule == '41 9 1 * *' || inputs.keepalive
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Commit a timestamp so the schedule is never paused
        run: |
          date -u +%Y-%m-%dT%H:%M:%SZ > .github/keepalive
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .github/keepalive
          git commit -m "Keep the scheduled rebuild alive"
          git push
```

- [ ] **Step 2: Create `.github/keepalive`** with one line: the current UTC time, e.g. `2026-11-09T00:00:00Z`.

- [ ] **Step 3: Check the YAML parses**

Run: `node -e "const s=require('fs').readFileSync('.github/workflows/rebuild.yml','utf8'); if(!/41 9 1 \* \*/.test(s)||!/permissions:\n  contents: write/.test(s)) throw new Error('missing keepalive bits'); console.log('ok')"`
Expected: `ok`. (Full validation happens on GitHub after the push in Task 11; Task 11 also runs it once by hand.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/rebuild.yml .github/keepalive
git commit -F - <<'EOF'
Rebuild workflow: monthly keepalive commit so the schedule never pauses

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 10: Docs

**Files:**
- Modify: `CLAUDE.md`, `docs/shen-studio-website-handoff-EN.md`, `docs/大道传媒网站项目交接文档.md`, `docs/next-steps.md`

**Interfaces:**
- Consumes: the facts established in Tasks 1–9.
- Produces: docs a future session can trust.

- [ ] **Step 1: Rewrite `CLAUDE.md`** with exactly this content:

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Marketing site for Shen Studio (大道传媒), the South Bay Chinese-language media company of 沈琛琛 Cici Shen. Since the November 2026 redesign the site exists to push her YouTube channel 「沈琛琛-大道传媒」 (`@dadaomedia`, channel id `UC5JU8r6Q8uz__uis5ZxQhBQ`): the shows 《财经脱口秀》 and 《硅谷C位》 plus Shorts. The site is one static `public/index.html` **generated** by a zero-dependency Node script (`scripts/build.mjs`) from a template, a settings file and the YouTube Data API; there is no package manager or framework. Tests use Node's built-in runner. Source lives in the git repo `Miloop-AI/shenstudio-site` (public); Vercel serves `public/`. The previous podcast-first site is tagged `v1-podcast-site`.

The design spec for the current site is `docs/superpowers/specs/2026-11-09-youtube-first-redesign-design.md` (Chinese) and the plan it was built from is `docs/superpowers/plans/2026-11-09-youtube-first-redesign.md`. The older handoff docs (`docs/shen-studio-website-handoff-EN.md`, `docs/大道传媒网站项目交接文档.md`, identical content, keep both in sync) still hold background, brand history, pricing/legal notes and open decisions; their section 0 lists what the redesign replaced.

**What's still to do** lives in `docs/next-steps.md`; read it at the start of a session and keep it current.

**Git identity:** commit and push as the GitHub account `miloopai` (not `ying2sun`). This repo's local git config already sets `user.name=miloopai`, the no-reply email `309224103+miloopai@users.noreply.github.com` and the credential username; the owner signs `miloopai` into Git Credential Manager themselves. Commits before 2026-09-23 evening are authored as `ying2sun` and are left as they are.

**Console instructions:** when telling the owner what to click in Google Cloud, Vercel, GitHub, AWS and the like, quote the English UI labels.

## Folder layout

- `public/` — the deployable site (Vercel serves it; see `vercel.json`). `index.html` is **generated, don't edit by hand**; it is committed, and Vercel regenerates it on every deploy. Also `og.jpg` (share image), `favicon.png`, `apple-touch-icon.png`, `robots.txt` (+ `sitemap.xml` once `SITE_URL` is set).
- `src/index.template.html` — page markup and CSS with `{{PLACEHOLDERS}}`.
- `src/site.json` — everything edited by hand: which playlists are shows (playlist id, name, eyebrow, line under the heading, schedule), the Shorts playlist, cards per show, the collaboration email, platform accounts, the about-the-host text, page description. `scripts/lib/config.mjs` checks it on every build and fails with a readable message.
- `src/icons.json` — platform icon paths from Simple Icons 16.37.0 (CC0).
- `scripts/build.mjs` — the build. `scripts/lib/`: `format.mjs` (titles, durations, view counts, Pacific dates, next weekly date), `youtube.mjs` (API client), `config.mjs`, `model.mjs` (what the page shows), `render.mjs` (HTML fragments, SEO head).
- `tests/` — `node --test` suites; `tests/fixtures/channel.json` is real API data recorded with `--save-fixture` for offline builds.
- `parked/` — `pricing.html`, the rate-card page, taken out of the site on 2026-09-23 (no nav link, not deployed) until the founder confirms real rates and a real contact email. To bring it back: move it into `public/`, add a nav link, replace the placeholder prices and `hello@shenstudio.example`, and drop the `noindex`.
- `assets/brand/` — the official logo files delivered by the founder (`大道传媒 Shen Studio 定稿-01.jpg` stacked, `定稿-02.jpg`/`定稿-02.png` horizontal, 3544×3544, red S mark + black text; the PNG is transparent), `logo_horizontal.png` (nav logo: the horizontal PNG trimmed to 96px tall), `logo_horizontal_white.png` (footer logo on teal: same file with everything but the red S turned white) and `podcast_cover.jpg` (unused).
- `assets/photos/` — `host_photo_full.jpg` (original), `host_photo_banner_crop.jpg`, `host_about.jpg` (720×1080, used in 关于主持人).
- `assets/banners/` — `youtube_banner_2026-11_2048x1152.jpg` (her current channel banner), `hero_strip.jpg` (2048×338, rows 407–745 of it: the centre band YouTube shows on desktop), `hero_strip_mobile.jpg` (1237×338 centre of the strip: YouTube's mobile-safe area). Older banner files are kept for history only.
- `docs/` — spec, plan, handoff documents, `next-steps.md`.
- `archive/` — superseded material kept locally for reference only (gitignored). Don't build on anything in here.

## Working with the site

- **Build locally:** needs `YOUTUBE_API_KEY`; put `YOUTUBE_API_KEY=...` in `.env.local` at the repo root (gitignored; the build loads it). `node scripts/build.mjs` writes `public/index.html`. Offline layout work: `node scripts/build.mjs --fixture tests/fixtures/channel.json`. Refresh the fixture: `node scripts/build.mjs --save-fixture tests/fixtures/channel.json --out <temp dir>`. Tests: `node --test "tests/*.test.mjs"`. Preview: open `public/index.html` or run `python -m http.server`.
- **Automation:** `vercel.json` sets `buildCommand` to `node scripts/build.mjs`, so every Vercel deploy re-reads YouTube. `.github/workflows/rebuild.yml` pings a Vercel Deploy Hook (secret `VERCEL_DEPLOY_HOOK`) every 3 hours, and on the 1st of each month commits a timestamp to `.github/keepalive` so GitHub never pauses the schedule for inactivity. A missing key, an API error or zero public show videos fails the build; Vercel keeps the last good deployment.
- **API key:** a Google Cloud project under the project owner's Google account, key restricted to YouTube Data API v3, no billing. Stored as the Vercel environment variable `YOUTUBE_API_KEY` (Production and Preview) and in `.env.local`. To rotate: Google Cloud → APIs & Services → Credentials, create a new key, update both places, delete the old key.
- Colors are CSS custom properties on `:root` (`--bg`, `--ink`, `--ink-2`, `--muted`, `--line`, `--soft`, `--teal`, `--teal-deep`, `--on-teal`, `--on-teal-soft`, `--red`, `--red-dark`, `--on-red`, `--overlay`, `--on-overlay`, `--tile*`) — always change the variable, never hardcode a color. White page and ink text; red `#C62828` (the banner's tag) only for watch/subscribe buttons and the 「最新一期」 dot; deep teal `#083B49` (the banner's background) for the closing band and footer; `#0B4A5A` for eyebrows. The only literal colors are inside the player iframe's `srcdoc` CSS, which cannot read the page's variables.
- **No JavaScript in the page.** The newest episode plays in place through an `<iframe srcdoc>` that shows the thumbnail and a play button and loads the YouTube player (`youtube-nocookie.com`, autoplay) only on click. The phone nav is a horizontally scrolling row; card rows scroll sideways on phones (CSS scroll-snap).
- Responsive breakpoint is `820px`, mobile first (`@media (min-width:820px)` holds the desktop rules). The desktop show rows assume `cardsPerShow` = 4 (`repeat(4, …)` in the CSS); change both together.
- **Images:** logo, banners and host photo are inlined as base64 data URIs (a past version referenced the logo by relative path and it silently failed to render outside its folder). Video thumbnails are hotlinked from `i.ytimg.com` (the API's `standard` size for cards and Shorts, `maxres` for the newest episode); inlining 20+ thumbnails would add over 1 MB. Shorts reuse the 16:9 thumbnail cropped to 9:16 with `object-fit`, because it holds the same cover frame.
- When publishing a page as a shareable Claude Artifact preview, transform it into an Artifact fragment first (strip `<!DOCTYPE>`/`<html>`/`<head>`/`<body>`, keep `<title>` + `<style>` + body content; images must be data URIs or published files). This is unrelated to Vercel deploys.

## Content rules that aren't obvious from the code alone

- **Shows are her YouTube playlists listed in `src/site.json`** (财经脱口秀 `PLe2uCBU6vnTA`, 硅谷C位 `PLESHS0LcVZv8`, 短视频 `PLFhYsSJNdwHs`). Other playlists (e.g. 「C想一刻」) are ignored. To add a show, add an entry; no code change.
- **Only public videos appear.** Private, unlisted, scheduled videos and upcoming premieres are skipped and appear by themselves once public.
- **Schedule wording:** 《财经脱口秀》 shows 「每周五 18:30 · 下一期 <date> · 美西时间」 (date computed; 「今天 18:30 上线」 on the day). 《硅谷C位》 has no fixed day: never write a frequency for it, not even 「不定期更新」 (the founder finds it unprofessional); it shows 「最新一期 <date> · AI 与科技访谈 · 第N期」.
- The newest episode is the newest public video across the show playlists and is not repeated in its show's row. Episode numbers are the order of public videos in the playlist by publish date. All dates are Pacific time.
- Titles show only the part before the first ｜ or |, without hashtags. There is no guest byline: titles name guests inconsistently.
- A show row with fewer than 4 cards is completed by one 「下一期 · 订阅，开播提醒」 card (no date).
- **Brand:** 大道传媒 (Shen Studio) everywhere. The banner (「大道 / 看清大趋势 过好小日子 / 来自硅谷的财经·科技·商业洞察」) is used untouched; don't retouch or re-lay-out it. When she changes it, download the new one (`=s0` gives the 2048×1152 original), re-cut the strip and mobile strip and the share image as in plan Task 6.
- **Updated automatically:** videos, titles, thumbnails, view counts, which show a video belongs to, Shorts, the next 财经脱口秀 date, the newest 硅谷C位 date. **Edited by hand in `src/site.json`:** the collaboration email (a temporary Gmail until she gets a professional address), platform accounts (小红书 / 视频号 / 抖音 have no links yet), about text, show descriptions.
- **Podcast:** Podbean is no longer read. The podcast appears only as the Apple Podcasts and Spotify tiles.
- **No fixed topic-category navigation** (no "tech / finance / education" taxonomy): the page is organised by her own named shows.
- **No articles section** and **no pricing** on the site for now (pricing is parked; when it returns it is reachable only from the top nav).
- **SEO / sharing** comes from `seoHead` in `scripts/lib/render.mjs`: title 「大道传媒 Shen Studio」, description from `src/site.json`, Open Graph + Twitter card (`public/og.jpg`, 1200×630 from her banner), favicon (red S mark only), schema.org JSON-LD (Organization, Person), and one visually hidden `<h1>` (site name and tagline). **Indexing switch:** without the env var `SITE_URL` the page is `noindex` and `robots.txt` disallows everything; setting `SITE_URL=https://the-real-domain` in Vercel (then redeploy) turns on canonical, `og:url`, `sitemap.xml` and an allowing `robots.txt`. Do that only when the founder is ready to launch. Per-video pages on this site would be the next SEO step.
````

- [ ] **Step 2: Add section 0 to the English handoff doc.** In `docs/shen-studio-website-handoff-EN.md` replace `Last updated: August 2026` with `Last updated: November 2026` and insert directly after that line:

```markdown

## 0. November 2026 redesign: YouTube first (read this first)

On 2026-11-08 the founder decided the website should push her YouTube channel, and the site was rebuilt around it (spec: `docs/superpowers/specs/2026-11-09-youtube-first-redesign-design.md`; the old podcast-first site is tagged `v1-podcast-site` in git).

- The channel is now 「沈琛琛-大道传媒」, handle `@dadaomedia`. Two shows, each one of her playlists: 《财经脱口秀》 (Fridays 18:30 Pacific) and 《硅谷C位》 (AI and tech interviews, no fixed day), plus Shorts.
- Layout: white page, the official logo, her new banner, the newest episode playable in the page, a schedule strip, one row of thumbnails per show, Shorts, about the host, then a deep-teal band with the collaboration email, her platform accounts and the footer.
- Content comes from the YouTube Data API (YouTube's RSS feeds stopped working); Podbean is no longer read. The site rebuilds every 3 hours with no manual step.
- This replaces section 2's palette and its "one image slot" principle, sections 4–6, and the parts of sections 11–13 that describe the podcast-first page. Background, design references, the article backend question, pricing and the legal notes still apply.
```

- [ ] **Step 3: Add the same section to the Chinese handoff doc.** In `docs/大道传媒网站项目交接文档.md`, replace `最后更新：2026年8月` with `最后更新：2026年11月` and insert directly after that line:

```markdown

## 0. 2026 年 11 月改版：YouTube 优先（请先读这一节）

2026-11-08 创办人决定网站全力推她的 YouTube 频道，网站据此重做（规格：`docs/superpowers/specs/2026-11-09-youtube-first-redesign-design.md`；旧的 Podcast 优先版本在 git 里有标签 `v1-podcast-site`）。

- 频道现名「沈琛琛-大道传媒」，handle 为 `@dadaomedia`。两档节目，各对应她的一个播放列表：《财经脱口秀》（每周五 18:30，美西时间）与《硅谷C位》（AI 与科技访谈，没有固定播出日），另有短视频。
- 版面：白色页面、官方 logo、她的新 banner、可在页面内播放的最新一期、播出时间条、每档节目一排缩图、短视频、关于主持人，最后是一条深青色色带，放合作邮箱、各平台账号和页尾。
- 内容来自 YouTube Data API（YouTube 的 RSS 已失效），不再读取 Podbean。网站每 3 小时自动重建，不需要人工。
- 被取代的部分：第 2 节的配色与「全站只有一个图片位置」原则、第 4–6 节，以及第 11–13 节描述 Podcast 优先页面的内容。背景、设计参考、文章后台、价目表与法律注意事项仍然适用。
```

- [ ] **Step 4: Update `docs/next-steps.md`.** Replace the status line (line 3) with:

```markdown
最后更新：2026-11-09。目前状态：YouTube 优先的新版已在分支 `youtube-redesign` 做好（规格与计划见 `docs/superpowers/`），等预览确认后合并到 `main`。合并之前线上仍是旧版（git 标签 `v1-podcast-site`）。网域尚未连接，网站设为「不让搜索引擎收录」。
```

In the 「改版：YouTube 优先」 section, replace item 1's heading line `1. **申请 YouTube Data API key**（项目负责人操作）。…` (keep its sub-bullets as the reference for rotating the key) with:

```markdown
1. **YouTube Data API key：已完成（2026-11-09）。** 用项目负责人自己的 Google 账号；Vercel 环境变量与 `.env.local` 都已设定。以下步骤留作日后换 key 的参考。
```

and replace item 2 with:

```markdown
2. 实作已完成（分支 `youtube-redesign`）。下一步：推到 GitHub，在 Vercel 预览网址确认（特别是点最新一期能在页面内播放），再合并到 `main`。
```

Replace the whole 「需要留意的维护点」 section with:

```markdown
## 需要留意的维护点

- **改栏目、邮箱、平台账号、简介**：都在 `src/site.json`，改完 commit 推上去即可（推到 `main` 会自动部署）。格式写错时 build 会报出是哪一项。
- **定时更新**：GitHub Actions 每 3 小时触发一次 Vercel Deploy Hook；每月 1 日自动提交一次 `.github/keepalive`，GitHub 就不会因 60 天没动静而暂停定时任务。
- **Deploy Hook 网址**是「触发部署的密码」，只存在 GitHub 的 Secrets（`VERCEL_DEPLOY_HOOK`），不要贴到别处。
- **YouTube API 读不到**（key 失效、额度用完、网络问题）时，那次部署会失败，网站继续显示上一个好的版本。到 Vercel 的部署记录看错误讯息；要换 key 见上方第 1 条的步骤。
- 要调整更新频率：改 `.github/workflows/rebuild.yml` 里的 `*/3`。
- 她换了 YouTube banner：把新图交给 Claude 重新裁切（流程写在 `CLAUDE.md`）。
- 分享图标目前来自正式 logo 的 3544px 原档，之后如果创办人提供矢量档（SVG / AI），可以重新生成更清晰的图标。
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/shen-studio-website-handoff-EN.md docs/大道传媒网站项目交接文档.md docs/next-steps.md
git commit -F - <<'EOF'
Docs: describe the YouTube-first site (CLAUDE.md, handoff section 0, next steps)

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
```

---

### Task 11: Preview deploy, owner check, merge

**Files:** none (git and deployment only).

**Interfaces:**
- Consumes: the finished branch.
- Produces: the new site live on Vercel.

- [ ] **Step 1: Ask the project owner** whether to push `youtube-redesign` to GitHub (this creates a Vercel preview deployment). Wait for an explicit yes.

- [ ] **Step 2: Push the branch**

Run: `git push -u origin youtube-redesign`
Expected: branch created on `Miloop-AI/shenstudio-site`.

- [ ] **Step 3: Find the preview URL.** If the `gh` CLI is available and signed in:

Run: `gh api "repos/Miloop-AI/shenstudio-site/deployments?ref=youtube-redesign" --jq '.[0].statuses_url' | xargs -I{} gh api {} --jq '.[0] | {state, environment_url}'`
Expected: `state: "success"` and a `*.vercel.app` URL. Otherwise ask the owner to copy the preview URL from Vercel → the project → **Deployments** (the newest one for branch `youtube-redesign`). If the build failed, its log names the reason (most likely `YOUTUBE_API_KEY is not set` → the key was not added to the **Preview** environment).

- [ ] **Step 4: Check the preview**

Set `PREVIEW` to the `*.vercel.app` URL found in Step 3, then run: `curl -s "$PREVIEW" | grep -c "youtube-nocookie.com/embed/"` → `1`, and `curl -s "$PREVIEW" | grep -o "下一期 [^<]*"` → the next Friday's date. (If the preview is behind Vercel Deployment Protection, curl gets a login page instead; then skip the curl checks and rely on the owner's browser check below.)
Ask the owner to open the preview on a phone and a computer and click the newest episode: it must start playing inside the page. If YouTube shows an error instead (for example "Error 153"), switch `renderLatest` to a plain link to the video (the thumbnail wrapped in `<a class="thumb" href="…">` as in the mockup), rebuild, push, and re-check.

- [ ] **Step 5: Ask the owner whether to merge into `main`.** Wait for an explicit yes.

- [ ] **Step 6: Merge and push**

```bash
git switch main
git pull --ff-only
git merge --no-ff youtube-redesign -F - <<'EOF'
Merge youtube-redesign: YouTube-first homepage fed by the YouTube Data API

Claude-Session: https://claude.ai/code/session_017BsVsCr9EpvZ3ULShuV51e
EOF
git push origin main
```

Expected: Vercel deploys production from `main`.

- [ ] **Step 7: Run the workflow once by hand with the keepalive box ticked** — ask the owner to open GitHub → the repo → **Actions** → **Rebuild site** → **Run workflow**, tick **Also commit the keepalive timestamp**, **Run workflow**; or with `gh`: `gh workflow run rebuild.yml -f keepalive=true`. Expected: both jobs green, a new commit "Keep the scheduled rebuild alive" on `main`, and a fresh production deployment. Then `git pull` locally.
