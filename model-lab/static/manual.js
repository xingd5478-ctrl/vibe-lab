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
  ],
};
