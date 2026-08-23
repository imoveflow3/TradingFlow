// Cloudflare Pages Function: /api/news?q=gold OR XAUUSD
// Proxies Google News RSS search (browser CORS blocked, server-side OK).
// Responses cached 10 minutes at the edge. Returns at most MAX_ITEMS headlines.
// Note: the Workers runtime has no DOMParser, so the RSS is parsed with regex.

const CACHE_TTL = 600;
const MAX_ITEMS = 8;
const MAX_Q = 200;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, MAX_Q);
  if (!q) return json({ error: 'q required' }, 400);

  // Edge cache check
  const cacheKey = new Request(url.origin + '/api/news?q=' + encodeURIComponent(q));
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const feed = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:2d')
      + '&hl=en-US&gl=US&ceid=US:en';
    const res = await fetch(feed, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
    if (!res.ok) return json({ error: 'upstream ' + res.status }, 502);
    const xml = await res.text();

    const items = [];
    const blocks = xml.split('<item>').slice(1);
    for (const b of blocks) {
      if (items.length >= MAX_ITEMS) break;
      const raw = b.split('</item>')[0];
      const title = tag(raw, 'title');
      if (!title) continue;
      const source = tag(raw, 'source');
      items.push({
        // Google appends " - Source" to titles; strip it when we have the source separately
        title: source && title.endsWith(' - ' + source) ? title.slice(0, -(source.length + 3)) : title,
        link: tag(raw, 'link'),
        pubDate: tag(raw, 'pubDate'),
        source: source || '',
      });
    }

    const resp = json(items);
    resp.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e) {
    return json({ error: 'fetch failed' }, 502);
  }
}

function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>'));
  if (!m) return '';
  return decodeEntities(m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim());
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
