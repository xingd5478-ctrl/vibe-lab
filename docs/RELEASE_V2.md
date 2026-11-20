# vibe-lab v2.0 release notes

## New in v2.0

### Model Lab

- Ho-Kalman subspace identification (SISO)
  - FIR impulse response → Hankel → A/B/C/D
  - 1–4 order selection
  - benchmark: second-order ARX object, FIT ≈ 99.99
- State-space (ARX realization)
- ARX automatic order selection
- Model recommendation (validation FIT, simpler model on ties)
- Closed-loop frequency identification
  - `T = Y/R` by segmented ETFE
  - `G = T / (C(1−T))` using known PID
  - coherence table
- MIMO state-space (MIMO-ARX block-companion realization)

### IMU Lab

- CSV upload, CRC cleanup, Allan variance, R/Q, Kalman, six-face and temperature calibration
- Calibration projects (`vibe-lab-project`)
- Real-time STM32 serial acquisition is intentionally kept in host software, not in the web UI
- Selectable-text PDF via browser print
  - direct download is image-only and documented

### Control Play

- Phase/gain margins
- IMC first-order initial values
- ZN second-order initial values
- Relay auto-tuning simulation
- Dead time L
- Smith predictor
- URL persistence for `L/aw/tf/umax/smith`
- Local project import from Model Lab

### Cross-tool

- `shared/project.js`
- Model project export/import and local project list
- Control project picker
- IMU calibration project save
- IMU → Model handoff
- Model → Control
- Model → Simulink lesson links

## Known limits

- Subspace is **Ho-Kalman**, not strict N4SID; it needs rich input such as PRBS.
- MIMO state-space is a **MIMO-ARX realization**, not MIMO subspace.
- Closed-loop frequency needs controller metadata and uniform sampling.
- PDF direct download is image-only; selectable text requires browser print.
- Real-time serial acquisition is not part of the web UI; use host tooling and import CSV.
- Calibration is teaching-grade, not a certified metrology workflow.

## Verification

`npm test`, `npm run smoke`, `npm run e2e`, `npm run perf`, `npm run budget`, `npm run visual`, `npm run visual:dark`, `npm run visual:mobile`, `npm run live`.
