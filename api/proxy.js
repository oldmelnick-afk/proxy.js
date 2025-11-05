// Позволяет стримить тело без парсера
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS для <audio>
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Range,Accept,Origin,Referer,User-Agent'
  );
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const u = (req.query.u || req.query.pk || '').toString();
    if (!u) {
      res.status(400).end('Missing "u"');
      return;
    }

    // Прокидываем ключевые заголовки (особенно Range)
    const fwd = {};
    if (req.headers.range) fwd['Range'] = req.headers.range;
    if (req.headers['user-agent']) fwd['User-Agent'] = req.headers['user-agent'];
    if (req.headers['accept']) fwd['Accept'] = req.headers['accept'];

    const upstream = await fetch(u, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: fwd,
      redirect: 'follow',
    });

    // Копируем важные заголовки апстрима
    const pass = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified',
      'cache-control'
    ];
    for (const h of pass) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    // Гарантируем Accept-Ranges
    if (!res.getHeader('Accept-Ranges')) res.setHeader('Accept-Ranges', 'bytes');

    // Если запрашивали Range, а апстрим ответил 200 — вернём 206
    const wantRange = !!req.headers.range;
    const status = wantRange && upstream.status === 200 ? 206 : upstream.status;
    res.status(status);

    // Стрим тела без буферизации
    if (upstream.body) {
      const { Readable } = await import('node:stream');
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (e) {
    res.status(502).end('Proxy error: ' + e.message);
  }
}
