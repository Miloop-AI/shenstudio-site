// Deploy-time build. Vercel runs it on every deploy (vercel.json buildCommand). No dependencies (Node 20.12+).
// The live homepage is rendered on request by api/home.mjs (cached 10 minutes); this build writes:
//   fallback/index.html  the same page from deploy-time data, served by api/home.mjs if YouTube can't be read
//   public/robots.txt, public/sitemap.xml
// Flags:
//   --fixture <file>       use saved data instead of calling the API (tests, offline layout work)
//   --save-fixture <file>  after fetching, also save the data to <file>
//   --out <dir>            write all three files into <dir> instead
// Needs YOUTUBE_API_KEY (Vercel env var; for local builds put YOUTUBE_API_KEY=... in .env.local).
// Any API failure stops the build on purpose, so Vercel keeps serving the last good deployment.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { fetchChannelData } from './lib/youtube.mjs';
import { renderPage, loadConfig, siteUrls } from './lib/page.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({ options: { fixture: { type: 'string' }, 'save-fixture': { type: 'string' }, out: { type: 'string' } } });
const PAGE_DIR = resolve(ROOT, args.out || 'fallback');
const PUBLIC_DIR = resolve(ROOT, args.out || 'public');
if (existsSync(join(ROOT, '.env.local'))) process.loadEnvFile(join(ROOT, '.env.local'));
// Set SITE_URL (e.g. https://shenstudio.tv) in the Vercel project's environment variables for Production only.
// Without it the page tells search engines not to index it, and robots.txt/sitemap.xml/canonical are left out.
const { siteUrl, assetBase } = siteUrls();
const now = new Date();

const data = args.fixture
  ? JSON.parse(readFileSync(resolve(ROOT, args.fixture), 'utf8'))
  : await fetchChannelData(loadConfig(ROOT), { key: process.env.YOUTUBE_API_KEY, now });
if (args['save-fixture']) writeFileSync(resolve(ROOT, args['save-fixture']), JSON.stringify(data, null, 2) + '\n');

const { html, model } = renderPage({ root: ROOT, data, now, siteUrl, assetBase });

mkdirSync(PAGE_DIR, { recursive: true });
mkdirSync(PUBLIC_DIR, { recursive: true });
if (siteUrl) {
  writeFileSync(join(PUBLIC_DIR, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  writeFileSync(join(PUBLIC_DIR, 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${siteUrl}/</loc><lastmod>${model.latest.publishedAt.slice(0, 10)}</lastmod></url>`,
    '</urlset>', '',
  ].join('\n'));
} else {
  writeFileSync(join(PUBLIC_DIR, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  rmSync(join(PUBLIC_DIR, 'sitemap.xml'), { force: true });
}
writeFileSync(join(PAGE_DIR, 'index.html'), html);
const counts = model.shows.map((s) => `${s.name} ${s.total}`).join(', ');
console.log(`${siteUrl ? `indexable at ${siteUrl}` : 'NOT indexable (no SITE_URL)'}; ${relative(ROOT, join(PAGE_DIR, 'index.html'))} (${Math.round(html.length / 1024)} KB): `
  + `latest "${model.latest.title}" (${model.latest.showName} 第${model.latest.ep}期); ${counts}; ${model.shorts.cards.length} shorts`);
