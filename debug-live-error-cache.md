# Debug Session: live-error-cache

Status: OPEN

## Scope
- Identify why the Live-mode error banner appears even when a graph is visible
- Capture the exact branch that triggers the error
- Verify how Live mode interacts with cache and whether it affects Atlas mode
- Document where the relevant cache is stored

## Hypotheses
1. The visible graph comes from cached Live data while the current network refresh still fails, so the UI correctly shows graph plus error.
2. One or more detail requests fail after search succeeds, which leaves partial Live state and triggers the error path.
3. Completely new entries sometimes avoid the banner because they do not hit an existing Live cache entry.
4. Live mode writes to a browser-only Live cache and does not modify Atlas-mode data.
5. The cache in question is IndexedDB under a MangaViz-specific store rather than Atlas JSON assets.

## Evidence Log
- Pending instrumentation and reproduction.

## Notes
- No business-logic fix applied yet in this debugging session.
