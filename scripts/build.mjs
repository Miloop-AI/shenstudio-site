// Builds public/index.html from src/index.template.html plus her two public feeds.
// No dependencies. Run: node scripts/build.mjs   (Vercel runs it on every deploy)
// If the Podbean feed can't be read the build fails on purpose, so Vercel keeps serving the last good version.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PODCAST_FEED = 'https://chenchenshentv.podbean.com/feed/';
const PODCAST_HOME = 'https://chenchenshentv.podbean.com/';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@ChenchenShen0416';
const YOUTUBE_FEED = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC5JU8r6Q8uz__uis5ZxQhBQ';
const MAX_ITEMS = 12;            // newest item + the rest of the list
const MAX_TAGS = 6;              // hashtags shown per item
// Set SITE_URL (e.g. https://example.com) in the Vercel project's environment variables when the real domain goes live.
// Until then the page tells search engines not to index it, and robots.txt/sitemap.xml/canonical are left out.
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const ASSET_BASE = SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const SITE_NAME = '大道传媒 Shen Studio';
const PAGE_TITLE = SITE_NAME;
const PAGE_DESCRIPTION = '旧金山湾区著名媒体人沈琛琛，立足硅谷，放眼全球。深度时事解析 × 财经干货访谈 × 硅谷前沿科技 × 大健康养生。';
const SPOTIFY = 'https://open.spotify.com/show/033R7udpl2Dr1qmaoNHATs';
const APPLE = 'https://podcasts.apple.com/us/podcast/c%E6%83%B3%E4%B8%80%E5%88%BB/id6791887956';
const SELF_TAGS = new Set(['#C想一刻', '#沈琛琛', '#沈琛琛Cici', '#Cici']);

// ---------- small helpers ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const unCdata = (s) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
const field = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? unCdata(m[1]).trim() : '';
};
const toText = (html) => {
  let s = unCdata(html);
  if (!/<[a-z!/]/i.test(s)) s = decode(s);          // description was entity-escaped HTML
  s = s.replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '');
  return decode(s).replace(/[ \t ]+/g, ' ').split('\n').map((l) => l.trim()).filter(Boolean);
};
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(d).replace(/-/g, '.');
const inline = (file, mime) => `data:${mime};base64,${readFileSync(join(ROOT, file)).toString('base64')}`;

async function get(url, { optional = false } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'shenstudio-site-build' }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
  if (res.ok) return res.text();
  if (optional && res.status === 404) return null;
  throw new Error(`${url} -> HTTP ${res.status}`);
}

// simplified/traditional twins such as #董建华 and #董建華逝世: the shared prefix differs by at most one character
const sameWords = (a, b) => {
  const n = Math.min(a.length, b.length);
  return n >= 4 && [...a.slice(0, n)].filter((ch, i) => ch !== b[i]).length <= 1;
};

// ---------- tags: first few specific hashtags from the show notes ----------
function pickTags(lines) {
  const found = lines.join(' ').match(/#[^\s#，,。！？、]{2,}/g) || [];
  const chosen = [];
  for (const t of found) {
    if (SELF_TAGS.has(t) || /^#\d+$/.test(t)) continue;
    if (chosen.some((c) => c === t || c.includes(t.slice(1)) || t.includes(c.slice(1)) || sameWords(c, t))) continue;
    chosen.push(t);
    if (chosen.length === MAX_TAGS) break;
  }
  return chosen;
}

// ---------- podcast ----------
function parsePodcast(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, b]) => {
    const lines = toText(field(b, 'description'));
    const deck = lines.find((l) => !l.startsWith('#') && !l.startsWith('•') && l.length >= 12) || '';
    const sec = field(b, 'itunes:duration');
    const secs = sec.includes(':') ? sec.split(':').reduce((a, n) => a * 60 + +n, 0) : +sec;
    return {
      kind: '播客',
      ep: field(b, 'itunes:episode'),
      title: decode(field(b, 'title')),
      url: field(b, 'link'),
      date: new Date(field(b, 'pubDate')),
      deck: deck.length > 170 ? deck.slice(0, 170) + '…' : deck,
      tags: pickTags(lines),
      mins: secs ? Math.max(1, Math.round(secs / 60)) : 0,
    };
  });
}

// ---------- youtube (no videos yet: the feed 404s, that just means an empty list) ----------
function parseYoutube(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, b]) => {
    const lines = toText(field(b, 'media:description'));
    const deck = lines.find((l) => !l.startsWith('#') && l.length >= 12) || '';
    return {
      kind: '影片',
      ep: '',
      title: decode(field(b, 'title')),
      url: (b.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || YOUTUBE_CHANNEL,
      date: new Date(field(b, 'published')),
      deck: deck.length > 170 ? deck.slice(0, 170) + '…' : deck,
      tags: pickTags(lines),
      mins: 0,
    };
  });
}

