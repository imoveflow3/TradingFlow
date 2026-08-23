// Cloudflare Pages Function: /api/calendar
// Proxies the ForexFactory weekly economic calendar (browser CORS blocked, server-side OK).
// Responses cached 30 minutes at the edge — the schedule rarely changes intraday.

const CACHE_TTL = 1800;
const FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  // Edge cache check
  const cacheKey = new Request(url.origin + '/api/calendar');
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const res = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
    if (!res.ok) return json({ error: 'upstream ' + res.status }, 502);
    const data = await res.json();
    if (!Array.isArray(data)) return json({ error: 'unexpected feed shape' }, 502);

    const resp = json(data);
    resp.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e) {
    return json({ error: 'fetch failed' }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
