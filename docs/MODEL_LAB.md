# Model Lab (V0.1)

**Status:** initial working version, not the full V1 scope.

## Route

- Source: `model-lab/static/`
- Deploy: `/model/`
- Nav label: `Model`

## Implemented

- 3 virtual plants: heater, DC motor, mass-spring-damper
- CSV `t,u,y` import, local only
- Data Quality Report (hard blockers + warnings)
- FOPDT and SOPDT step identification
- ARX (2/2/1) with 70/30 train/validation split
- train/validation FIT and validation shading in the chart
- FIT/residual/stability display, physical truth comparison for virtual plants
- copy/download MATLAB `.m`
- SOPDT link to Control Play
- Chinese/English UI, dark mode, Android layout
- unit tests for data, quality, identification

## Not in V0.1

- ETFE, MIMO, closed-loop and nonlinear identification
- manual chapters and full English guide
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
