// Checks src/site.json so a typo fails the build with a clear message instead of producing a broken page.
const RESERVED = new Set(['top', 'latest', 'shorts', 'about', 'connect']);

export function validateConfig(c) {
  const need = (ok, msg) => { if (!ok) throw new Error(`src/site.json: ${msg}`); };
  need(c && typeof c === 'object', 'must be a JSON object');
  for (const k of ['siteName', 'tagline', 'description', 'email']) need(typeof c[k] === 'string' && c[k].trim(), `"${k}" is required`);
  need(c.email.includes('@'), '"email" must be an email address');
  need(c.host?.name, '"host.name" is required');
  need(c.channel?.id && String(c.channel?.handle || '').startsWith('@'), '"channel.id" and "channel.handle" (starting with @) are required');
  need(Array.isArray(c.shows) && c.shows.length > 0, '"shows" must be a non-empty list');
  const keys = new Set();
  for (const s of c.shows) {
    const name = s.name || s.key || '?';
    need(/^[a-z][a-z0-9-]*$/.test(s.key || ''), `show "${name}": "key" must be lower-case letters/digits (it is the page anchor)`);
    need(!RESERVED.has(s.key), `show "${name}": key "${s.key}" is reserved for another part of the page`);
    need(!keys.has(s.key), `show key "${s.key}" is used twice`);
    keys.add(s.key);
    need(s.playlistId && s.name && s.eyebrow, `show "${name}": "playlistId", "name" and "eyebrow" are required`);
    const sc = s.schedule || {};
    if (sc.type === 'weekly') {
      need(Number.isInteger(sc.weekday) && sc.weekday >= 0 && sc.weekday <= 6, `show "${name}": schedule.weekday must be 0 (Sunday) … 6 (Saturday)`);
      need(/^([01]\d|2[0-3]):[0-5]\d$/.test(sc.time || ''), `show "${name}": schedule.time must look like "18:30"`);
      need(sc.label, `show "${name}": schedule.label is required (for example "每周五")`);
    } else {
      need(sc.type === 'latest', `show "${name}": schedule.type must be "weekly" or "latest"`);
    }
  }
  need(c.shorts?.playlistId && c.shorts?.name, '"shorts.playlistId" and "shorts.name" are required');
  need(Number.isInteger(c.cardsPerShow) && c.cardsPerShow > 0, '"cardsPerShow" must be a positive whole number');
  need(Number.isInteger(c.rowsPerShow) && c.rowsPerShow > 0, '"rowsPerShow" must be a positive whole number');
  need(Number.isInteger(c.shortsCount) && c.shortsCount > 0, '"shortsCount" must be a positive whole number');
  need(c.about?.heading && Array.isArray(c.about?.paragraphs), '"about.heading" and "about.paragraphs" are required');
  need(c.collab?.heading, '"collab.heading" is required');
  need(Array.isArray(c.platforms), '"platforms" must be a list');
  for (const p of c.platforms) need(p.name && p.handle && p.icon, `platform "${p.name || '?'}": "name", "handle" and "icon" are required`);
  return c;
}
