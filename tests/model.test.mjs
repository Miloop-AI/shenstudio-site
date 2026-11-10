import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../scripts/lib/model.mjs';

const config = {
  channel: { handle: '@dadaomedia' },
  shows: [
    { key: 'a', playlistId: 'PA', name: '节目A', eyebrow: 'A 小标题', schedule: { type: 'weekly', weekday: 5, time: '18:30', label: '每周五' } },
    { key: 'b', playlistId: 'PB', name: '节目B', eyebrow: 'B 小标题', schedule: { type: 'latest' } },
  ],
  shorts: { playlistId: 'PS', name: '短视频', eyebrow: '一分钟看懂' },
  cardsPerShow: 4,
  rowsPerShow: 2,
  shortsCount: 2,
};
const v = (id, publishedAt) => ({ id, title: `${id} 标题｜沈琛琛`, description: `${id} 第一段\n\n第二段`, publishedAt,
  durationSec: 1548, views: 31234, thumb: `t-${id}`, thumbLarge: `T-${id}` });
const data = {
  playlists: {
    PA: [{ videoId: 'a3', publishedAt: '2026-11-07T02:30:00Z' }, { videoId: 'a2', publishedAt: '2026-10-31T01:30:00Z' },
      { videoId: 'gone', publishedAt: '2026-10-25T01:30:00Z' }, { videoId: 'a1', publishedAt: '2026-10-24T01:30:00Z' }],
    PB: [{ videoId: 'b1', publishedAt: '2026-10-19T01:30:00Z' }, { videoId: 'b2', publishedAt: '2026-11-02T02:00:00Z' }],
    PS: [{ videoId: 's1', publishedAt: '2026-11-05T00:00:00Z' }, { videoId: 's2', publishedAt: '2026-11-04T00:00:00Z' }, { videoId: 's3', publishedAt: '2026-11-03T00:00:00Z' }],
  },
  videos: Object.fromEntries([
    v('a1', '2026-10-24T01:30:00Z'), v('a2', '2026-10-31T01:30:00Z'), v('a3', '2026-11-07T02:30:00Z'),
    v('b1', '2026-10-19T01:30:00Z'), v('b2', '2026-11-02T02:00:00Z'),
    v('s1', '2026-11-05T00:00:00Z'), v('s2', '2026-11-04T00:00:00Z'), v('s3', '2026-11-03T00:00:00Z'),
  ].map((x) => [x.id, x])),
};
const now = new Date('2026-11-09T20:00:00Z');

test('latest is the newest public show video, with description and large thumbnail', () => {
  const m = buildModel(config, data, now);
  assert.equal(m.latest.id, 'a3');
  assert.equal(m.latest.title, 'a3 标题');
  assert.equal(m.latest.ep, 3);
  assert.equal(m.latest.showName, '节目A');
  assert.equal(m.latest.date, '11月6日');
  assert.equal(m.latest.duration, '25:48');
  assert.equal(m.latest.views, '3.1万次观看');
  assert.equal(m.latest.description, 'a3 第一段');
  assert.equal(m.latest.thumbLarge, 'T-a3');
  assert.equal(m.subscribeUrl, 'https://www.youtube.com/@dadaomedia?sub_confirmation=1');
});

test('episode numbers skip videos that are no longer public; latest is not repeated in its show row', () => {
  const m = buildModel(config, data, now);
  const a = m.shows.find((s) => s.key === 'a');
  assert.equal(a.total, 3);
  assert.deepEqual(a.cards.map((c) => [c.id, c.ep]), [['a2', 2], ['a1', 1]]);
  assert.deepEqual(a.filler, { when: '11月13日', note: '周五 18:30 · 美西时间', ep: 4 });
  assert.equal(a.url, 'https://www.youtube.com/playlist?list=PA');
});

test('rows hold up to cardsPerShow × rowsPerShow cards; a next-episode tile takes a free slot in the last row', () => {
  const many = (n) => {
    const vids = Array.from({ length: n }, (_, i) => v(`m${i}`, new Date(Date.UTC(2026, 9, 1 + i)).toISOString()));
    return { playlists: { PA: vids.map((x) => ({ videoId: x.id, publishedAt: x.publishedAt })), PB: [], PS: [] },
      videos: Object.fromEntries(vids.map((x) => [x.id, x])) };
  };
  const six = buildModel(config, many(6), now).shows[0];     // the newest becomes "latest", 5 left
  assert.equal(six.cards.length, 5);
  assert.equal(six.filler.ep, 7);
  const five = buildModel(config, many(5), now).shows[0];    // 4 left: the first row is full
  assert.equal(five.cards.length, 4);
  assert.equal(five.filler, null);
  const nine = buildModel(config, many(9), now).shows[0];    // 8 left: two full rows
  assert.equal(nine.cards.length, 8);
  assert.equal(nine.filler, null);
  const twelve = buildModel(config, many(12), now).shows[0];
  assert.equal(twelve.cards.length, 8);
  assert.equal(twelve.total, 12);
  assert.equal(buildModel(config, many(6), new Date('2026-11-14T01:00:00Z')).shows[0].filler.when, '今天');
});

test('playlist order does not matter: cards are sorted by publish date', () => {
  const b = buildModel(config, data, now).shows.find((s) => s.key === 'b');
  assert.deepEqual(b.cards.map((c) => [c.id, c.ep]), [['b2', 2], ['b1', 1]]);
});

test('weekly shows get the next air date; latest-type shows get their newest episode', () => {
  const m = buildModel(config, data, now);
  assert.deepEqual(m.shows[0].airing, { label: '每周五', value: '18:30', note: '下一期 11月13日 · 美西时间' });
  assert.deepEqual(m.shows[1].airing, { label: '最新一期', value: '11月1日', note: 'B 小标题 · 第2期' });
  const friday = buildModel(config, data, new Date('2026-11-14T01:00:00Z'));
  assert.equal(friday.shows[0].airing.note, '今天 18:30 上线 · 美西时间');
});

test('shorts are limited to shortsCount, newest first', () => {
  const m = buildModel(config, data, now);
  assert.deepEqual(m.shorts.cards.map((c) => c.id), ['s1', 's2']);
  assert.equal(m.shorts.cards[0].url, 'https://www.youtube.com/shorts/s1');
  assert.equal(m.shorts.url, 'https://www.youtube.com/@dadaomedia/shorts');
});

test('no public show videos means no latest', () => {
  const empty = { playlists: { PA: [], PB: [], PS: [] }, videos: {} };
  const m = buildModel(config, empty, now);
  assert.equal(m.latest, null);
  assert.equal(m.shows[1].airing, null);
  assert.equal(m.shows[0].filler.ep, 1);
  assert.deepEqual(m.shows[1].filler, { when: '敬请期待', note: '订阅频道，上线即通知', ep: 1 });
});
