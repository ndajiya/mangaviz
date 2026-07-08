import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = '__Host-mangaviz_atlas_admin';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginAttemptStore = new Map();

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      pragma: 'no-cache',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });

const base64url = (value) => Buffer.from(value, 'utf8').toString('base64url');
const fromBase64url = (value) => Buffer.from(value, 'base64url').toString('utf8');

const safeEqual = (received, expected) => {
  const left = Buffer.from(received || '', 'utf8');
  const right = Buffer.from(expected || '', 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
};

const getSessionSecret = () => process.env.ATLAS_SESSION_SECRET || '';
const getAdminPassword = () => process.env.ATLAS_ADMIN_PASSWORD || process.env.ATLAS_ADMIN_TOKEN || '';

const sign = (payload) => {
  const secret = getSessionSecret();
  return createHmac('sha256', secret).update(payload).digest('base64url');
};

const serializeCookie = (requestUrl, value, maxAge) => {
  const secure = requestUrl.startsWith('https://') || requestUrl.startsWith('http://localhost');
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Max-Age=${maxAge}`;
};

const parseCookies = (request) => {
  const header = request.headers.get('cookie') || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        return idx === -1 ? [part, ''] : [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
};

const getClientKey = (request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstHop = forwardedFor.split(',')[0]?.trim();
    if (firstHop) return `ip:${firstHop}`;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return `ip:${realIp}`;
  return 'ip:unknown';
};

const pruneLoginAttempts = (now) => {
  for (const [key, record] of loginAttemptStore.entries()) {
    if ((record.lockedUntil && record.lockedUntil <= now) || record.lastAttemptAt + LOGIN_WINDOW_MS <= now) {
      loginAttemptStore.delete(key);
    }
  }
};

export const ensureAdminConfig = () => {
  const password = getAdminPassword();
  const sessionSecret = getSessionSecret();
  if (!password || !sessionSecret) {
    return {
      ok: false,
      response: json(500, {
        error: 'atlas_admin_misconfigured',
        message: 'Atlas admin auth requires ATLAS_ADMIN_PASSWORD and ATLAS_SESSION_SECRET.',
      }),
    };
  }
  return { ok: true, password, sessionSecret };
};

export const assertSameOrigin = (request) => {
  const origin = request.headers.get('origin') || request.headers.get('referer');
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return requestUrl.origin === originUrl.origin;
  } catch {
    return false;
  }
};

export const validateAdminPassword = (candidate) => safeEqual(candidate || '', getAdminPassword());

export const getLoginRateLimit = (request) => {
  const now = Date.now();
  pruneLoginAttempts(now);
  const record = loginAttemptStore.get(getClientKey(request));
  if (!record || !record.lockedUntil || record.lockedUntil <= now) {
    return { ok: true };
  }
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
  };
};

export const recordFailedLogin = (request) => {
  const now = Date.now();
  pruneLoginAttempts(now);
  const key = getClientKey(request);
  const existing = loginAttemptStore.get(key);
  const withinWindow = existing && existing.lastAttemptAt + LOGIN_WINDOW_MS > now;
  const failures = withinWindow ? existing.failures + 1 : 1;
  const nextRecord = {
    failures,
    lastAttemptAt: now,
    lockedUntil: failures >= LOGIN_MAX_FAILURES ? now + LOGIN_LOCKOUT_MS : 0,
  };
  loginAttemptStore.set(key, nextRecord);
  return {
    failures,
    retryAfterSeconds: nextRecord.lockedUntil ? Math.max(1, Math.ceil((nextRecord.lockedUntil - now) / 1000)) : 0,
  };
};

export const clearFailedLogins = (request) => {
  loginAttemptStore.delete(getClientKey(request));
};

export const createSessionCookie = (requestUrl) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ role: 'atlas_admin', iat: now, exp: now + SESSION_TTL_SECONDS });
  const encodedPayload = base64url(payload);
  const signature = sign(encodedPayload);
  return serializeCookie(requestUrl, `${encodedPayload}.${signature}`, SESSION_TTL_SECONDS);
};

export const clearSessionCookie = (requestUrl) => serializeCookie(requestUrl, '', 0);

export const getAdminSession = (request) => {
  const config = ensureAdminConfig();
  if (!config.ok) return { ok: false, reason: 'misconfigured' };
  const cookies = parseCookies(request);
  const rawCookie = cookies[SESSION_COOKIE];
  if (!rawCookie) return { ok: false, reason: 'missing' };
  const [encodedPayload, signature] = rawCookie.split('.');
  if (!encodedPayload || !signature) return { ok: false, reason: 'malformed' };
  const expected = sign(encodedPayload);
  if (!safeEqual(signature, expected)) return { ok: false, reason: 'invalid_signature' };
  try {
    const payload = JSON.parse(fromBase64url(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.role !== 'atlas_admin' || typeof payload.exp !== 'number' || payload.exp <= now) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }
};
