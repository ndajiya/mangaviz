export const runtime = 'nodejs';

import {
  assertSameOrigin,
  clearFailedLogins,
  clearSessionCookie,
  createSessionCookie,
  ensureAdminConfig,
  getAdminSession,
  getLoginRateLimit,
  json,
  recordFailedLogin,
  validateAdminPassword,
} from './_session.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request) {
  const config = ensureAdminConfig();
  if (!config.ok) return config.response;
  const session = getAdminSession(request);
  return json(200, { authenticated: session.ok });
}

export async function POST(request) {
  const config = ensureAdminConfig();
  if (!config.ok) return config.response;
  if (!assertSameOrigin(request)) {
    return json(403, { error: 'forbidden_origin', message: 'Admin login must originate from the same site.' });
  }
  const rateLimit = getLoginRateLimit(request);
  if (!rateLimit.ok) {
    return json(
      429,
      {
        error: 'too_many_attempts',
        message: 'Too many failed admin login attempts. Try again later.',
      },
      { 'retry-after': String(rateLimit.retryAfterSeconds) },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'invalid_json', message: 'Request body must be valid JSON.' });
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  if (!validateAdminPassword(password)) {
    const failure = recordFailedLogin(request);
    await sleep(500);
    return json(
      401,
      {
        error: 'unauthorized',
        message: failure.retryAfterSeconds
          ? 'Admin password is invalid. Too many failed attempts will temporarily lock this endpoint.'
          : 'Admin password is invalid.',
      },
      failure.retryAfterSeconds ? { 'retry-after': String(failure.retryAfterSeconds) } : undefined,
    );
  }
  clearFailedLogins(request);

  return json(
    200,
    { authenticated: true, message: 'Atlas admin session started.' },
    { 'set-cookie': createSessionCookie(request.url) },
  );
}

export async function DELETE(request) {
  const config = ensureAdminConfig();
  if (!config.ok) return config.response;
  if (!assertSameOrigin(request)) {
    return json(403, { error: 'forbidden_origin', message: 'Admin logout must originate from the same site.' });
  }
  return json(
    200,
    { authenticated: false, message: 'Atlas admin session cleared.' },
    { 'set-cookie': clearSessionCookie(request.url) },
  );
}
