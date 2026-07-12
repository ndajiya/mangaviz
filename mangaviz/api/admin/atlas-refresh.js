export const runtime = 'nodejs';

import { assertSameOrigin, ensureAdminConfig, getAdminSession, json } from './_session.js';

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const VALID_STRATEGIES = new Set([
  'latest_updated',
  'latest_published',
  'recent_popularity',
  'mixed_seed_queries',
]);

const sanitizeSeed = (value) => {
  if (typeof value !== 'string') return '';
  const seed = value.trim();
  if (!seed) return '';
  return seed.slice(0, 200);
};

const isValidRef = (value) =>
  typeof value === 'string'
  && value.length > 0
  && value.length <= 120
  && /^[A-Za-z0-9._/-]+$/.test(value)
  && !value.startsWith('/')
  && !value.endsWith('/')
  && !value.includes('..');

export async function POST(request) {
  const adminConfig = ensureAdminConfig();
  const githubToken = process.env.GITHUB_ATLAS_TRIGGER_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const defaultRef = process.env.GITHUB_ATLAS_REF || 'main';

  if (!adminConfig.ok) return adminConfig.response;
  if (!githubToken || !owner || !repo) {
    return json(500, {
      error: 'atlas_admin_misconfigured',
      message: 'Atlas admin trigger is missing required server-side environment variables.',
    });
  }
  if (!assertSameOrigin(request)) {
    return json(403, {
      error: 'forbidden_origin',
      message: 'Atlas refresh must originate from the same site.',
    });
  }
  const session = getAdminSession(request);
  if (!session.ok) {
    return json(401, {
      error: 'unauthorized',
      message: 'Atlas admin session is missing or expired.',
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, {
      error: 'invalid_json',
      message: 'Request body must be valid JSON.',
    });
  }

  const mode = payload?.mode === 'pr' ? 'pr' : 'direct';
  const strategy = VALID_STRATEGIES.has(payload?.strategy) ? payload.strategy : 'mixed_seed_queries';
  const seed = sanitizeSeed(payload?.seed);
  const maxSeries = clampInteger(payload?.maxSeries, 500, 25, 5000);
  const requestDelay = clampInteger(payload?.requestDelay, 800, 200, 5000);
  const requestedRef = typeof payload?.ref === 'string' && payload.ref.trim() ? payload.ref.trim() : defaultRef;
  if (!isValidRef(requestedRef)) {
    return json(400, {
      error: 'invalid_ref',
      message: 'Atlas refresh branch/ref contains unsupported characters.',
    });
  }
  const ref = requestedRef;

  const dispatchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${githubToken}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'mangaviz-atlas-admin',
    },
    body: JSON.stringify({
      event_type: 'atlas_refresh_requested',
      client_payload: {
        mode,
        strategy,
        seed,
        max_series: String(maxSeries),
        request_delay: String(requestDelay),
        ref,
        triggered_via: 'vercel_admin',
      },
    }),
  });

  if (!dispatchResponse.ok) {
    const failureText = await dispatchResponse.text();
    return json(502, {
      error: 'github_dispatch_failed',
      message: 'GitHub rejected the Atlas refresh dispatch.',
      details: failureText,
    });
  }

  return json(202, {
    ok: true,
    message: mode === 'pr'
      ? 'Atlas refresh workflow dispatched in PR review mode.'
      : 'Atlas refresh workflow dispatched in direct deploy mode.',
    workflow: 'atlas-refresh.yml',
    eventType: 'atlas_refresh_requested',
    mode,
    strategy,
    seed,
    ref,
    maxSeries,
    requestDelay,
  });
}
