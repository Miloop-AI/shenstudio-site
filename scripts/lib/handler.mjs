// The request handler behind "/" (api/home.mjs), with its dependencies injected so it can be tested offline.
// Vercel's CDN keeps a successful page for 10 minutes; the next visitor after that gets a freshly rendered one.
export const LIVE_CACHE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=60';
// If YouTube can't be read, serve the deploy-time page and try again after a minute.
export const FALLBACK_CACHE = 'public, max-age=0, s-maxage=60';

export function createHandler({ render, readFallback, log = console.error }) {
  return async function handler(req, res) {
    let html;
    let cache = LIVE_CACHE;
    try {
      ({ html } = await render());
    } catch (err) {
      log('Live render failed, serving the deploy-time page:', err?.message || err);
      html = readFallback();
      cache = FALLBACK_CACHE;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', cache);
    res.status(200).send(html);
  };
}
