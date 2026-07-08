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
- Pending instrumentation and reproduction.

## Notes
- No business-logic changes applied in this session before collecting runtime evidence.
