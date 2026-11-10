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
