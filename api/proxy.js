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
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const uParam = (req.query.u || req.query.pk || '').toString();
    if (!uParam) return res.status(400).end('Missing "u"');

    // ВАЖНО: поддержим и уже закодированный, и обычный URL
    const target = uParam.startsWith('http') ? uParam : decodeURIComponent(uParam);

    // Прокидываем ключевые заголовки (особенно Range)
    const fwd = {};
    if (req.headers.range) fwd['Range'] = req.headers.range;
    if (req.headers['user-agent']) fwd['User-Agent'] = req.headers['user-agent'];
    if (req.headers['accept']) fwd['Accept'] = req.headers['accept'];

    const upstream = await fetch(target, {
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
    if (!res.getHeader('Accept-Ranges')) res.setHeader('Accept-Ranges', 'bytes');

    // Если был Range-запрос, а апстрим дал 200 — отдадим 206
    const wantRange = Boolean(req.headers.range);
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

