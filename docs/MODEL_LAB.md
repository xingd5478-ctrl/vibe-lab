# Model Lab (V0.6)

**Status:** v0.6: SISO/open-loop/linear lab with FOPDT/SOPDT/ARX/ETFE, validation, bootstrap, ten-chapter manual, first-order Control link and adjustable ARX orders.

## Route

- Source: `model-lab/static/`
- Deploy: `/model/`
- Nav label: `Model`

## Implemented

- 3 virtual plants: heater, DC motor, mass-spring-damper
- CSV `t,u,y` import, local only
- Data Quality Report (hard blockers + warnings)
- FOPDT and SOPDT step identification
- ARX (2/2/1) and 70/30 / 80/20 / all-data split
- ETFE with chirp virtual data and coherence/Bode display
- Manual chapters 1–10 (Chinese/English)
- Residual bootstrap intervals (K/τ/L, wn/ζ/L, ARX a1/b1)
- ARX (2/2/1) with 70/30 train/validation split
- train/validation FIT and validation shading in the chart
- FIT/residual/stability display, physical truth comparison for virtual plants
- copy/download MATLAB `.m`
- SOPDT link to Control Play
- Chinese/English UI, dark mode, Android layout
- unit tests for data, quality, identification

## Not in V0.1

- MIMO, closed-loop and nonlinear identification (explicitly out of scope for v0.6)
- full English guide for the remaining course pages
- FOPDT link to the first-order Control mode
- adjustable ARX orders (na/nb/nk)
- user-configurable ARX orders
- accounts/cloud sync
- manual chapters and full English guide
- bootstrap uncertainty
- training/validation split UI

These are tracked for V1; do not claim them yet.

## Acceptance

```bash
npm test
npm run smoke
npm run e2e
npm run visual
npm run perf
npm run budget
npm run check:sw
```

## Next

1. data-quality edge cases and bad-data fixtures
2. ARX/ETFE
3. 10-chapter manual + English
4. visual baselines and Android acceptance
5. launch
