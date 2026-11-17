# Incidents and known issues

This is a static personal project, not a 24/7 service. Record user-visible incidents here
so the next maintainer does not rediscover them.

## Template

```md
## YYYY-MM-DD — short title

- Impact:
- Detection:
- Cause:
- Fix:
- Follow-up:
```

## 2026-11 — feedback page served a cached error

- Impact: `/feedback.html` returned `ERR_FAILED` for some browsers.
- Detection: manual feedback link test.
- Cause: stale service-worker cache and a cached bad response.
- Fix: `feedback.html?v=2`, hard refresh guidance, cache version bump.
- Follow-up: the SW asset check (`npm run check:sw`) now runs in CI.

## 2026-11 — visual baselines depended on OS theme

- Impact: light baselines were captured dark on a dark host; CI produced ~99% false diffs.
- Detection: CI visual job.
- Cause: `visual.ps1` used the host `prefers-color-scheme`.
- Fix: CI baselines are light, mobile/dark harnesses emulate their scheme and reduced motion.
- Follow-up: the local `visual.ps1` still uses the host scheme; CI is authoritative.

## 2026-11 — ESM app served with wrong MIME in test harness

- Impact: Simulink module did not execute in one harness.
- Detection: e2e/perf timeout.
- Cause: test servers did not map `.mjs` to a JavaScript MIME type.
- Fix: `.mjs` MIME added to e2e/perf/smoke/dark/mobile servers.
- Follow-up: keep `.mjs` in the server MIME map when adding a harness.

## Open known issues

- No dedicated error aggregator (Sentry/GlitchTip); page/event counts only.
- No physical iOS/Android device lab; mobile is emulated.
- CSP/SRI are not enforced because GitHub Pages cannot set response headers.
- Tally and GitHub Issues are intentionally separate; no unified private dashboard.
