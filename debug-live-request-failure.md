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
- User-reported deployed failure on `https://mangaviz.vercel.app/` shows `Live Request Failed` with `MangaUpdates live request failed. configured proxy: API 405`.
- User confirmed the failing deployed request is `POST /api/mangaupdates/series/search`, not a detail request and not a static asset.
- This combination falsifies the direct-API/CORS hypothesis for the current regression and strongly supports a Vercel routing mismatch where the SPA fallback is still intercepting `/api/...` POST requests in production.

## Applied Fix
- Updated `mangaviz/vercel.json` to use a rewrite that excludes `/api/` paths from the SPA fallback.
- Rationale: if API routes are not rewritten to `index.html`, Vercel can route `/api/mangaupdates/series/search` to the serverless function instead of returning `405` for a POST against a static page.

## Notes
- No business-logic changes applied in this session before collecting runtime evidence.
