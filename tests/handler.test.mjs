import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, LIVE_CACHE, FALLBACK_CACHE } from '../scripts/lib/handler.mjs';

function fakeRes() {
  const res = { headers: {}, statusCode: 0, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

test('a successful render is served as HTML with a 10-minute CDN cache', async () => {
  const handler = createHandler({ render: async () => ({ html: '<p>live</p>' }), readFallback: () => '<p>old</p>', log: () => {} });
  const res = fakeRes();
  await handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<p>live</p>');
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(res.headers['cache-control'], LIVE_CACHE);
  assert.match(LIVE_CACHE, /s-maxage=600/);
});

test('when rendering fails the build-time page is served, cached only briefly, and the error is logged', async () => {
  const logged = [];
  const handler = createHandler({
    render: async () => { throw new Error('YouTube API playlistItems -> HTTP 403 (quotaExceeded)'); },
    readFallback: () => '<p>old</p>',
    log: (...a) => logged.push(a.join(' ')),
  });
  const res = fakeRes();
  await handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<p>old</p>');
  assert.equal(res.headers['cache-control'], FALLBACK_CACHE);
  assert.match(FALLBACK_CACHE, /s-maxage=60\b/);
  assert.match(logged.join('\n'), /quotaExceeded/);
});
