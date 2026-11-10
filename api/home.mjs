// Vercel Function behind "/" (vercel.json rewrites "/" here). Renders the homepage from live YouTube data;
// the CDN caches it for 10 minutes. Files it reads are bundled via "includeFiles" in vercel.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchChannelData } from '../scripts/lib/youtube.mjs';
import { renderPage, loadConfig, siteUrls } from '../scripts/lib/page.mjs';
import { createHandler } from '../scripts/lib/handler.mjs';

const ROOT = process.cwd();

export default createHandler({
  async render() {
    const now = new Date();
    const data = await fetchChannelData(loadConfig(ROOT), { key: process.env.YOUTUBE_API_KEY, now });
    return renderPage({ root: ROOT, data, now, ...siteUrls() });
  },
  readFallback: () => readFileSync(join(ROOT, 'fallback/index.html'), 'utf8'),
});
