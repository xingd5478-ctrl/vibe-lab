/* Lightweight English UI layer (beta) for the Chinese tool pages.
   Activated by ?lang=en or localStorage("vibe-lang")==="en".
   It translates visible text/attributes in place and leaves lesson prose in Chinese. */
(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  let lang = params.get("lang");
  try {
    if (lang === "en" || lang === "zh") localStorage.setItem("vibe-lang", lang);
    else lang = localStorage.getItem("vibe-lang");
  } catch (e) {
    /* private mode */
  }
  if (lang !== "en") {
    document.documentElement.lang = "zh-CN";
    addSwitch("en");
    return;
  }
  if (/\/about\/(index\.html)?$/.test(location.pathname)) {
    location.replace("en.html");
    return;
  }
  document.documentElement.lang = "en";
  document.documentElement.classList.add("lang-en");

  const TITLES = {
    信号基础: "Signals",
    数学运算: "Math blocks",
    一阶系统: "First order",
    二阶系统: "Second order",
    "PID 控制": "PID control",
    信号源与输出: "Sources & sinks",
    子系统: "Subsystems",
    "Mask 封装": "Masks",
    状态空间模型: "State space",
    "状态反馈 / LQR": "State feedback / LQR",
    状态观测器: "Observer",
    "Kalman 滤波": "Kalman filter",
    系统辨识: "System ID",
    "H∞ 鲁棒控制": "H-infinity",
    "模型预测控制 MPC": "MPC",
    "滑模控制 SMC": "Sliding mode",
    根轨迹法: "Root locus",
    "MRAC 自适应": "MRAC",
    模糊逻辑控制: "Fuzzy logic",
    "DC 电机控制": "DC motor",
    "PMSM + FOC": "PMSM + FOC",
    "Simscape 物理建模": "Simscape",
    代码生成: "Code generation",
    机器人运动学: "Robot kinematics",
    "MSD 系统建模": "MSD modeling",
    "DSP 基础": "DSP basics",
    "MSD 控制对比": "MSD control compare",
    主动悬挂: "Active suspension",
    "EKF 基础": "EKF basics",
    "EKF 倒立摆": "EKF pendulum",
    UKF: "UKF",
    "EKF vs UKF": "EKF vs UKF",
    "IMU 融合": "IMU fusion",
    "Stateflow 状态机": "Stateflow",
    "触发/使能子系统": "Triggered / enabled",
    "Bus 信号": "Bus signals",
    模型引用: "Model reference",
    变体子系统: "Variant subsystem",
    模型回调: "Model callbacks",
    "S-Function": "S-Function",
    "Model Advisor": "Model Advisor",
  };

  const DEMO_TITLES = {
    信号与增益: "Signals & gain",
    "PID 控制": "PID control",
    "Kalman 滤波": "Kalman filter",
    "频域 Bode": "Frequency / Bode",
    "MPC 模型预测控制": "MPC",
    根轨迹: "Root locus",
    模糊控制: "Fuzzy control",
    "质量-弹簧-阻尼": "Mass-spring-damper",
    机器人运动学: "Robot kinematics",
    采样与混叠: "Sampling & aliasing",
    "IMU 融合": "IMU fusion",
    "Bus 信号": "Bus signals",
    "DC 电机": "DC motor",
    触发子系统: "Triggered subsystem",
    "超前-滞后校正": "Lead-lag",
    系统辨识: "System ID",
    "MRAC 自适应": "MRAC",
    "MSD：PID vs LQR": "MSD: PID vs LQR",
    主动悬挂: "Active suspension",
    EKF: "EKF",
    "倒立摆 EKF": "Pendulum EKF",
    "PMSM / FOC": "PMSM / FOC",
    一阶系统: "First order",
    二阶系统: "Second order",
    "状态反馈 / 极点配置": "State feedback / pole placement",
    "Luenberger 观测器": "Luenberger observer",
    "滑模控制 SMC": "Sliding mode SMC",
    "Stateflow 状态机": "Stateflow",
    变体切换: "Variant switch",
  };

  const EN = {
    跳到内容: "Skip to content",
    全站导航: "Site navigation",
    首页: "Home",
    方法: "Method",
    方法说明: "Method",
    方法说明与局限: "Methods & limitations",
    "IMU 数据实验室": "IMU data lab",
    "Model Lab · 从数据到模型 · vibe-lab": "Model Lab · from data to model · vibe-lab",
    "从一段数据，到能用的模型。": "From a data trace to a model you can use.",
    "上传阶跃实验数据，先看它能不能信，再估出一阶/二阶传递函数。全部在浏览器内计算，不上传数据。":
      "Upload a step test, check whether it is trustworthy, then estimate a first/second-order transfer function. Everything runs in your browser; no upload.",
    用一个虚拟对象试试: "Try a virtual plant",
    "上传 CSV": "Upload CSV",
    个虚拟对象: "virtual plants",
    种模型: "model structures",
    实验台: "Experiment bench",
    "先体检，再拟合。坏数据不会给你一个好模型。":
      "Check the data first, then fit. Bad data will not give you a good model.",
    数据: "Data",
    虚拟对象: "Virtual plant",
    阶跃幅值: "Step amplitude",
    "噪声 σ": "Noise σ",
    "采样率 Hz": "Sample rate Hz",
    "时长 s": "Duration s",
    生成阶跃实验: "Generate step experiment",
    或者: "or",
    "t, u, y 三列 · 本地读取": "t, u, y columns · read locally",
    模型结构: "Model structure",
    "一阶 + 延迟 FOPDT": "First order + delay FOPDT",
    "二阶 SOPDT": "Second order SOPDT",
    辨识模型: "Identify model",
    "先体检数据；有硬性错误时不会拟合。": "Check the data first; hard errors block identification.",
    数据体检: "Data health",
    等待数据: "Waiting for data",
    实测输出: "Measured output",
    实测: "Measured",
    "残差（实测 − 模型）": "Residual (measured − model)",
    这页在做什么: "What this page does",
    "不是“拟合一条线”，是“判断这个模型能不能用”。": "Not just “fit a line” — deciding whether the model is usable.",
    先体检: "Check first",
    再拟合: "Then fit",
    最后用: "Then use",
    "输入不动、时间倒序、饱和、噪声太大——这些问题会让模型看起来很好，但其实不可信。":
      "A flat input, reversed time, saturation or too much noise can make a model look good while making it untrustworthy.",
    "FOPDT 估 K、τ、L；SOPDT 估 K、ζ、ωn。拟合失败会说明原因，不硬给结果。":
      "FOPDT estimates K, τ, L; SOPDT estimates K, ζ, ωn. Failures explain themselves instead of returning a fake result.",
    "SOPDT 可以直接送进 Control Play；所有模型都能导出 MATLAB .m。":
      "SOPDT can go straight to Control Play; every model can export MATLAB .m.",
    这组数据还不能用来辨识: "This data is not ready for identification",
    "数据体检有硬性错误，先修复再拟合。": "Data health has hard errors; fix them before fitting.",
    "数据体检通过；可以拟合，但仍要看残差和物理合理性。":
      "Data health passed; you can fit, but still check residuals and physical plausibility.",
    "正在拟合…": "Fitting…",
    "拟合完成。检查 FIT、残差和参数是否物理合理。": "Fit complete. Check FIT, residuals and physical plausibility.",
    "拟合失败；先检查数据是否有真实阶跃和足够长的响应。":
      "Fit failed; check for a real step and a long enough response.",
    "没有明显警告；仍要用独立数据验证，不能只看 FIT。":
      "No obvious warnings; still validate on independent data, not just FIT.",
    虚拟对象真实值: "Virtual plant truth",
    "已复制 .m 代码。": "MATLAB .m copied.",
    "复制失败，请下载 .m。": "Copy failed; download the .m file.",
    "这组虚拟对象本身是二阶；用 FOPDT 拟合会丢失振荡，试试 SOPDT。":
      "This virtual plant is second order; FOPDT loses the oscillation — try SOPDT.",
    "ζ 接近搜索上界：这组数据可能更像一阶，二阶的第二个时间常数不可辨识。":
      "ζ is near the search bound: the data may be closer to first order, so the second time constant is not identifiable.",
    "FIT 偏低：模型可能不够好，或数据里还有未建模的动态/扰动。":
      "FIT is low: the model may be insufficient, or unmodeled dynamics/disturbances remain.",
    "vibe-lab · Model Lab V0.1 · 本地计算，不上传数据": "vibe-lab · Model Lab V0.1 · local computation, no upload",
    上传: "uploads",
    "阶跃响应 → 数据体检 → FOPDT / SOPDT": "Step response → data health → FOPDT / SOPDT",
    "本地计算，不上传数据": "local computation, no upload",
    源码: "source",
    模型: "Model",
    "复制 .m": "Copy .m",
    "下载 .m": "Download .m",
    "送到 Control Play →": "Send to Control Play →",
    "所有模型都能导出 MATLAB .m。": "Every model can export MATLAB .m.",
    阶跃响应与模型拟合曲线: "Step response and fitted model",
    残差曲线: "Residual curve",
    "Model Lab 能力": "Model Lab capabilities",
    占空比: "duty",
    "浏览器内运行，不上传数据。": "runs in your browser; no upload.",
    "数据体检 → 阶跃辨识 → 传递函数 → 控制器。浏览器内运行，不上传数据。":
      "Data health → step identification → transfer function → controller. Runs in your browser; no upload.",
    "把阶跃实验数据变成一阶/二阶传递函数：数据体检、FOPDT/SOPDT 辨识、验证，并送到 Control Play。":
      "Turn a step test into a first/second-order transfer function: data health, FOPDT/SOPDT identification, validation, and a link to Control Play.",
    "Model Lab · 从数据到模型": "Model Lab · from data to model",
    "训练 / 验证": "Train / validation",
    "ARX 离散": "ARX discrete",
    "全部数据训练，没有独立验证。": "All data for training; no independent validation.",
    "FIT 训练": "FIT train",
    "FIT 验证": "FIT validation",
    极点: "Pole",
    稳定: "Stable",
    是: "yes",
    否: "no",
    "前 70% 训练，后 30% 验证。": "First 70% train, last 30% validation.",
    "前 80% 训练，后 20% 验证。": "First 80% train, last 20% validation.",
    全部训练: "All data",
    "FOPDT 估 K、τ、L；SOPDT 估 K、ζ、ωn；ARX 估离散系数。拟合失败会说明原因，不硬给结果。":
      "FOPDT estimates K, τ, L; SOPDT estimates K, ζ, ωn; ARX estimates discrete coefficients. Failures explain themselves instead of returning a fake result.",
    输入类型: "Input type",
    阶跃: "Step",
    "正弦扫频 Chirp": "Sine sweep (chirp)",
    "ETFE 频域": "ETFE frequency",
    "手册 · 前五章": "Manual · first five chapters",
    "先读这五章，再看结果。": "Read these five chapters before interpreting the result.",
    "FOPDT 估 K、τ、L；SOPDT 估 K、ζ、ωn；ARX 估离散系数；ETFE 给频率响应。拟合失败会说明原因，不硬给结果。":
      "FOPDT estimates K, τ, L; SOPDT estimates K, ζ, ωn; ARX estimates discrete coefficients; ETFE gives a frequency response. Failures explain themselves instead of returning a fake result.",
    "手册 · 十章": "Manual · ten chapters",
    "十章：从数据、模型，到验证和控制器。": "Ten chapters: from data and models to validation and controllers.",
    估计不确定度: "Estimate uncertainty",
    "正在做 bootstrap…": "Running bootstrap…",
    "不确定度是重采样估计，不是严格保证。": "Intervals are resampling estimates, not a guarantee.",
    "不确定度估计失败：": "Uncertainty failed: ",
    对象阶次: "Plant order",
    二阶系统: "Second order",
    一阶系统: "First order",
    "稳态增益 K": "Steady-state gain K",
    "时间常数 τ": "Time constant τ",
    "Control Play · 一阶系统": "Control Play · first-order systems",
    "G(s) = K / (τs + 1) · 拖动滑杆，实时看一阶 Bode 与阶跃响应。":
      "G(s) = K / (τs + 1) · drag the sliders to see the first-order Bode and step response.",
    "G(s) = ωn² / (s² + 2ζωn·s + ωn²) · 拖动滑杆，实时看 Bode 与阶跃响应。":
      "G(s) = ωn² / (s² + 2ζωn·s + ωn²) · drag the sliders to see Bode and the step response.",
    这组数据来自闭环实验: "This data comes from a closed-loop experiment",
    "V0.6 边界：SISO / 开环 / 线性。MIMO、闭环辨识、非线性模型未实现；闭环数据只能做参考。":
      "V0.6 scope: SISO / open-loop / linear. MIMO, closed-loop identification and nonlinear models are not implemented; closed-loop data is for reference only.",
    "闭环数据：普通最小二乘可能有偏，结果只作参考。":
      "Closed-loop data: ordinary least squares can be biased; treat the result as a reference.",
    "FOPDT 估 K、τ、L；SOPDT 估 K、ζ、ωn；ARX/MIMO-ARX 估离散系数；ETFE 给频率响应。拟合失败会说明原因，不硬给结果。":
      "FOPDT estimates K, τ, L; SOPDT estimates K, ζ, ωn; ARX/MIMO-ARX estimates discrete coefficients; ETFE gives a frequency response. Failures explain themselves instead of returning a fake result.",
    "V0.6 边界：CSV 只支持 SISO；MIMO 目前只有 2×2 虚拟对象；闭环数据只警告，非线性未实现。":
      "V0.6 scope: CSV is SISO only; MIMO is limited to the 2×2 virtual plant; closed-loop data gets a warning; nonlinear models are not implemented.",
    "CSV 列映射": "CSV column mapping",
    "多输入/多输出请选择列；单输入单输出也可以在这里改。":
      "Pick columns for multi-input/multi-output, or remap a SISO file here.",
    时间列: "Time column",
    输入列: "Inputs",
    输出列: "Outputs",
    应用列映射: "Apply mapping",
    "选择时间列、输入列和输出列，然后应用。": "Pick time, inputs and outputs, then apply.",
    "V0.7 边界：MIMO 支持 2×2 虚拟对象和 CSV 多列映射；闭环数据只警告，非线性未实现。":
      "V0.7 scope: MIMO supports the 2×2 virtual plant and CSV multi-column mapping; closed-loop data gets a warning; nonlinear models are not implemented.",
    "闭环 PRBS（PID）": "Closed-loop PRBS (PID)",
    "参考/设定值 r（可选）": "Reference/setpoint r (optional)",
    无: "none",
    "闭环 2SLS-ARX": "Closed-loop 2SLS-ARX",
    "直接 LS": "Direct LS",
    "闭环控制器（已知，用于 2SLS 参考）": "Closed-loop controller (known, for 2SLS reference)",
    "2SLS 用设定值 r 作为工具变量；r 必须独立激励。":
      "2SLS uses setpoint r as the instrument; r must be independently excited.",
    "V0.8 边界：支持闭环 PRBS + 2SLS；MIMO 支持 2×2/CSV 多列；非线性未实现。":
      "V0.8 scope: closed-loop PRBS + 2SLS supported; MIMO supports 2×2/CSV mapping; nonlinear models are not implemented.",
    "Hammerstein 非线性": "Hammerstein nonlinear",
    "V0.9 边界：闭环 2SLS、MIMO CSV、Hammerstein 非线性原型；完整非线性/闭环频域仍未实现。":
      "V0.9 scope: closed-loop 2SLS, CSV MIMO and a Hammerstein nonlinear prototype; full nonlinear/closed-loop frequency methods are not implemented.",
    "FIR 脉冲响应": "FIR impulse response",
    "OE 输出误差": "OE output error",
    "Wiener 非线性": "Wiener nonlinear",
    "噪声阶次 nc": "Noise order nc",
    "V1.0 边界：FOPDT/SOPDT/FIR/ARX/ARMAX/OE/ETFE/Wiener/MIMO/2SLS；完整非线性模型族与闭环频域仍未实现。":
      "V1.0 scope: FOPDT/SOPDT/FIR/ARX/ARMAX/OE/ETFE/Wiener/MIMO/2SLS; full nonlinear families and closed-loop frequency methods are not implemented.",
    "姿态融合 · 互补滤波演示": "Attitude fusion · complementary filter demo",
    "陀螺积分 vs 互补滤波": "Gyro integration vs complementary filter",
    "加速度计权重 α": "Accelerometer weight α",
    "演示用合成数据：陀螺有零偏和积分漂移，加速度计有噪声但是绝对参考。α 越大越信加速度计，越小越信陀螺。":
      "Synthetic demo: the gyro has bias and integration drift, the accelerometer is noisy but absolute. Larger α trusts the accelerometer more.",
    "估计零偏（前 5 s）": "Estimate bias (first 5 s)",
    "假设前 5 s 静止；输出 gx/gy/gz 偏置。": "Assumes the first 5 s are static; prints gx/gy/gz bias.",
    "积分抗饱和 anti-windup": "Integral anti-windup",
    "微分滤波 Tf": "Derivative filter Tf",
    执行器限幅: "Actuator limit",
    "加载真实融合 CSV": "Load real fusion CSV",
    "当前：合成演示数据": "Current: synthetic demo data",
    "当前：真实 CSV · gx + ay/az 倾角": "Current: real CSV · gx + ay/az tilt",
    应用零偏: "Apply bias",
    "AX（可选）": "AX (optional)",
    "AY（可选）": "AY (optional)",
    "AZ（可选）": "AZ (optional)",
    取消: "Cancel",
    "已取消拟合。": "Fit cancelled.",
    "导出标定 JSON": "Export calibration JSON",
    "标定 JSON 已导出": "Calibration JSON exported",
    六面加速度计标定: "Six-face accelerometer calibration",
    "分别加载 +X/−X/+Y/−Y/+Z/−Z 六个方向的静态数据，点对应“采集”。":
      "Load static data for +X/−X/+Y/−Y/+Z/−Z, then capture each face.",
    计算标定: "Compute calibration",
    清空: "Clear",
    应用标定: "Apply calibration",
    撤销标定: "Undo calibration",
    "导出六面 JSON": "Export six-face JSON",
    "六面 JSON 已导出": "Six-face JSON exported",
    "批量上传六面 CSV": "Batch upload six-face CSV",
    "标定报告 PDF": "Calibration report PDF",
    陀螺刻度标定: "Gyro scale calibration",
    "把传感器放在已知角速度的转台/夹具上，记录该轴 2 s 均值。":
      "Place the sensor on a known-rate turntable/fixture and record this axis for 2 s.",
    轴: "Axis",
    已知角速度: "Known rate",
    采集并计算: "Capture + compute",
    应用刻度: "Apply scale",
    撤销刻度: "Undo scale",
    "未标定。": "Not calibrated.",
    打印标定报告: "Print calibration report",
    "下载 PDF": "Download PDF",
    温度漂移标定: "Temperature drift calibration",
    "在多个温度点分别采集静态零偏，再拟合线性温度模型。":
      "Capture static bias at several temperatures, then fit a linear temperature model.",
    "当前温度 °C": "Current temperature °C",
    采集当前温度点: "Capture current temperature",
    拟合: "Fit",
    应用温补: "Apply temp compensation",
    清空: "Clear",
    "至少需要两个温度点。": "At least two temperature points are required.",
    "批量温度点 CSV": "Batch temperature-run CSV",
    "TEMP（可选）": "TEMP (optional)",
    自动切温度平台: "Auto-segment temperature plateaus",
    三轴同时: "All three axes",
    "GX 已知": "GX known",
    "GY 已知": "GY known",
    "GZ 已知": "GZ known",
    联合应用: "Apply combined",
    撤销联合: "Undo combined",
    "可选中 PDF / 打印": "Selectable PDF / print",
    "状态空间 SS": "State-space SS",
    "延迟 nk": "Delay nk",
    导出项目: "Export project",
    导入项目: "Import project",
    "导入模型 JSON": "Import model JSON",
    相位裕度: "Phase margin",
    增益裕度: "Gain margin",
    "IMC 初值（一阶）": "IMC initial values (first order)",
    "送到 Model Lab": "Send to Model Lab",
    "连接 STM32（Web Serial）": "Connect STM32 (Web Serial)",
    "串口 CSV：gx,gy,gz 或 t,gx,gy,gz": "Serial CSV: gx,gy,gz or t,gx,gy,gz",
    "ZN 初值（二阶）": "ZN initial values (second order)",
    "对应 Simulink 课 →": "Related Simulink lesson →",
    串口协议: "Serial protocol",
    本地项目: "Local projects",
    打开: "Open",
    "纯延迟 L": "Dead time L",
    "Smith 预估": "Smith predictor",
    "Control Play · 二阶系统": "Control Play · second-order systems",
    课程阅读进度: "Course reading progress",
    继续上次: "Continue where you left off",
    学习进度: "Progress",
    "学完这 43 课，你应该能：搭一阶/二阶/闭环、读 Bode 与阶跃、解释 PID / 状态反馈 / 观测器 / Kalman 的取舍，并知道何时该回到真实标定。":
      "After 43 lessons you should be able to build first/second-order and closed-loop models, read Bode and step responses, explain the trade-offs in PID, state feedback, observers and Kalman filters, and know when a real calibration is still required.",
    复制当前参数链接: "Copy parameter link",
    已复制当前参数链接: "Parameter link copied",
    "复制失败，可直接复制地址栏 URL": "Copy failed; copy the address bar URL",
    "上传 MPU6050 CSV → CRC 清洗 → Allan 方差 → 拖动 R/Q 看滤波。全部在浏览器内计算，无后端。":
      "Upload MPU6050 CSV → CRC cleaning → Allan deviation → drag R/Q to filter. Everything runs in your browser; no backend.",
    演示数据: "Demo data",
    "43 课 / 8 阶段的 MATLAB + Simulink 教程。.slx 是 MATLAB 二进制模型，浏览器无法直接运行；":
      "A 43-lesson / 8-stage MATLAB + Simulink tutorial. `.slx` is a binary MATLAB model the browser cannot run;",
    "43 课 / 8 阶段的 MATLAB + Simulink 教程。.slx 是 MATLAB 二进制模型，浏览器无法直接运行； 本页用":
      "A 43-lesson / 8-stage MATLAB + Simulink tutorial. `.slx` is a binary MATLAB model the browser cannot run; this page uses",
    本页用: "this page uses",
    "做可交互复现，并链接到每课的": " to reproduce the same math interactively, with links to each lesson's",
    与: "and",
    同一套控制数学: "the same control math",
    "输出 y=K·u": "Output y=K·u",
    "y(t)=Ku(t)。先看输入，再看放大后的输出；打开噪声模拟真实传感器。":
      "y(t)=Ku(t). Compare the input and the scaled output; enable noise to model a real sensor.",
    "y(t)=Ku(t). 先看输入，再看放大后的输出；打开噪声模拟真实传感器。":
      "y(t)=Ku(t). Compare the input and the scaled output; enable noise to model a real sensor.",
    "GitHub 仓库 →": "GitHub repo →",
    "Phase 1 · Simulink 基础与动力学": "Phase 1 · Simulink & dynamics",
    "Phase 2 · 经典控制设计": "Phase 2 · Classical control",
    "Phase 3 · 现代控制": "Phase 3 · Modern control",
    "Phase 4 · 高级控制": "Phase 4 · Advanced control",
    "Phase 5 · 机电系统与部署": "Phase 5 · Mechatronics & deployment",
    "Phase 6 · 综合案例": "Phase 6 · Case studies",
    "Phase 7 · 非线性滤波": "Phase 7 · Nonlinear filtering",
    "Phase 8 · Simulink 进阶": "Phase 8 · Advanced Simulink",
    "增益 K": "Gain K",
    "频率 (Hz)": "Frequency (Hz)",
    叠加噪声: "Add noise",
    "y(t)=Ku(t). 先看输入，再看放大后的输出；打开噪声模拟真实传感器。":
      "y(t)=Ku(t). Compare the input and the scaled output; enable noise to model a real sensor.",
    "Simulink 控制教程 · 交互复现": "Simulink control tutorial · interactive",
    "IMU 数据实验室 · vibe-lab": "IMU data lab · vibe-lab",
    "Control Play · 二阶系统 · vibe-lab": "Control Play · second-order systems · vibe-lab",
    "Simulink 控制教程 · 交互复现 · vibe-lab": "Simulink control tutorial · interactive · vibe-lab",
    "方法说明 · vibe-lab": "Methods & limitations · vibe-lab",
    "43 课讲义 · Simulink 控制教程 · vibe-lab": "43 lessons · Simulink control tutorial · vibe-lab",
    数据文件: "Data file",
    "当前：": "Current: ",
    "示例数据（合成）": "Sample data (synthetic)",
    "也可以把 CSV 直接拖到这个面板。": "You can also drop a CSV onto this panel.",
    "列名未识别，请手动映射：": "Columns not recognized; map them manually:",
    应用映射: "Apply mapping",
    "加载 10 min 真实片段": "Load 10-min real excerpt",
    "下载片段 CSV": "Download excerpt CSV",
    "采样率 (Hz)": "Sample rate (Hz)",
    主通道: "Primary channel",
    "CRC / 物理坏帧清洗": "CRC / physical bad-frame cleaning",
    "从 Allan 拟合 R/Q": "Fit R/Q from Allan",
    "导出 CSV": "Export CSV",
    导出报告: "Export report",
    保存对比: "Save comparison",
    清除对比: "Clear comparison",
    复制链接: "Copy link",
    "导出 Allan CSV": "Export Allan CSV",
    重置为示例数据: "Reset to sample data",
    总帧数: "Frames",
    坏帧: "Bad frames",
    时长: "Duration",
    主通道均值: "Channel mean",
    时域: "Time domain",
    "Allan 方差": "Allan deviation",
    滤波对比: "Filter comparison",
    "IMU 实验手册 · 10 章": "IMU lab manual · 10 chapters",
    实验台: "Workbench",
    "10 章手册": "10-chapter manual",
    "检测到列名无法识别，请手动映射。": "Columns not recognized; map them manually.",
    "角速度 (°/s)": "Angular rate (°/s)",
    "时间 (s)": "Time (s)",
    "Allan 标准差 (°/s)": "Allan deviation (°/s)",
    "Allan 方差数据（抽样）": "Allan deviation data (sampled)",
    "角度 (°)": "Angle (°)",
    "幅值 (dB)": "Magnitude (dB)",
    "相位 (°)": "Phase (°)",
    幅值: "Mag.",
    相位: "Phase",
    频率: "Frequency",
    "自然频率 ωn": "Natural frequency ωn",
    "阻尼比 ζ": "Damping ratio ζ",
    "比例增益 Kp": "Proportional gain Kp",
    "积分增益 Ki": "Integral gain Ki",
    "微分增益 Kd": "Derivative gain Kd",
    "超调量（闭环）": "Overshoot (closed loop)",
    峰值时间: "Peak time",
    "调节时间（±2%）": "Settling time (±2%)",
    稳态误差: "Steady-state error",
    "Bode 图": "Bode plot",
    阶跃响应: "Step response",
    "更多控制实验 · 4 个": "More control labs · 4",
    扩展实验: "Extra labs",
    "14 章手册": "14-chapter manual",
    "Control Play 实验手册 · 10 章": "Control Play manual · 10 chapters",
    "课程阶段 · 8 个": "Course stages · 8",
    "阅读 43 课完整讲义 →": "Read all 43 lessons →",
    交互复现: "Interactive reproduction",
    "怎么在 MATLAB 里跑原版": "Run the originals in MATLAB",
    "ARW 拟合": "ARW fit",
    "RRW 拟合": "RRW fit",
    原始: "Raw",
    清洗后: "Clean",
    原始积分: "Raw",
    卡尔曼: "KF",
    真值: "Truth",
    测量: "Measurement",
    估计: "Estimate",
    参考: "Reference",
    "输入 u": "Input u",
    "输出 y": "Output y",
    "测量 z": "Measurement z",
    "估计 x̂": "Estimate x̂",
    测量误差: "Meas. err",
    滤波误差: "Filter err",
    加速度计: "Accel",
    互补输出: "Complementary",
    加速度计误差: "Accel err",
    互补误差: "Comp err",
    连续输入: "Continuous input",
    保持输出: "Held output",
    实测: "Measured",
    拟合: "Fit",
    参考模型: "Ref model",
    "对象 y": "Plant y",
    位置: "Position",
    速度: "Speed",
    力矩: "Torque",
    转速: "Speed",
    电流: "Current",
    误差: "Error",
    超调量: "Overshoot",
    末值误差: "Final error",
    贴限幅比例: "Saturation ratio",
    "测量 RMSE": "Meas. RMSE",
    "滤波 RMSE": "Filter RMSE",
    "EKF RMSE": "EKF RMSE",
    "抖振指标 mean|Δu|": "Chattering mean|Δu|",
    "t>1s 最大误差": "Max error after 1 s",
    数据图: "Chart",
    输入幅度: "Input amplitude",
    输出幅度: "Output amplitude",
    输入幅值: "Input amplitude",
    输出幅值: "Output amplitude",
    噪声: "Noise",
    无: "none",
    有: "yes",
    开环: "Open",
    闭环: "Closed loop",
    "闭环 PID": "PID",
    "连续 PID": "Cont. PID",
    "离散 PID": "Disc. PID",
    真实: "True",
    估计值: "Estimate",
    采样点连线: "S&H",
    真实正弦: "True sine",
    重建: "Reconstructed",
    上升时间: "Rise time",
    峰值: "Peak",
    终值: "Final value",
    稳态: "Steady state",
    "计算中…": "Computing…",
    "Allan 计算中…": "Computing Allan…",
    "拟合失败：数据太短或曲线异常": "Fit failed: data too short or curve abnormal",
    下载: "Download",
    "本课讲义 →": "Lesson notes →",
    教程仓库: "Tutorial repo",
    站内模型: "Site model",
    "交互复现与 Simulink 的差异：": "Differences from Simulink: ",
    "本页不运行 Simulink，只复现数学；原版模型请按下面三步运行（MATLAB R2020a+）。":
      "This page does not run Simulink; it reproduces the math. Run the originals in MATLAB (R2020a+) with the three steps below.",
    "这里只放交互实验；完整讲义、结果图和 .slx 下载在讲义页。":
      "Only interactive labs live here; full notes, figures and .slx downloads are on the reader page.",
    "状态反馈、Luenberger 观测器、根轨迹、离散化；每个都可独立调参。":
      "State feedback, Luenberger observer, root locus and discretization; each can be tuned independently.",
    "论文在审，仅作演示；完整数据待录用后按期刊政策公开，版权归作者/实验室。":
      "Under review; demo only. Full data will follow the journal policy after acceptance; copyright remains with the authors/lab.",
    "CSV 列名：": "CSV columns: ",
    "没有表头时按 t,gx,gy,gz,crc 解析。": "Without a header, rows are parsed as t,gx,gy,gz,crc.",
    数据与算法在浏览器内运行: "Data and algorithms run in your browser",
    "仅用于教学/演示，真实标定以论文流程为准。": "Teaching/demo only; use the paper's procedure for real calibration.",
    方法说明: "Method",
    返回方法说明: "Back to method",
    "本站不运行 Simulink": "This site does not run Simulink",
  };

  const PATTERNS = [
    [/^(\d[\d,]*) 帧 · (\d[\d,]*) 坏帧（尖峰已截断）$/, "$1 frames · $2 bad frames (spikes clipped)"],
    [/^(\d[\d,]*) 帧$/, "$1 frames"],
    [/^(\d+) 章手册$/, "$1-chapter manual"],
    [/^(\d+) 课$/, "$1 lessons"],
    [/^(\d+) 课 · (.+)$/, "$1 lessons · $2"],
    [/^(\d+) 个交互$/, "$1 interactive demos"],
    [/^(\d+) 个$/, "$1"],
    [
      /^(?:t|T)(\d+) · (.+)$/,
      (m, n, title) => `${m.startsWith("T") ? "T" : "t"}${n} · ${DEMO_TITLES[title] || TITLES[title] || title}`,
    ],
    [/^(.+)（95% (.+)）$/, (m, a, b) => `${a} (95% ${b})`],
  ];

  function translateString(value) {
    if (!value) return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    let out = EN[trimmed] || EN[trimmed.replace(/\s+/g, " ")];
    if (!out) {
      for (const [re, rep] of PATTERNS) {
        if (re.test(trimmed)) {
          out = typeof rep === "function" ? trimmed.replace(re, rep) : trimmed.replace(re, rep);
          break;
        }
      }
    }
    if (!out) {
      // Replace known inner phrases in long dynamic strings.
      out = trimmed
        .replace(/检测到列名无法识别，请手动映射。/g, "Columns not recognized; map them manually.")
        .replace(/坏帧/g, "bad frames")
        .replace(/帧/g, "frames")
        .replace(/章手册/g, "-chapter manual");
    }
    if (!out || out === trimmed) return value;
    return value.replace(trimmed, out);
  }

  const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);
  window.VibeI18n = { lang: "en", translate: translateString };
  function skipNode(node) {
    let p = node.nodeType === 1 ? node : node.parentElement;
    while (p) {
      if (SKIP.has(p.tagName) || p.hasAttribute("data-i18n-skip")) return true;
      p = p.parentElement;
    }
    return false;
  }

  function translateText(node) {
    if (skipNode(node)) return;
    const v = node.nodeValue;
    if (node.parentElement && node.parentElement.id === "sr-summary" && /[\u4e00-\u9fff]/.test(v)) {
      node.nodeValue = "Summary: chart values update with the selected channel and R/Q.";
      return;
    }
    const t = translateString(v);
    if (t !== v) node.nodeValue = t;
  }

  function translateAttrs(el) {
    if (skipNode(el)) return;
    ["placeholder", "title", "aria-label", "alt"].forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const v = el.getAttribute(attr);
      const t = translateString(v);
      if (t !== v) el.setAttribute(attr, t);
    });
  }

  function walk(root) {
    if (root.nodeType === 3) {
      translateText(root);
      return;
    }
    if (root.nodeType !== 1) return;
    translateAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (SKIP.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) translateText(n);
      else translateAttrs(n);
    }
  }

  let queued = false;
  const mo = new MutationObserver((muts) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const m of muts) {
        if (m.type === "characterData") translateText(m.target);
        else if (m.type === "attributes") translateAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
  });

  function addSwitch(target) {
    const nav = document.querySelector(".topnav");
    if (!nav) return;
    let a = nav.querySelector(".lang-switch");
    if (!a) {
      a = document.createElement("a");
      a.className = "lang-switch";
      nav.appendChild(a);
    }
    a.hreflang = target === "en" ? "en" : "zh-CN";
    a.lang = target === "en" ? "en" : "zh-CN";
    a.textContent = target === "en" ? "EN" : "Chinese";
    const url = new URL(location.href);
    url.searchParams.set("lang", target);
    a.href = target === "en" && /\/about\//.test(location.pathname) ? "en.html" : url.href;
    a.setAttribute("data-i18n-skip", "");
  }

  function addBanner() {
    const wrap = document.querySelector(".wrap");
    if (!wrap || document.querySelector(".lang-banner")) return;
    const d = document.createElement("div");
    d.className = "lang-banner";
    d.setAttribute("data-i18n-skip", "");
    d.style.cssText =
      "margin:10px 0 0;padding:7px 10px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-size:12px;border-radius:2px";
    d.innerHTML =
      'English UI: tools, charts, lab manuals, the four extended labs and the 43-lesson guide are translated. Switch to <a href="?lang=zh">Chinese</a> for the original source notes.';
    wrap.insertBefore(d, wrap.querySelector("header"));
  }

  let curated = false;
  function enGuideHref() {
    return location.protocol === "file:" ? "../landing/en/guide.html" : "../en/guide.html";
  }
  function setEnglishMeta(text) {
    const set = (sel, attr) => {
      const n = document.querySelector(sel);
      if (n) n.setAttribute(attr, text);
    };
    set('meta[name="description"]', "content");
    set('meta[property="og:description"]', "content");
    set('meta[name="twitter:description"]', "content");
    set('meta[property="og:title"]', "content");
  }

  function addNote(text, after) {
    const p = document.createElement("p");
    p.className = "hint en-scope-note";
    p.setAttribute("data-i18n-skip", "");
    p.textContent = text;
    const main = document.querySelector("main");
    if (after && after.parentNode) after.parentNode.insertBefore(p, after.nextSibling);
    else if (main) main.appendChild(p);
  }
  function repointCourseLinks() {
    const href = enGuideHref();
    document.querySelectorAll('a[href*="course.html"]').forEach((a) => {
      if (a.closest("[data-i18n-skip]")) return;
      a.href = href;
    });
  }
  function englishCuration() {
    if (curated) return;
    if (document.getElementById("lesson-body")) {
      location.replace(enGuideHref());
      return;
    }
    const isImu = !!(document.getElementById("chart-allan") && document.getElementById("chart-time"));
    const isCtrl = !!(document.getElementById("bode") && document.getElementById("step"));
    const isSim = !!(document.getElementById("tabs") && document.getElementById("phases"));
    if (!isImu && !isCtrl && !isSim) return;
    curated = true;
    const footer = document.querySelector("footer");
    if (footer) {
      footer.innerHTML =
        'vibe-lab · static site · <a href="../">Home</a> · <a href="../about/en.html">Method</a> · <a href="https://github.com/xingd5478-ctrl/vibe-lab" target="_blank" rel="noreferrer">Source</a>';
    }
    if (isImu) {
      setEnglishMeta(
        "IMU data lab: upload MPU6050 CSV, clean bad frames, compute Allan deviation, fit ARW/RRW and compare Kalman filtering in the browser."
      );
      const sub = document.querySelector("header .sub");
      if (sub) {
        const badge = sub.querySelector(".badge");
        sub.textContent =
          "Upload MPU6050 CSV → CRC cleaning → Allan deviation → drag R/Q to filter. Everything runs in your browser; no backend. ";
        if (badge) {
          badge.textContent = "Demo data";
          sub.appendChild(badge);
        }
      }
      const csv = [...document.querySelectorAll(".hint")].find(
        (h) =>
          h.textContent.includes("CSV 列名") ||
          h.textContent.includes("gx_dps") ||
          h.textContent.includes("CSV columns")
      );
      if (csv)
        csv.innerHTML =
          "CSV columns: <code>gx_dps/gy_dps/gz_dps</code>, optional <code>crc_ok</code>, <code>t</code>. Without a header, rows are parsed as t,gx,gy,gz,crc.";
      const file = document.getElementById("file");
      if (file && !document.getElementById("file-en")) {
        const b = document.createElement("button");
        b.type = "button";
        b.id = "file-en";
        b.className = "mini";
        b.style.cssText = "width:100%;margin:0 0 6px;padding:8px;font-size:12px";
        b.textContent = "Choose CSV";
        b.addEventListener("click", () => file.click());
        file.style.display = "none";
        file.parentNode.insertBefore(b, file);
      }
      const mh = document.querySelector("#manual h2");
      if (mh) mh.textContent = "IMU lab manual · 10 chapters";
      const mhint = document.querySelector("#manual .hint");
      if (mhint)
        mhint.textContent =
          "From what an IMU measures to calibration and lab reports; each chapter anchors to the controls above.";
      const ms = document.getElementById("manual-search");
      if (ms) {
        ms.placeholder = "Search chapters: Allan / calibration / R/Q…";
        ms.setAttribute("aria-label", "Search manual chapters");
      }
      addNote("The 10-chapter lab manual is available in English in the Manual tab.");
    }
    if (isCtrl) {
      setEnglishMeta(
        "Control Play: drag second-order parameters and PID gains, read Bode and step response, and explore state feedback, observers, root locus and discretization."
      );
      const sub = document.querySelector("header .sub");
      if (sub)
        sub.textContent =
          "G(s)=ωn²/(s²+2ζωn·s+ωn²). Drag the sliders to see the Bode plot and step response in real time.";
      const hint = document.querySelector(".controls .hint");
      if (hint)
        hint.textContent =
          "Kp speeds up the response but increases overshoot; Ki removes steady-state error but can oscillate; Kd reduces overshoot and amplifies noise. Drag the sliders to compare open and closed loop.";
      const mh = document.querySelector("#manual h2");
      if (mh) mh.textContent = "Control Play lab manual · 14 chapters";
      const mhint = document.querySelector("#manual .hint");
      if (mhint)
        mhint.textContent =
          "From first/second order to PID, Bode, state space, observers and engineering detail; each chapter anchors to the controls above.";
      const ms = document.getElementById("manual-search");
      if (ms) {
        ms.placeholder = "Search chapters: Bode / observer / root locus…";
        ms.setAttribute("aria-label", "Search manual chapters");
      }
      const lh = document.querySelector("#labs h2");
      if (lh) lh.textContent = "More control labs · 4";
      addNote("All four extended labs and the 14-chapter manual are available in English.");
    }
    if (isSim) {
      setEnglishMeta(
        "43-lesson Simulink control tutorial: interactive demos, a full English lesson guide, MATLAB model provenance and .slx downloads."
      );
      const sub = document.querySelector("header .sub");
      if (sub) {
        sub.innerHTML =
          'A 43-lesson / 8-stage MATLAB + Simulink tutorial. <code>.slx</code> files are binary models the browser cannot run; this page reproduces the same control math interactively. <a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">GitHub repo →</a>';
      }
      repointCourseLinks();
      const note = document.getElementById("demo-note");
      addNote(
        "The full English 43-lesson guide is available in the English guide; use it for .m/.slx downloads and lesson-by-lesson notes.",
        note
      );
    }
  }

  window.vibeTrack = function (name) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "event/" + name });
    } catch (e) {}
  };

  var i18nErrorSent = false;
  function reportI18nError() {
    if (i18nErrorSent) return;
    i18nErrorSent = true;
    if (window.vibeTrack) window.vibeTrack("js-error");
  }
  window.addEventListener("error", reportI18nError);
  window.addEventListener("unhandledrejection", reportI18nError);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      walk(document.body);
      addBanner();
      addSwitch("zh");
      setTimeout(englishCuration, 0);
      window.addEventListener("load", englishCuration);
      mo.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "title", "aria-label", "alt"],
      });
      document.title = translateString(document.title);
    });
  } else {
    walk(document.body);
    addBanner();
    addSwitch("zh");
    setTimeout(englishCuration, 0);
    window.addEventListener("load", englishCuration);
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });
    document.title = translateString(document.title);
  }
})();
