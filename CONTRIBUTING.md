# Contributing

This is a static, zero-runtime-dependency site. Keep it that way unless there is a measured reason not to.

## Setup

```bash
npm run build:site
python -m http.server 8000 -d _site
```

## Before opening a PR

```bash
npm test
npm run check:layout
npm run lint
npm run format:check
npm run check:static
npm run check:sw
npm run check:matlab
npm run smoke
npm run e2e
npm run perf
npm run budget
```

If you touched generated content:

```bash
npm run matlab:data
npm run matlab:table
npm run build:guide
npm run build:matlab-en
```

Do not edit generated files by hand:

- `about/matlab.html`
- `about/matlab-en.html`
- `landing/en/guide.html`
- `landing/en/lessons.html`
- `data/matlab-probes.json`

Edit the generator or source data and regenerate.

## Conventions

- No runtime npm dependencies; no external animation/font libraries.
- All interactive data stays in the browser; do not add a backend for convenience.
- Add English copy to `shared/i18n.js` or a dedicated `*-en.js` data file.
- Respect `prefers-reduced-motion`; do not add autoplaying infinite motion.
- Keep `chart.js` copies in sync via `npm run sync:chart`.
- Update `landing/sitemap.xml`, `landing/sw.js` and visual baselines when adding a page.
- Run `npm run live` after deployment; the Live smoke workflow is not a substitute for checking the page yourself.

## Commit style

Use a short imperative summary, e.g.:

```
feat: add English guide search
fix: preserve canonical on Worker deploy
docs: add architecture runbook
```

## Review checklist

- [ ] no new runtime dependency
- [ ] no Chinese visible on English pages
- [ ] keyboard/focus/reduced-motion still work
- [ ] no horizontal overflow at 390px
- [ ] generated data still passes `check:matlab`
- [ ] live smoke passes after deploy
