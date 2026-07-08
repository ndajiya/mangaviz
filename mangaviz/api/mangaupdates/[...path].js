export default async function handler(req, res) {
  const path = Array.isArray(req.query?.path) ? req.query.path.join('/') : (req.query?.path || '');
  const targetPath = path ? `/${path}` : '/';
  const upstreamUrl = new URL(`https://api.mangaupdates.com/v1${targetPath}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.set('accept', headers.get('accept') || 'application/json');
  headers.set('content-type', headers.get('content-type') || 'application/json');
  headers.set('user-agent', headers.get('user-agent') || 'Mozilla/5.0');
  headers.set('origin', 'https://www.mangaupdates.com');
  headers.set('referer', 'https://www.mangaupdates.com/');

  try {
    const body =
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : typeof req.body === 'string' || req.body instanceof Uint8Array || Buffer.isBuffer(req.body)
          ? req.body
          : JSON.stringify(req.body ?? {});
    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseBody = Buffer.from(await response.arrayBuffer());
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });
    res.setHeader('content-length', responseBody.length);
    res.end(responseBody);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'proxy_failure', message: error instanceof Error ? error.message : 'unknown error' }));
  }
}
