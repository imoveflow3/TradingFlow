// Cloudflare Pages Function: /api/candles?symbol=EURUSD=X&interval=60m
// Proxies Yahoo Finance chart API for OHLC history. Edge-cached.

const RANGE_FOR = {
  '1m': '2d', '5m': '5d', '15m': '1mo', '60m': '3mo', '1d': '1y', '1wk': '5y',
};
const CACHE_TTL = 120;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const symbol = (url.searchParams.get('symbol') || '').trim();
  const interval = (url.searchParams.get('interval') || '1d').trim();
  if (!symbol) return json({ error: 'symbol required' }, 400);
  if (!RANGE_FOR[interval]) return json({ error: 'bad interval' }, 400);

  const cacheKey = new Request(url.origin + '/api/candles?symbol=' + encodeURIComponent(symbol) + '&interval=' + interval);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol)
      + '?interval=' + interval + '&range=' + RANGE_FOR[interval];
    const res = await fetch(yUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
    if (!res.ok) return json({ error: 'upstream ' + res.status }, 502);
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    const q = r?.indicators?.quote?.[0];
    if (!r || !q) return json({ error: 'no data' }, 404);

    const out = { symbol: r.meta?.symbol, price: r.meta?.regularMarketPrice, t: [], o: [], h: [], l: [], c: [] };
    const ts = r.timestamp || [];
    for (let i = 0; i < ts.length; i++) {
      if (q.close[i] == null || q.open[i] == null) continue;
      out.t.push(ts[i]);
      out.o.push(q.open[i]);
      out.h.push(q.high[i]);
      out.l.push(q.low[i]);
      out.c.push(q.close[i]);
    }
    const resp = json(out);
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
