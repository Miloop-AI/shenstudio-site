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
