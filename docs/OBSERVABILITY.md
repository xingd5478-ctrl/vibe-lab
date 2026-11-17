# Observability

## What is already measured

- **GoatCounter** page/event counts: `https://xingdong.goatcounter.com`.
- **CTA events**: `cta-imu`, `cta-simulink`, `open-*`, `scope-replay`.
- **JS errors**: `event/js-error` on `error` / `unhandledrejection`; no stack or user data is sent.
- **Live smoke**: `npm run live` checks 8 endpoints; GitHub Actions opens an issue on failure.
- **Incidents**: [INCIDENTS.md](INCIDENTS.md).

## Error aggregation (optional, needs an account)

The current `js-error` event is a count, not a grouped stack trace. For grouping, use a
free Sentry or GlitchTip project:

1. Create a project in Sentry/GlitchTip; copy the browser DSN.
2. Do **not** commit the DSN as a secret; a public static DSN is acceptable but treat it as public.
3. Add the Sentry browser SDK with an explicit version and SRI, or self-host the SDK.
4. Initialize only when `window.VIBE_SENTRY_DSN` is set; keep `sendDefaultPii: false`.
5. Add the SDK domain to the CSP plan in [SECURITY.md](SECURITY.md).
6. Verify with a deliberate `throw new Error("sentry-check")` on a preview, then remove it.

Until a project exists, GoatCounter `event/js-error` plus the GitHub incident issue is the
honest baseline. Do not claim stack-level monitoring.

## Alerting

- Live smoke failure → GitHub issue titled `Live smoke failed` (workflow in `.github/workflows/live.yml`).
- Deployment failure → GitHub Actions notification.
- No pager/SLA; this is a static personal project.

## Public status

There is no separate status page. `/feedback.html` is the user-facing issue dashboard;
`docs/INCIDENTS.md` is the maintainer log. Add a short incident entry when users are affected.
