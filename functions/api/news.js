// Cloudflare Pages Function: /api/news?s=<symbol>&q=<search terms>
// Returns recent headlines for an instrument.
//
// Source order matters: Google News RSS 503s requests from Cloudflare's
// datacenter egress (verified — it serves residential IPs fine), so Yahoo
// Finance's per-symbol headline feed is primary and Google is the fallback
// for callers that only supply free-text `q`.
//
// Responses cached 10 minutes at the edge; a stale cached copy is served if
// every upstream fails, so a transient outage doesn't blank the UI.

const CACHE_TTL = 600;
const MAX_ITEMS = 8;
const MAX_LEN = 200;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const s = (url.searchParams.get('s') || '').trim().slice(0, MAX_LEN);
  const q = (url.searchParams.get('q') || '').trim().slice(0, MAX_LEN);
  if (!s && !q) return json({ error: 's or q required' }, 400);

  const cache = caches.default;
  const cacheKey = new Request(url.origin + '/api/news?s=' + encodeURIComponent(s) + '&q=' + encodeURIComponent(q));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let items = [];

  // 1) Yahoo Finance per-symbol headlines (reliable from Cloudflare egress)
  if (s) {
    items = await tryFeed(
      'https://feeds.finance.yahoo.com/rss/2.0/headline?s=' + encodeURIComponent(s) + '&region=US&lang=en-US'
    );
  }

  // 2) Google News search fallback (often blocked at the edge, but free-text)
  if (!items.length && q) {
    items = await tryFeed(
      'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:2d') + '&hl=en-US&gl=US&ceid=US:en'
    );
  }

  if (!items.length) {
    // serve stale rather than nothing
    const stale = await cache.match(new Request(cacheKey.url), { ignoreMethod: true });
    if (stale) return stale;
    return json({ error: 'no headlines available' }, 502);
  }

  const resp = json(items);
  resp.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
  context.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

async function tryFeed(feedUrl) {
  try {
    const res = await fetch(feedUrl, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    return parseRss(await res.text());
  } catch (e) {
    return [];
  }
}

// The Workers runtime has no DOMParser, so parse the RSS with regex.
function parseRss(xml) {
  const items = [];
  const blocks = xml.split('<item>').slice(1);
  for (const b of blocks) {
    if (items.length >= MAX_ITEMS) break;
    const raw = b.split('</item>')[0];
    const title = tag(raw, 'title');
    if (!title) continue;
    let source = tag(raw, 'source');
    const link = tag(raw, 'link');
    // Google appends " - Source" to titles; Yahoo has no <source>, derive from host
    if (!source && link) source = hostOf(link);
    items.push({
      title: source && title.endsWith(' - ' + source) ? title.slice(0, -(source.length + 3)) : title,
      link,
      pubDate: tag(raw, 'pubDate'),
      source: source || '',
    });
  }
  return items;
}

function hostOf(link) {
  try { return new URL(link).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
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
