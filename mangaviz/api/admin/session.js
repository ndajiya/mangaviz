export const runtime = 'nodejs';

import {
  assertSameOrigin,
  clearFailedLogins,
  clearSessionCookie,
  createSessionCookie,
  ensureAtlasAdmin,
  ensureAdminConfig,
  getAdminSession,
  getLoginRateLimit,
  json,
  recordFailedLogin,
  verifySupabaseAccessToken,
} from './_session.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request) {
  const config = ensureAdminConfig();
  if (!config.ok) return config.response;
  const session = getAdminSession(request);
  return json(200, {
    authenticated: session.ok,
    email: session.ok ? session.payload.email || '' : '',
  });
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

  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : '';
  if (!accessToken) {
    return json(400, {
      error: 'missing_access_token',
      message: 'Supabase access token is required to start an Atlas admin session.',
    });
  }

  const verified = await verifySupabaseAccessToken(accessToken);
  if (!verified.ok) {
    const failure = recordFailedLogin(request);
    await sleep(500);
    return json(
      401,
      {
        error: 'unauthorized',
        message: failure.retryAfterSeconds
          ? 'Supabase sign-in could not be verified. Too many failed attempts will temporarily lock this endpoint.'
          : 'Supabase sign-in could not be verified.',
      },
      failure.retryAfterSeconds ? { 'retry-after': String(failure.retryAfterSeconds) } : undefined,
    );
  }

  const adminCheck = await ensureAtlasAdmin(verified.user.id);
  if (!adminCheck.ok) {
    if (adminCheck.reason === 'not_admin') {
      return json(403, {
        error: 'forbidden',
        message: 'This Supabase user is not authorized for Atlas admin access.',
      });
    }
    return json(500, {
      error: 'admin_lookup_failed',
      message: 'Unable to confirm Atlas admin access against Supabase.',
      details: adminCheck.details,
    });
  }
  clearFailedLogins(request);

  return json(
    200,
    {
      authenticated: true,
      email: verified.user.email || '',
      message: 'Atlas admin session started through Supabase Auth.',
    },
    { 'set-cookie': createSessionCookie(request.url, { sub: verified.user.id, email: verified.user.email }) },
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
