# NOTICE

## Code and design

The site source, design and original writing are licensed under the MIT License in `LICENSE`.

## Simulink tutorial models

The 43 `.slx` files under `simulink/models/` are vendored from:

- https://github.com/xingd5478-ctrl/simulink-control-tutorial

That tutorial repository declares the MIT license. The vendored files remain subject to the original repository's license and copyright. If the upstream license changes, the upstream terms control.

Several models were modified for this site so their recorded outputs are meaningful:

| Model | Change |
|---|---|
| `tutorial32_pendulum.slx` | Added PD state feedback (`K_theta=20`, `K_omega=8`) so the inverted pendulum stays bounded. |
| `tutorial35_imu.slx` | Rewired the `t_ms` To Workspace block to a Clock; the original was connected to the fusion sum. |
| `tutorial24_fuzzy.slx` | Rebuilt the FIS from the lesson (Sugeno, 25 rules) because the original file had no usable FIS. |
| `tutorial26_kinematics.slx` | Probe records the end-effector x/y/z; the model itself is the tutorial source. |

The exact model SHA-256, solver, stop time and output source are in `data/matlab-probes.json` and `docs/MODEL_PROVENANCE.md`.

`t12`, `t16` and `t31` use `metric_source: "offline"`: their metrics come from the lesson/offline calculation, not a fresh probe of the `.slx`. This is stated in the MATLAB table and the provenance report.

## Experimental data

The MEMS/IMU experimental dataset referenced by the project is **not** included in this repository and is not covered by the MIT license. Do not redistribute it without the author's permission.

## Third-party services

- GoatCounter: privacy-friendly page/event counts.
- Tally: feedback form.
- GitHub Issues: public feedback dashboard.
- jsDelivr / GitHub raw: optional course-source reader.

These services have their own terms and privacy policies.

## No warranty

The models, calculations and teaching notes are for education and demonstration. They are not a substitute for a real calibration, certification or safety analysis.