// ---------- render ----------
function row(it, lead) {
  const label = it.ep ? `${it.kind} · E${it.ep}` : it.kind;
  const meta = [ymd(it.date), it.mins ? `${it.mins} 分钟` : ''].filter(Boolean).join(' · ');
  return `      <article class="ep${lead ? ' lead' : ''}">
        <div class="eyebrow mono">${esc(label)}</div>
        <h3 class="serif"><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a></h3>${it.deck ? `\n        <p class="deck">${esc(it.deck)}</p>` : ''}
        <div class="meta mono">${esc(meta)}</div>${it.tags.length ? `
        <div class="tags mono">${esc(it.tags.join(' '))}</div>` : ''}
      </article>`;
}

// The podcast is the site's core, so a failure there stops the build. YouTube is a bonus: if it is unreachable
// (blocked, rate-limited) we warn and publish without videos rather than block the whole deploy.
const ytXml = await get(YOUTUBE_FEED, { optional: true }).catch((err) => {
  console.warn(`WARNING: could not read the YouTube feed, publishing without videos (${err.message})`);
  return null;
});
const podXml = await get(PODCAST_FEED);
const items = [...parsePodcast(podXml), ...parseYoutube(ytXml)].sort((a, b) => b.date - a.date).slice(0, MAX_ITEMS);
if (!items.length) throw new Error('No episodes found in the podcast feed; refusing to publish an empty page.');
const videoCount = items.filter((i) => i.kind === '影片').length;

// ---------- search / sharing metadata ----------
function seoHead(newest) {
  const id = (frag) => `${SITE_URL}/#${frag}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': id('org'), name: SITE_NAME, ...(SITE_URL && { url: `${SITE_URL}/` }), sameAs: [YOUTUBE_CHANNEL] },
      { '@type': 'Person', '@id': id('host'), name: '沈琛琛', alternateName: 'Cici Shen', worksFor: { '@id': id('org') }, sameAs: [YOUTUBE_CHANNEL] },
      { '@type': 'PodcastSeries', name: 'C想一刻', inLanguage: 'zh-Hans', description: PAGE_DESCRIPTION, ...(SITE_URL && { url: `${SITE_URL}/` }),
        webFeed: PODCAST_FEED, author: { '@id': id('host') }, publisher: { '@id': id('org') }, sameAs: [SPOTIFY, APPLE, PODCAST_HOME] },
    ],
  };
  const meta = (attr, key, val) => `<meta ${attr}="${key}" content="${esc(val)}">`;
  return [
    `<title>${esc(PAGE_TITLE)}</title>`,
    meta('name', 'description', PAGE_DESCRIPTION),
    SITE_URL ? `<link rel="canonical" href="${esc(SITE_URL)}/">` : '<meta name="robots" content="noindex, nofollow">',
    '<link rel="icon" type="image/png" href="/favicon.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', 'zh_CN'),
    meta('property', 'og:title', PAGE_TITLE),
    meta('property', 'og:description', PAGE_DESCRIPTION),
    ...(SITE_URL ? [meta('property', 'og:url', `${SITE_URL}/`)] : []),
    meta('property', 'og:image', `${ASSET_BASE}/og.jpg`),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('name', 'twitter:card', 'summary_large_image'),
    `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

const [latest, ...rest] = items;
const page = readFileSync(join(ROOT, 'src/index.template.html'), 'utf8')
  .replaceAll('{{SEO}}', seoHead(latest))
  .replaceAll('{{LOGO}}', inline('assets/brand/logo_horizontal.png', 'image/png'))
  .replaceAll('{{HERO}}', inline('assets/banners/hero_strip.jpg', 'image/jpeg'))
  .replaceAll('{{LATEST}}', row(latest, true))
  .replaceAll('{{ROWS}}', rest.map((i) => row(i, false)).join('\n'))
  .replaceAll('{{VIDEO_TEXT}}', videoCount ? '全部影片请到 YouTube 频道观看。' : '第一支影片制作中，敬请期待。')
  .replaceAll('{{PODCAST_HOME}}', PODCAST_HOME)
  .replaceAll('{{YT}}', YOUTUBE_CHANNEL);

mkdirSync(join(ROOT, 'public'), { recursive: true });
if (SITE_URL) {
  writeFileSync(join(ROOT, 'public/robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  const lastmod = latest.date.toISOString().slice(0, 10);
  writeFileSync(join(ROOT, 'public/sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${SITE_URL}/</loc><lastmod>${lastmod}</lastmod></url>`,
    '</urlset>', '',
  ].join('\n'));
} else {
  writeFileSync(join(ROOT, 'public/robots.txt'), 'User-agent: *\nDisallow: /\n');
  rmSync(join(ROOT, 'public/sitemap.xml'), { force: true });
}
writeFileSync(join(ROOT, 'public/index.html'), page);
console.log(`${SITE_URL ? `indexable at ${SITE_URL}` : 'NOT indexable (no SITE_URL)'}; public/index.html: ${items.length} items (${videoCount} video), newest: E${latest.ep || '-'} ${latest.title}`);
