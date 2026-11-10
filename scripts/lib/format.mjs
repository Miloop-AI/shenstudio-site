// Pure helpers that turn YouTube API values into the text shown on the page. No I/O.
const TZ = 'America/Los_Angeles';
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function pacific(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, weekday: WEEKDAY[p.weekday], hour: +p.hour, minute: +p.minute };
}

const CJK_END = /[　-鿿＀-￯]$/;
const joinLines = (p) => p.split('\n').map((l) => l.trim()).filter(Boolean)
  .reduce((acc, l) => (!acc ? l : CJK_END.test(acc) ? acc + l : `${acc} ${l}`), '');

/** "股票涨了10倍却不敢卖？…｜沈琛琛 x Shannon｜财经脱口秀 #tag" -> "股票涨了10倍却不敢卖？…" */
export function cleanTitle(raw) {
  const noTags = String(raw ?? '').replace(/#[^\s#]+/g, ' ');
  const parts = noTags.split(/[｜|]/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return parts[0] || '';
}

/** First prose paragraph of a description (skips hashtag, link and timestamp paragraphs), cut to `max` characters. */
export function firstParagraph(desc, max = 160) {
  const paras = String(desc ?? '').split(/\n\s*\n/).map(joinLines);
  const prose = paras.find((p) => p && !/^(#|https?:\/\/|\d{1,2}:\d{2})/.test(p));
  if (!prose) return '';
  const chars = [...prose];
  return chars.length > max ? chars.slice(0, max).join('') + '…' : prose;
}

/** ISO 8601 duration ("PT25M48S") -> seconds. Anything else -> 0. */
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso ?? ''));
  if (!m) return 0;
  const n = (i) => Number(m[i] || 0);
  return n(1) * 86400 + n(2) * 3600 + n(3) * 60 + n(4);
}

/** 1548 -> "25:48", 3723 -> "1:02:03" */
export function formatDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 5958 -> "5,958 次观看", 31234 -> "3.1万次观看", 20000 -> "2万次观看" */
export function formatViews(n) {
  const v = Number(n) || 0;
  if (v < 10000) return `${v.toLocaleString('en-US')} 次观看`;
  const wan = Math.round(v / 1000) / 10;
  return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万次观看`;
}

/** Pacific-time "11月1日"; the year is added when it differs from `now`'s Pacific year. */
export function formatDate(iso, now = new Date()) {
  const p = pacific(new Date(iso)), q = pacific(now);
  return `${p.year !== q.year ? `${p.year}年` : ''}${p.month}月${p.day}日`;
}

/** Next weekly air date in Pacific time: "今天" before today's air time, else "11月13日". weekday: 0 = Sunday … 6 = Saturday. */
export function nextWeekly(weekday, time, now = new Date()) {
  const p = pacific(now);
  const [hh, mm] = String(time).split(':').map(Number);
  let add = (weekday - p.weekday + 7) % 7;
  if (add === 0 && p.hour * 60 + p.minute >= hh * 60 + mm) add = 7;
  if (add === 0) return '今天';
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + add));
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
