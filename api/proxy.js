export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Range,User-Agent');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const u = (req.query.u || req.query.pk || '').toString();
    if (!u) return res.status(400).end('Missing ?u');

    const headers = {};
    if (req.headers.range) headers['Range'] = req.headers.range;

    const upstream = await fetch(u, { headers, redirect: 'follow' });

    const pass = ['content-type','content-length','accept-ranges','content-range'];
    pass.forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    res.status(upstream.status);
    const { Readable } = await import('node:stream');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    res.status(502).end('Proxy error: ' + e.message);
  }
}
