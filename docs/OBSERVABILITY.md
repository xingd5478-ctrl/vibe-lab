# Observability

## What is already measured

- **GoatCounter** page/event counts: `https://xingdong.goatcounter.com`.
- **CTA events**: `cta-imu`, `cta-simulink`, `open-*`, `scope-replay`.
- **JS errors**: `event/js-error` on `error` / `unhandledrejection`; no stack or user data is sent.
- **Live smoke**: `npm run live` checks 8 endpoints; GitHub Actions opens an issue on failure.
- **Incidents**: [INCIDENTS.md](INCIDENTS.md).

## Error aggregation (optional, needs an account)

The site now has a lightweight Sentry/GlitchTip client at `shared/observability.js`. It posts
bounded browser errors (no cookies, no PII, 5 events/page max) directly to the DSN project.
It is **dormant until a DSN is set**. Configure a free Sentry or GlitchTip project:

1. Create a project in Sentry/GlitchTip; copy the browser DSN.
2. Run `npm run sentry:set -- https://<key>@<host>/<project-id>` (the DSN is public, not a server secret).
3. Deploy; `shared/sentry-config.js` now carries the DSN and `shared/observability.js` posts errors.
4. Verify with a deliberate `throw new Error("sentry-check")` on a preview, then remove it.
5. Add the Sentry/GlitchTip host to the CSP `connect-src` in `landing/_headers` (wildcards are pre-added for sentry.io/glitchtip.com).
6. Confirm the event appears with page/tags, then delete it from the test project if desired.

Until a project exists, GoatCounter `event/js-error` plus the GitHub incident issue is the
honest baseline. Do not claim stack-level monitoring.

## Alerting

- Live smoke failure → GitHub issue titled `Live smoke failed` (workflow in `.github/workflows/live.yml`).
- Deployment failure → GitHub Actions notification.
- No pager/SLA; this is a static personal project.

## Public status

There is no separate status page. `/feedback.html` is the user-facing issue dashboard;
`docs/INCIDENTS.md` is the maintainer log. Add a short incident entry when users are affected.
