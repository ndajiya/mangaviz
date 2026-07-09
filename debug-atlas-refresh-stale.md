# [OPEN] Atlas Refresh Stale

## Session
- sessionId: `atlas-refresh-stale`
- startedAt: `2026-07-08`
- symptom: Atlas refresh completes, but newly expected manga do not appear in Atlas output.

## Hypotheses
- H1: The GitHub Action is still running an older workflow or older collector code path than the one now on disk.
- H2: The collector is building candidate IDs, but too few detail records are being fetched and persisted, so the graph rebuild keeps resembling the prior dataset.
- H3: The refresh workflow is succeeding, but `public/data/*` is not changing enough to produce a meaningful Atlas diff or redeploy-visible result.
- H4: The chosen strategy is reaching upstream search/release endpoints, but the title-to-series resolution step is returning repeated or low-quality matches, limiting dataset expansion.
- H5: The deployed app is serving stale Atlas assets after refresh because the generated manifest/data or deployment cache is not updating as expected.

## Evidence Log
- Local reproduction with `ATLAS_STRATEGY=latest_published`, `MAX_SERIES=40`, `REQUEST_DELAY=250`, `MIN_DETAIL_SERIES=15` completed successfully.
- Debug log shows:
  - collector start inputs recorded
  - candidate pool reached `100`
  - selected detailed series reached `40`
  - graph build started from `40` persisted detail files
  - manifest written with `seriesCount=40`
- Local `mangaviz/public/data/manifest.json` now reports `strategy=latest_published` and `seriesCount=40`.
- Local git status shows the updated collector/build files and regenerated `mangaviz/public/data/*` are still uncommitted, so GitHub Actions cannot be using these exact changes yet.

## Hypothesis Status
- H1: Likely true for the hosted refresh path. Local evidence proves the new pipeline works on disk, but uncommitted workflow/script changes mean GitHub cannot run them yet.
- H2: Rejected locally. Detail persistence reached `40/40`.
- H3: Rejected locally. `public/data/*` regenerated with a larger dataset and new manifest counts.
- H4: Rejected for the tested `latest_published` path. Candidate pool quality was sufficient and yielded `40` detailed series.
- H5: Inconclusive. Could still affect deployed visibility after the code is pushed, but it is not the first blocker.

## Next Step
- Push the updated workflow/script changes so GitHub Actions can actually execute the new collector, then rerun Atlas refresh and compare the hosted manifest/output.
