# Model Lab (V1.0)

**Status:** v1.0 model suite: FOPDT/SOPDT/FIR/ARX/ARMAX/OE/ETFE/Wiener, 2×2/CSV MIMO-ARX, closed-loop 2SLS, Hammerstein prototype, validation, bootstrap and ten-chapter manual.

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

- full nonlinear model families and closed-loop frequency-domain methods (out of scope)
- full English guide for the remaining course pages
- FOPDT link to the first-order Control mode
- adjustable ARX orders (na/nb/nk)
- virtual 2×2 MIMO-ARX experiment
- CSV multi-column mapping (time, multiple inputs, multiple outputs)
- closed-loop PRBS virtual experiment and 2SLS using setpoint r as instrument
- nonlinear tank and Hammerstein ARX prototype
- FIR, OE, ARMAX and Wiener time-domain models
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
