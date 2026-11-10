// Reads the channel's public videos from the YouTube Data API v3. All network access goes through the
// injected `fetch`, so tests run offline. Quota: about 1 unit per 50 playlist items plus 1 per 50 videos.
import { parseDuration } from './format.mjs';

const API = 'https://www.googleapis.com/youtube/v3';
const MAX_PAGES = 20; // 50 items per page; a safety stop, not an expected size

async function call(fetchImpl, key, endpoint, params) {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetchImpl(`${API}/${endpoint}?${qs}`, { signal: AbortSignal.timeout(20000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || 'unknown';
    throw new Error(`YouTube API ${endpoint} -> HTTP ${res.status} (${reason}) ${body?.error?.message || ''}`.trim());
  }
  return body;
}

/** Public items of a playlist, newest first. Private/unlisted/scheduled items have no videoPublishedAt or a non-public status. */
export async function listPlaylist(playlistId, { key, fetch: fetchImpl = fetch }) {
  const out = [];
  let pageToken;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await call(fetchImpl, key, 'playlistItems', {
      part: 'contentDetails,status', playlistId, maxResults: '50', ...(pageToken && { pageToken }),
    });
    for (const it of body.items || []) {
      const publishedAt = it.contentDetails?.videoPublishedAt;
      if (it.status?.privacyStatus === 'public' && publishedAt) out.push({ videoId: it.contentDetails.videoId, publishedAt });
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Details keyed by id. Skips videos that are not public or not watchable yet (upcoming premieres, live streams). */
export async function getVideos(ids, { key, fetch: fetchImpl = fetch }) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const body = await call(fetchImpl, key, 'videos', {
      part: 'snippet,contentDetails,statistics,status', id: ids.slice(i, i + 50).join(','), maxResults: '50',
    });
    for (const v of body.items || []) {
      if (v.status?.privacyStatus !== 'public' || (v.snippet?.liveBroadcastContent || 'none') !== 'none') continue;
      const t = v.snippet.thumbnails || {};
      const fallback = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
      out[v.id] = {
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description || '',
        publishedAt: v.snippet.publishedAt,
        durationSec: parseDuration(v.contentDetails?.duration),
        views: Number(v.statistics?.viewCount || 0),
        thumb: (t.standard || t.high || t.medium || t.default)?.url || fallback,
        thumbLarge: (t.maxres || t.standard || t.high)?.url || fallback,
      };
    }
  }
  return out;
}

/** Everything the page needs as plain JSON (also the format of tests/fixtures/channel.json). */
export async function fetchChannelData(config, { key, fetch: fetchImpl = fetch, now = new Date() } = {}) {
  if (!key) {
    throw new Error('YOUTUBE_API_KEY is not set. Add it in Vercel (Settings → Environment Variables), or put YOUTUBE_API_KEY=... in .env.local for a local build.');
  }
  const playlists = {};
  for (const id of [...config.shows.map((s) => s.playlistId), config.shorts.playlistId]) {
    playlists[id] = await listPlaylist(id, { key, fetch: fetchImpl });
  }
  const ids = [...new Set(Object.values(playlists).flat().map((p) => p.videoId))];
  const videos = await getVideos(ids, { key, fetch: fetchImpl });
  return { fetchedAt: now.toISOString(), playlists, videos };
}
