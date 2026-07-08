export const runtime = 'nodejs';

const UPSTREAM_BASE = 'https://api.mangaupdates.com/v1';

const buildUpstreamUrl = (requestUrl) => {
  const incoming = new URL(requestUrl);
  const rawPath = incoming.searchParams.get('path') || '';
  const normalizedPath = rawPath ? `/${rawPath.replace(/^\/+/, '')}` : '/';
  const upstream = new URL(`${UPSTREAM_BASE}${normalizedPath}`);
  for (const [key, value] of incoming.searchParams.entries()) {
    if (key !== 'path') upstream.searchParams.append(key, value);
  }
  return upstream;
};

const buildForwardHeaders = (requestHeaders) => {
  const headers = new Headers(requestHeaders);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('accept-encoding');
  headers.set('accept', headers.get('accept') || 'application/json');
  headers.set('accept-encoding', 'identity');
  headers.set('content-type', headers.get('content-type') || 'application/json');
  headers.set('user-agent', headers.get('user-agent') || 'Mozilla/5.0');
  headers.set('origin', 'https://www.mangaupdates.com');
  headers.set('referer', 'https://www.mangaupdates.com/');
  return headers;
};

const proxy = async (request) => {
  const upstreamUrl = buildUpstreamUrl(request.url);
  const method = request.method || 'GET';
  const headers = buildForwardHeaders(request.headers);
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body: body && body.length > 0 ? body : undefined,
    });

    const responseBody = await upstreamResponse.arrayBuffer();
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    return new Response(responseBody, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'proxy_failure',
        message: error instanceof Error ? error.message : 'unknown error',
      }),
      {
        status: 502,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
};

export async function GET(request) {
  return proxy(request);
}

export async function POST(request) {
  return proxy(request);
}

export async function HEAD(request) {
  return proxy(request);
}
