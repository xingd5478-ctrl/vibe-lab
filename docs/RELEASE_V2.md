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

- BADD 40-byte STM32 telemetry
  - 460800 baud
  - CRC16
  - ax/ay/az, gx/gy/gz
- Web Serial acceptance: byte count, frame count, fs, jitter, non-monotonic, duplicate, CRC errors, sequence gaps
- Acceptance JSON download
- Binary/CSV protocol switch
- Calibration projects (`vibe-lab-project`)
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
- Web Serial acceptance depends on Chrome/Edge and a user gesture.
- Calibration is teaching-grade, not a certified metrology workflow.

## Verification

`npm test`, `npm run smoke`, `npm run e2e`, `npm run perf`, `npm run budget`, `npm run visual`, `npm run visual:dark`, `npm run visual:mobile`, `npm run live`.
