# Debug Session: live-request-failure

Status: OPEN

## Scope
- Identify why Live requests are failing again after previously working during testing
- Capture the exact request route and failure branch at runtime
- Compare current runtime behavior against prior successful local behavior
- Apply a minimal fix only after evidence confirms the root cause

## Hypotheses
1. The runtime request path is bypassing the intended proxy and hitting a direct MangaUpdates URL that fails in-browser.
2. Environment-specific rewrite or origin behavior is breaking one or more proxy routes outside the local test path.
3. Search succeeds but one or more detail requests fail, causing Live mode to surface an error after partial success.
4. Cached Live data is masking or altering the user-visible symptoms, making testing look successful while current runtime fails.
5. The current instrumentation does not yet reveal the full per-route attempt sequence, so request-level evidence is still missing.

## Evidence Log
- Local reproduction succeeded through the configured proxy for `Naruto` and `Giant Killing`; search and all detail requests returned `200`, and IndexedDB cache writes completed.
- Runtime trace file: `.dbg/trae-debug-log-live-request-failure.ndjson`
- User-reported deployed failure first showed `405` on `POST /api/mangaupdates/series/search`, then after the rewrite change it shifted to `404 NOT_FOUND` with `x-vercel-error: NOT_FOUND`.
- User confirmed the failing deployed request is still `POST /api/mangaupdates/series/search`, not a detail request and not a static asset.
- The shift from `405` to `404 NOT_FOUND` falsifies the idea that the upstream MangaUpdates API is the immediate cause. Production is now reaching Vercel edge routing, but the proxy endpoint itself is not being published at that path.
- Current strongest explanation: the catch-all function file shape `api/mangaupdates/[...path].js` is not being discovered/published the way the app expects in this Vite deployment.

## Applied Fix
- Updated `mangaviz/vercel.json` to use a rewrite that excludes `/api/` paths from the SPA fallback.
- Rationale: if API routes are not rewritten to `index.html`, Vercel can route `/api/mangaupdates/series/search` to the serverless function instead of returning `405` for a POST against a static page.
- Replaced the catch-all proxy file with a concrete function at `mangaviz/api/mangaupdates.js`.
- Added an explicit rewrite from `/api/mangaupdates/(.*)` to `/api/mangaupdates?path=$1` so production resolves all Live proxy requests through a single known function route.

## Notes
- No business-logic changes applied in this session before collecting runtime evidence.
