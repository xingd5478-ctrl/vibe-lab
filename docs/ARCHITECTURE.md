# Architecture

## Runtime boundaries

```
Browser
├── landing/                 home, 404, feedback
├── imu-lab/static/          → /imu
├── control-play/            → /control
├── simulink/                → /simulink, course reader, 43 demos
├── about/                   method + MATLAB provenance
├── shared/i18n.js           bilingual dictionary + MutationObserver
├── shared assets            manifest, icons, service worker (landing/sw.js)
└── data/                    generated JSON + feedback snapshot
```

No backend, no database, no auth. All interactive computation is local. The 43 Simulink models are simulated offline with MATLAB R2025a; their results and SHA-256 ship as `data/matlab-probes.json`.

## Data flow

```
tools/probe_all.m
  → MATLAB <batch> 43 × .slx
  → artifacts/simulink/probes.json
  → scripts/build_matlab_data.mjs
  → data/matlab-probes.json
  → scripts/build_matlab_table.mjs
  → about/matlab.html
```

`npm run check:matlab` re-runs the generator and verifies 43 rows, model hashes and table sync.

```
simulink/lessons.js + guide-en.js
  → scripts/build_en_guide.mjs
  → landing/en/guide.html
```

`landing/en/lessons.html` and `about/matlab-en.html` are generated the same way.

## Deployments

| Target | Build | Notes |
|---|---|---|
| GitHub Pages | `.github/workflows/pages.yml` | primary, mobile-accessible |
| Cloudflare Worker | `wrangler.jsonc` assets `_site` | backup, `workers.dev` |
| Any static host | `npm run build:site` | writes `_site/` |

Canonical URL is currently `https://xingd5478-ctrl.github.io/vibe-lab/`. The Worker is a mirror; keep only one canonical.

## Where to extend

- New tool: add a directory and copy the `landing` conventions; add to nav and Sitemap.
- New MATLAB lesson: add to `tools/probe_all.m`, `simulink/lessons.js`, `data`; rerun `matlab:data` + `matlab:table`.
- New English content: add to `shared/i18n.js` or a `*-en.js` data file; add an e2e no-CJK check.
- New page: add to `landing` or tool directory, Sitemap, SW precache list, and visual baseline.

## Known debt

- `simulink/app.js` (≈56 KB), `guide.js` (≈56 KB) are monoliths.
- Top navigation is generated from `scripts/site_layout.mjs` (`npm run layout`); the footer remains page-specific and is still duplicated.
- `chart.js` is copied into `imu-lab`, `control-play`, `simulink`; `npm run check:chart` keeps them in sync.
- i18n uses Chinese source strings as dictionary keys and a MutationObserver; static metadata is improved at runtime. ESLint/Prettier currently cover `scripts/`, `tests/`, `shared/i18n.js` and `landing/motion.js`, not every browser module.
- Service worker cache version and asset list are maintained by hand.
- Browser tests run on Edge/Chromium only; no real iOS/Safari/Firefox device lab.
- No client error monitor; GoatCounter is page/event analytics only.
- No lint/typecheck step; tests are the main safety net.
