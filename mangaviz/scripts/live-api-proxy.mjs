import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const PORT = Number(process.env.LIVE_API_PROXY_PORT || 8787);
const TARGET = 'https://api.mangaupdates.com';

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = reqUrl.pathname.replace(/^\/api\/mangaupdates/, '');
  const targetUrl = new URL(`${TARGET}/v1${path}${reqUrl.search}`);

  const headers = {
    ...req.headers,
    host: targetUrl.host,
    origin: TARGET,
    referer: targetUrl.toString(),
  };
  delete headers['content-length'];
  delete headers['host'];

  const proxyReq = https.request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || 443,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Credentials': 'true',
      });
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('Proxy error', err);
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    });
    res.end(JSON.stringify({ error: 'proxy_error', message: err.message }));
  });

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Allow-Credentials': 'true',
    });
    res.end();
    return;
  }

  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Live API proxy listening on http://0.0.0.0:${PORT}`);
});
