/* Model Lab manual: the first five chapters. Rendered in the current language. */
window.MODEL_MANUAL = {
  zh: [
    {
      title: "1. 什么是系统辨识",
      body: "控制设计需要模型：输入 u 变化后，输出 y 以什么速度、什么形状变化。系统辨识用实测的 u/y 数据反推这个关系。它不是“拟合一条好看的线”，而是提出模型、估计参数、再用独立数据验证。",
    },
    {
      title: "2. 怎么采数据",
      body: "输入必须有激励：阶跃、PRBS、正弦扫频或多阶跃。采样率至少约为对象带宽的 10 倍；阶跃实验至少观察到 5τ；记录单位、初始值、执行器饱和和延迟。闭环数据会让普通最小二乘有偏，优先开环。",
    },
    {
      title: "3. 数据体检",
      body: "先看时间是否单调、有没有缺失/重复、输入是否真的动了、输出是否有响应、是否饱和、噪声多大、时长够不够。硬性错误不应该被拟合掩盖；Model Lab 会先给出 Data Quality Report，再允许辨识。",
    },
    {
      title: "4. 一阶模型 FOPDT",
      body: "G(s)=K e^(-Ls)/(τs+1)。K 是稳态增益，τ 是时间常数，L 是纯延迟。阶跃响应在 L 后按指数上升到 KΔu；达到 63.2% 的时间对应 τ。FOPDT 适合温度、液位和近似一阶的电机转速。",
    },
    {
      title: "5. 二阶模型 SOPDT",
      body: "G(s)=Kωn²/(s²+2ζωn s+ωn²)。ζ<1 有超调，ζ=1 临界阻尼，ζ>1 过阻尼。可以从超调量和峰值时间粗估 ζ、ωn，再做最小二乘。二阶模型适合弹簧-质量-阻尼、位置系统和欠阻尼对象。",
    },
    {
      title: "6. 闭环数据与坏数据",
      body: "如果输入 u 是控制器算出来的，u 和噪声相关，普通最小二乘会有偏。闭环辨识需要额外激励或专门方法；Model Lab 现在提供闭环 PRBS 虚拟实验和 2SLS（用设定值 r 作工具变量）。输入饱和、时间倒错、缺失、噪声过大，都会让模型看起来很好但不可信。",
    },
    {
      title: "7. ARX 离散模型",
      body: "ARX 用差分方程描述输入输出：y[k] 由过去的 y 和 u 决定。它用最小二乘估系数，适合数字控制和 MPC。需要选择 na、nb、nk，并用验证集、残差和稳定性检查。只有阶跃输入时，ARX 的信息不足，结果只能当参考。ARX 之外还有 FIR（脉冲响应）、OE（输出误差）、ARMAX（噪声模型）和 Wiener（输出非线性）；Hammerstein 则在输入端加静态多项式。它们各有适用条件，不能只看训练 FIT。",
    },
    {
      title: "8. ETFE 频域响应",
      body: "ETFE 用 FFT 估计 H(ω)=Y(ω)/U(ω)，适合扫频、chirp 和多正弦。相干函数 γ² 接近 1 的频段可信；接近 0 的频段不要信。它不给传递函数参数，但能直接看带宽、谐振和相位。",
    },
    {
      title: "9. 验证与过拟合",
      body: "训练集拟合好不等于模型好。必须留出验证集，检查 FIT、残差是否白噪声、残差与输入是否相关、极点是否稳定、参数是否物理合理。模型阶次越高越容易过拟合；简单模型能解释数据时，优先简单模型。",
    },
    {
      title: "10. 从模型到控制器",
      body: "辨识结果不是终点。SOPDT 可以送进 Control Play 调 PID；FOPDT 可以直接送到 Control Play 的一阶模式，或导出 .m。进入控制器前要确认：模型适用范围、饱和、延迟、未建模动态和安全边界。教学模型不能替代真实标定。",
    },
  ],
  en: [
    {
      title: "1. What system identification is",
      body: "Control design needs a model: how output y responds to input u, and how fast. System identification infers that relationship from measured u/y data. It is not just drawing a nice fit: propose a structure, estimate parameters, then validate on independent data.",
    },
    {
      title: "2. How to collect data",
      body: "The input must excite the plant: step, PRBS, sine sweep or multi-step. Sample at about 10× the plant bandwidth; record at least 5τ after a step; note units, initial values, actuator saturation and delay. Closed-loop data biases ordinary least squares; prefer open loop.",
    },
    {
      title: "3. Data health",
      body: "Check monotonic time, missing/duplicate rows, input motion, output response, saturation, noise and duration. Hard errors must not be hidden by a fit. Model Lab shows the Data Quality Report before allowing identification.",
    },
    {
      title: "4. First-order model (FOPDT)",
      body: "G(s)=K e^(-Ls)/(τs+1). K is the steady-state gain, τ the time constant, L the dead time. After L, a step rises exponentially toward KΔu; 63.2% of the change marks τ. FOPDT suits temperature, level and approximately first-order motor speed.",
    },
    {
      title: "5. Second-order model (SOPDT)",
      body: "G(s)=Kωn²/(s²+2ζωn s+ωn²). ζ<1 overshoots, ζ=1 is critically damped, ζ>1 is overdamped. Overshoot and peak time give rough ζ/ωn estimates; refine with least squares. SOPDT suits spring-mass-damper, positioning and underdamped plants.",
    },
    {
      title: "6. Closed-loop and bad data",
      body: "If u is computed by a controller, u is correlated with noise and ordinary least squares is biased. Closed-loop identification needs extra excitation or dedicated methods; Model Lab now provides a closed-loop PRBS experiment and 2SLS using setpoint r as the instrument. Saturation, reversed time, missing rows or too much noise can make a model look good but be untrustworthy.",
    },
    {
      title: "7. ARX discrete models",
      body: "ARX describes the plant with a difference equation: y[k] depends on past y and u. It estimates coefficients by least squares and suits digital control and MPC. Choose na, nb, nk and check validation, residuals and stability. A step-only input is not informative enough; treat the result as a reference. Beyond ARX there are FIR (impulse response), OE (output error), ARMAX (noise model) and Wiener (output nonlinearity); Hammerstein adds a static input polynomial. Each has assumptions; do not judge by training FIT alone.",
    },
    {
      title: "8. ETFE frequency response",
      body: "ETFE estimates H(ω)=Y(ω)/U(ω) with an FFT and suits sweeps, chirps and multisine inputs. Trust bands where coherence γ² is near 1; ignore bands near 0. It gives no transfer-function parameters, but shows bandwidth, resonance and phase directly.",
    },
    {
      title: "9. Validation and overfitting",
      body: "A good training fit is not a good model. Hold out validation data and check FIT, residual whiteness, residual/input correlation, pole stability and physical plausibility. Higher orders overfit more easily; prefer the simplest model that explains the data.",
    },
    {
      title: "10. From model to controller",
      body: "Identification is not the endpoint. SOPDT can go to Control Play for PID tuning; FOPDT can go straight to the first-order Control mode or export .m. Before closing the loop, check the model's valid range, saturation, delay, unmodeled dynamics and safety limits. A teaching model does not replace real calibration.",
    },
  ],
};
