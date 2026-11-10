// Renders the complete homepage HTML from the files in the repo plus already-fetched YouTube data.
// Used by scripts/build.mjs (deploy time) and api/home.mjs (on request). Reads files from `root`; no network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateConfig } from './config.mjs';
import { buildModel } from './model.mjs';
import { esc, fillTemplate, seoHead, renderNav, renderLatest, renderSchedule, renderShows, renderShorts, renderAbout, renderConnect } from './render.mjs';

export const loadConfig = (root) => validateConfig(JSON.parse(readFileSync(join(root, 'src/site.json'), 'utf8')));

export function renderPage({ root, data, now = new Date(), siteUrl = '', assetBase = '' }) {
  const config = loadConfig(root);
  const icons = JSON.parse(readFileSync(join(root, 'src/icons.json'), 'utf8'));
  const inline = (file, mime) => `data:${mime};base64,${readFileSync(join(root, file)).toString('base64')}`;

  const model = buildModel(config, data, now);
  if (!model.latest) throw new Error('No public videos in the show playlists; refusing to publish an empty page.');

  const html = fillTemplate(readFileSync(join(root, 'src/index.template.html'), 'utf8'), {
    SEO: seoHead(config, { siteUrl, assetBase }),
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
  return { html, model, config };
}

/** SITE_URL turns on indexing; the share image needs an absolute URL even before that. Same rules at build and on request. */
export function siteUrls(env = process.env) {
  const siteUrl = (env.SITE_URL || '').replace(/\/+$/, '');
  const assetBase = siteUrl || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return { siteUrl, assetBase };
}
