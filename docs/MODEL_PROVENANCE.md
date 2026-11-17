# Simulink model provenance

Generated from `data/matlab-probes.json`. Do not hand-edit the table; run `npm run provenance`.

## Source and license

The 43 `.slx` models are vendored from
[xingd5478-ctrl/simulink-control-tutorial](https://github.com/xingd5478-ctrl/simulink-control-tutorial),
which declares the MIT license. The vendored files remain subject to the upstream
license and copyright; the full notice is in [NOTICE.md](../NOTICE.md).

## Scope

- MATLAB version: 25.1.0.2943329 (R2025a)
- Models: 43 / probes ok: 43
- Toolboxes: 110
- Generated: 2026-11-15 10:03:00
- Probe script: `tools/probe_all.m`

`metric_source: probe` means the metric came from a fresh MATLAB probe of the model.
`metric_source: offline` means the value is from the lesson/offline calculation, not a
fresh probe. The three offline rows are t12, t16 and t31.

## Rows

| Lesson | Model | SHA-256 (12) | Solver | Metric source | Note |
|---|---|---|---|---|---|
| t01 | tutorial01_signals.slx | `c93e44c3e3b2` | VariableStepAuto | probe | 信号、增益、示波器；结构课 |
| t02 | tutorial02_math.slx | `e27020d6c90c` | VariableStepAuto | probe | Sum/Product/Mux/Demux；结构课 |
| t03 | tutorial03_first_order.slx | `daf21f6cf5ee` | VariableStepAuto | probe | 与网页 demo 一致 |
| t04 | tutorial04_second_order.slx | `ac217447b243` | VariableStepAuto | probe | 与网页 demo 一致（ζ=0.2） |
| t05 | tutorial05_pid.slx | `a4868d1326db` | VariableStepAuto | probe | 模型参考/限幅与 demo 不同 |
| t06 | tutorial06_sources_sinks.slx | `b22e46d63dd8` | VariableStepAuto | probe | Workspace 导入导出；探针需初始化 u_input |
| t07 | tutorial07_subsystem.slx | `60d33aaa5de8` | VariableStepAuto | probe | 子系统层级；结构课 |
| t08 | tutorial08_masking.slx | `cd706553e394` | VariableStepAuto | probe | Mask 参数化；三路输出 |
| t09 | tutorial09_state_space.slx | `2b2f87969c68` | VariableStepAuto | probe | TF/SS/MA 三种实现对比 |
| t10 | tutorial10_state_feedback.slx | `5cbdd65b4359` | VariableStepAuto | probe | 原模型无参考前馈，稳态约 1/16 |
| t11 | tutorial11_observer.slx | `0fc9ca2bc089` | VariableStepAuto | probe | 估计误差收敛；与 demo 一致 |
| t12 | tutorial12_kalman.slx | `3b116c023604` | VariableStepAuto | **offline** | Kalman 明显优于 Luenberger/测量 |
| t13 | tutorial13_dc_motor.slx | `b448c3850008` | VariableStepAuto | probe | 速度 PI 有超调，稳态有差 |
| t14 | tutorial14_foc.slx | `e892b089bfcf` | VariableStepAuto | probe | FOC 与 DC 对比；末值差异大 |
| t15 | tutorial15_codegen.slx | `1ba16fac5da7` | VariableStepAuto | probe | 代码生成模型；固定步长 1 ms |
| t16 | tutorial16_freq.slx | `87defe848fa9` | VariableStepAuto | **offline** | Plant 4/(s²+0.5s+4)；PM 20.4° |
| t17 | tutorial17_leadlag.slx | `59e6d4f6348b` | VariableStepAuto | probe | Lead/Lag 校正；输入/输出稳态 |
| t18 | tutorial18_sysid.slx | `dd7843504929` | VariableStepAuto | probe | 阶跃辨识；输出饱和/限幅需注意 |
| t19 | tutorial19_robust.slx | `81eb9d7f4075` | VariableStepAuto | probe | H∞ 鲁棒控制；输出稳态 0.5 |
| t20 | tutorial20_mpc.slx | `b61b40e39770` | VariableStepAuto | probe | 原 .slx 实为 PID，不是 MPC；10 s 仍在上升 |
| t21 | tutorial21_smc.slx | `664b50464951` | VariableStepAuto | probe | 原 .slx 是符号继电器：u 仅 0→3，无抖振 |
| t22 | tutorial22_root_locus.slx | `4e2d552bec2d` | VariableStepAuto | probe | 对应当前 K 的稳态偏差 |
| t23 | tutorial23_mrac.slx | `4cf10d192e1c` | VariableStepAuto | probe | MRAC 参考/对象跟踪；控制量 3 |
| t24 | tutorial24_fuzzy.slx | `b18aa1a00928` | VariableStepAuto | probe | FIS 按讲义重建（Sugeno，25 条规则）；模糊输出 0.983<br><small>FIS rebuilt from lesson (Sugeno, 25 rules)</small> |
| t25 | tutorial25_simscape.slx | `5901a9db1ed5` | VariableStepAuto | probe | Simscape 物理模型；位移有超调 |
| t26 | tutorial26_kinematics.slx | `7cb4ff610c6d` | VariableStepAuto | probe | DH 正运动学；探针记录末端 x/y/z<br><small>Probe records end-effector x/y/z</small> |
| t27 | tutorial27_msd_models.slx | `9c610c685d4b` | VariableStepAuto | probe | TF/SS 数值积分对比；两者重合 |
| t28 | tutorial28_dsp.slx | `da64cd953588` | VariableStepAuto | probe | DSP 采样/FFT；5.6k 点 |
| t29 | tutorial29_control_compare.slx | `e08ed366c871` | VariableStepAuto | probe | PID vs LQR；PID 超调大 |
| t30 | tutorial30_suspension.slx | `02ba20cb39cb` | VariableStepAuto | probe | 1/4 车主动悬挂；位移峰值 10 |
| t31 | tutorial31_ekf.slx | `22f159bd7dc5` | VariableStepAuto | **offline** | 模型只输出真值/含噪测量；EKF 按讲义离线实现 |
| t32 | tutorial32_pendulum.slx | `d85917b57db4` | VariableStepAuto | probe | 模型已加 PD 状态反馈（K1=20, K2=8），角度 0.5→0.014 rad<br><small>PD feedback added (K1=20, K2=8)</small> |
| t33 | tutorial33_ukf.slx | `62f240975eba` | VariableStepAuto | probe | UKF 数据采集；模型无 UKF 模块 |
| t34 | tutorial34_ekfvsukf.slx | `201535bbfce5` | ode45 | probe | EKF vs UKF 数据；模型无滤波器模块 |
| t35 | tutorial35_imu.slx | `70ff7274c7b5` | VariableStepAuto | probe | 已修复时间通道：t_mdl 由 Clock 记录；互补滤波输出正常<br><small>Time channel rewired to Clock</small> |
| t36 | tutorial36_stateflow.slx | `7fadb2106a55` | VariableStepAuto | probe | Stateflow 状态机；模式 0/1/2 |
| t37 | tutorial37_triggered.slx | `af10b39e2b9e` | VariableStepAuto | probe | 触发/使能子系统；保持/复位 |
| t38 | tutorial38_bus.slx | `66f1a2fba9c4` | VariableStepAuto | probe | Bus 打包/拆解；三路信号 |
| t39 | tutorial39_top.slx | `878938967bc6` | VariableStepAuto | probe | 模型引用；refs/ 下附带两个子模型 |
| t40 | tutorial40_variant.slx | `9da1cf13c755` | VariableStepAuto | probe | 变体子系统；ctrl_type=1 选 PID |
| t41 | tutorial41_callbacks.slx | `74e9aa534b7e` | VariableStepAuto | probe | PreLoad/Init/StopFcn；InitFcn 需 Kp/Ki |
| t42 | tutorial42_sfunction.slx | `55cd700db0e3` | VariableStepAuto | probe | Level-2 MATLAB S-Function；deadzone_sfcn |
| t43 | tutorial43_advisor.slx | `2ebd9365a666` | VariableStepAuto | probe | Model Advisor/代数环；仿真通过 |

## Known modifications

- **t32** — added PD state feedback (`K_theta=20`, `K_omega=8`); without it the pendulum is unstable.
- **t35** — the `t_ms` To Workspace block now records a Clock; the original was wired to the fusion sum.
- **t24** — FIS rebuilt from the lesson because the original had no usable FIS.
- **t26** — probe records the end-effector x/y/z.

The exact patch script is `tools/patch_models.m`; rerun it only if a new upstream
model is vendored, then rerun `npm run matlab:data` and `npm run provenance`.

## Why t12/t16/t31 are offline

- **t12**: the model is a Kalman comparison; the reported RMSE is from the lesson's offline comparison.
- **t16**: the reported gain/phase margin is from the lesson's frequency analysis.
- **t31**: the model only outputs truth/noisy measurement; the EKF metric follows the lesson's offline implementation.

They are not presented as fresh probes, and the table marks them as `offline`.
