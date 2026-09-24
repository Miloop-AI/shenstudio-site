// Builds public/index.html from src/index.template.html plus her two public feeds.
// No dependencies. Run: node scripts/build.mjs   (Vercel runs it on every deploy)
// If the Podbean feed can't be read the build fails on purpose, so Vercel keeps serving the last good version.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PODCAST_FEED = 'https://chenchenshentv.podbean.com/feed/';
const PODCAST_HOME = 'https://chenchenshentv.podbean.com/';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@ChenchenShen0416';
const YOUTUBE_FEED = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC5JU8r6Q8uz__uis5ZxQhBQ';
const MAX_ITEMS = 12;            // newest item + the rest of the list
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

// ---------- tags: first two specific hashtags from the show notes ----------
function pickTags(lines) {
  const found = lines.join(' ').match(/#[^\s#，,。！？、]{2,}/g) || [];
  const chosen = [];
  for (const t of found) {
    if (SELF_TAGS.has(t) || /^#\d+$/.test(t)) continue;
    if (chosen.some((c) => c === t || c.includes(t.slice(1)) || t.includes(c.slice(1)) || sameWords(c, t))) continue;
    chosen.push(t);
    if (chosen.length === 2) break;
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
  const meta = [it.tags.join(' '), ymd(it.date), it.mins ? `${it.mins} 分钟` : ''].filter(Boolean).join(' · ');
  return `      <article class="ep${lead ? ' lead' : ''}">
        <div class="eyebrow mono">${esc(label)}</div>
        <h3 class="serif"><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a></h3>${it.deck ? `\n        <p class="deck">${esc(it.deck)}</p>` : ''}
        <div class="meta mono">${esc(meta)}</div>
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

const [latest, ...rest] = items;
const page = readFileSync(join(ROOT, 'src/index.template.html'), 'utf8')
  .replaceAll('{{LOGO}}', inline('assets/brand/logo_horizontal.png', 'image/png'))
  .replaceAll('{{HERO}}', inline('assets/banners/hero_strip.jpg', 'image/jpeg'))
  .replaceAll('{{LATEST}}', row(latest, true))
  .replaceAll('{{ROWS}}', rest.map((i) => row(i, false)).join('\n'))
  .replaceAll('{{VIDEO_TEXT}}', videoCount ? '全部影片请到 YouTube 频道观看。' : '第一支影片制作中，敬请期待。')
  .replaceAll('{{PODCAST_HOME}}', PODCAST_HOME)
  .replaceAll('{{YT}}', YOUTUBE_CHANNEL);

mkdirSync(join(ROOT, 'public'), { recursive: true });
writeFileSync(join(ROOT, 'public/index.html'), page);
console.log(`public/index.html: ${items.length} items (${videoCount} video), newest: E${latest.ep || '-'} ${latest.title}`);
