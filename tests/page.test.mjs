import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from '../scripts/lib/page.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/channel.json'), 'utf8'));
const now = new Date('2026-11-09T20:00:00Z');

test('renderPage fills the whole template from config and data', () => {
  const { html, model, config } = renderPage({ root: ROOT, data, now, siteUrl: '', assetBase: '' });
  assert.ok(!html.includes('{{'), 'no placeholder left');
  assert.ok(html.includes(`<title>${config.pageTitle}</title>`));
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.ok(html.includes(`youtube-nocookie.com/embed/${model.latest.id}`));
  assert.ok(html.includes('data:image/png;base64,'), 'logo is inlined');
});

test('renderPage adds the canonical when a site URL is given', () => {
  const { html } = renderPage({ root: ROOT, data, now, siteUrl: 'https://shenstudio.tv', assetBase: 'https://shenstudio.tv' });
  assert.ok(html.includes('<link rel="canonical" href="https://shenstudio.tv/">'));
  assert.ok(!html.includes('noindex'));
});

test('renderPage refuses to render without any public show video', () => {
  const empty = { playlists: {}, videos: {} };
  assert.throws(() => renderPage({ root: ROOT, data: empty, now, siteUrl: '', assetBase: '' }), /No public videos/);
});
