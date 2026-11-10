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
