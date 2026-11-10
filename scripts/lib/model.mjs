// Turns src/site.json plus the fetched YouTube data into what the page shows. Pure: no I/O; `now` is passed in.
import { cleanTitle, firstParagraph, formatDuration, formatViews, formatDate, nextWeekly } from './format.mjs';

export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const shortUrl = (id) => `https://www.youtube.com/shorts/${id}`;
export const playlistUrl = (id) => `https://www.youtube.com/playlist?list=${id}`;

const newestFirst = (a, b) => b.publishedAt.localeCompare(a.publishedAt);

export function buildModel(config, data, now = new Date()) {
  const channelUrl = `https://www.youtube.com/${config.channel.handle}`;
  const subscribeUrl = `${channelUrl}?sub_confirmation=1`;
  const publicIn = (playlistId) => (data.playlists[playlistId] || []).filter((p) => data.videos[p.videoId]).sort(newestFirst);
  const card = (v, extra) => ({
    id: v.id, url: watchUrl(v.id), title: cleanTitle(v.title), thumb: v.thumb,
    duration: formatDuration(v.durationSec), date: formatDate(v.publishedAt, now), views: formatViews(v.views),
    publishedAt: v.publishedAt, ...extra,
  });

  const shows = config.shows.map((s) => {
    const items = publicIn(s.playlistId);
    const all = items.map((p, i) => card(data.videos[p.videoId], { ep: items.length - i, showKey: s.key, showName: s.name }));
    return { ...s, url: playlistUrl(s.playlistId), total: all.length, all };
  });

  const newest = shows.flatMap((s) => s.all).sort(newestFirst)[0];
  const latest = newest
    ? { ...newest, thumbLarge: data.videos[newest.id].thumbLarge, description: firstParagraph(data.videos[newest.id].description) }
    : null;

  for (const s of shows) {
    s.airing = airing(s, now);
    s.cards = s.all.filter((c) => !latest || c.id !== latest.id).slice(0, config.cardsPerShow * config.rowsPerShow);
    s.filler = filler(s, config.cardsPerShow, now);
    delete s.all;
  }

  const shortsCards = publicIn(config.shorts.playlistId).slice(0, config.shortsCount).map((p) => {
    const v = data.videos[p.videoId];
    return { id: v.id, url: shortUrl(v.id), title: cleanTitle(v.title), thumb: v.thumb, views: formatViews(v.views) };
  });

  return { channelUrl, subscribeUrl, latest, shows, shorts: { ...config.shorts, url: `${channelUrl}/shorts`, cards: shortsCards } };
}

// The schedule strip line for one show. 硅谷C位 has no fixed day, so it shows its newest episode instead of a frequency.
function airing(show, now) {
  const sc = show.schedule;
  if (sc.type === 'weekly') {
    const next = nextWeekly(sc.weekday, sc.time, now);
    return { label: sc.label, value: sc.time, note: next === '今天' ? `今天 ${sc.time} 上线 · 美西时间` : `下一期 ${next} · 美西时间` };
  }
  const newest = show.all[0];
  return newest ? { label: '最新一期', value: newest.date, note: `${show.eyebrow} · 第${newest.ep}期` } : null;
}

// A card-sized "next episode" tile placed in the first free slot of a partly filled last row (none when the row is full).
// Weekly shows name the next air date; 硅谷C位 has no fixed day, so it only says 敬请期待.
function filler(show, perRow, now) {
  if (show.cards.length > 0 && show.cards.length % perRow === 0) return null;
  const sc = show.schedule;
  const ep = show.total + 1;
  if (sc.type === 'weekly') {
    return { when: nextWeekly(sc.weekday, sc.time, now), note: `${sc.label.replace(/^每/, '')} ${sc.time} · 美西时间`, ep };
  }
  return { when: '敬请期待', note: '订阅频道，上线即通知', ep };
}
