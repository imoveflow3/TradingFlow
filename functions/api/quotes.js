// Cloudflare Pages Function: /api/quotes?symbols=AAPL,MSFT,...
// Proxies Yahoo Finance spark API (browser CORS blocked, server-side OK).
// Responses cached 60s at the edge to stay well under rate limits.

const CHUNK = 20;
const CACHE_TTL = 60;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('symbols') || '').trim();
  if (!raw) return json({ error: 'symbols required' }, 400);

  const symbols = [...new Set(raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))].slice(0, 200);

  // Edge cache check
  const cacheKey = new Request(url.origin + '/api/quotes?symbols=' + symbols.slice().sort().join(','));
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const out = {};
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));

  await Promise.all(chunks.map(async chunk => {
    try {
      const yUrl = 'https://query1.finance.yahoo.com/v7/finance/spark?symbols='
        + encodeURIComponent(chunk.join(',')) + '&range=1d&interval=15m';
      const res = await fetch(yUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
      if (!res.ok) return;
      const data = await res.json();
      for (const r of data?.spark?.result || []) {
        const meta = r?.response?.[0]?.meta;
        if (!meta || meta.regularMarketPrice == null) continue;
        const prev = meta.previousClose ?? meta.chartPreviousClose;
        out[r.symbol] = {
          price: meta.regularMarketPrice,
          prevClose: prev,
          changePct: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0,
          volume: meta.regularMarketVolume ?? null,
          marketTime: meta.regularMarketTime ?? null,
        };
      }
    } catch (e) { /* chunk failed — others still return */ }
  }));

  const resp = json({ quotes: out, ts: Date.now() });
  resp.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
  context.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
