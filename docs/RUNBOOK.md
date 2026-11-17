# Runbook

## Local

```bash
npm run build:site
python -m http.server 8000 -d _site
```

Do not open `landing/index.html` via `file://` for production checks; relative links and service workers differ. File previews deliberately disable motion for screenshot stability.

## Test before merging

```bash
npm test
npm run check:layout
npm run lint
npm run format:check
npm run check:static
npm run check:sw
npm run check:matlab
npm run check:matlab
npm run smoke
npm run e2e
npm run perf
npm run budget
npm run visual
npm run visual:dark
npm run visual:mobile
```

`npm run e2e` requires Edge; `perf`/visual tests use a local server/CDP profile. Generated baselines must be refreshed only when the visual change is intentional:

```bash
npm run visual:update
pwsh -NoProfile -File scripts/visual.ps1 -Update -BaselineDir tests/baselines-ci
npm run visual:dark:update
npm run visual:mobile:update
```

## Deploy

- Primary: push `main`; `.github/workflows/pages.yml` builds GitHub Pages.
- After deployment, the **Live smoke** workflow runs `npm run live` against the canonical URL.
- Backup: `wrangler.jsonc` deploys `_site` to the Cloudflare Worker on Git push.
- Inspect: `https://xingd5478-ctrl.github.io/vibe-lab/`, `/en/guide.html`, `/feedback.html`.

Manual live check:

```bash
npm run live
SITE_BASE=https://your-domain.example npm run live
```

## Rollback

1. Revert the offending commit on `main` (preferred) and push; Pages redeploys.
2. If the Worker is stale, retry its build/deployment in Cloudflare.
3. If a service worker cached a broken shell, bump `CACHE` in `landing/sw.js` and redeploy; users get the new SW on next navigation.

## Caching incidents

Symptom: one page shows `ERR_FAILED` or old content while others work.

1. Hard refresh (`Ctrl/Cmd + F5`).
2. Try `?v=<timestamp>`.
3. Check the Worker/Pages response with `npm run live` and curl.
4. Bump the SW cache version if the shell itself is stale.
5. Record the incident in the issue tracker; do not silently ignore it.

## Analytics and feedback

- GoatCounter: `https://xingdong.goatcounter.com` (privacy-friendly page/event counts).
- GitHub Issues: live feedback dashboard at `/feedback.html`; labels `bug`, `content`, `idea`, `question`, `wontfix`, `feedback`.
- Tally: `https://tally.so/r/9N98bY`; responses stay in Tally, not in the public dashboard.
- Site JS is local-first; no CSV or sensor data is uploaded.

## Domain

Current canonical: `https://xingd5478-ctrl.github.io/vibe-lab/`.

- is-a.dev application was denied (`not dev related`), do not resubmit the same root.
- If buying a domain: point its CNAME at `xingd5478-ctrl.github.io` (or use Cloudflare Pages/Worker custom domain), then run `node scripts/set_domain.mjs <url>` and verify with `npm run live`.
- If keeping `workers.dev`: run `node scripts/set_domain.mjs https://<worker>.workers.dev --no-cname`; it is a mirror, not the primary.

## Incidents

Record user-visible incidents in [docs/INCIDENTS.md](INCIDENTS.md); the Live smoke workflow opens a GitHub issue on failure.

## On-call expectations

This is a static personal project, not a 24/7 service. There is no SLA, no pager, and no server to restart. The meaningful alerts are:

- Pages/Worker deployment failure;
- Live smoke failure;
- broken canonical/Sitemap;
- a feedback issue marked `bug`.

Weekly: read `npm run live`, GoatCounter paths, and the GitHub issue/Tally queues.

