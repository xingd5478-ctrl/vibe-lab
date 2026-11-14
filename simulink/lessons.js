/* 43 课目录（来自 simulink-control-tutorial），demo 字段指向本页可交互复现的课程 */
window.SIMULINK_LESSONS = {
  repo: "https://github.com/xingd5478-ctrl/simulink-control-tutorial",
  phases: [
    {
      id: 1, title: "Phase 1 · Simulink 基础与动力学", range: "t01–t08",
      items: [
        { id: "t01", n: 1, title: "信号基础", desc: "信号、增益、示波器", file: "t01_signal_basics.m", model: "tutorial01_signals.slx", demo: "signal" },
        { id: "t02", n: 2, title: "数学运算", desc: "Sum/Product/Mux/Demux", file: "t02_math_blocks.m", model: "tutorial02_math.slx", demo: "signal" },
        { id: "t03", n: 3, title: "一阶系统", desc: "传递函数、时间常数", file: "t03_first_order_sys.m", model: "tutorial03_first_order.slx", demo: "first-order" },
        { id: "t04", n: 4, title: "二阶系统", desc: "阻尼比、超调量、固有频率", file: "t04_second_order_sys.m", model: "tutorial04_second_order.slx", demo: "second-order" },
        { id: "t05", n: 5, title: "PID 控制", desc: "P/I/D 各环节作用、反馈闭环", file: "t05_pid_control.m", model: "tutorial05_pid.slx", demo: "pid" },
        { id: "t06", n: 6, title: "信号源与输出", desc: "Workspace 导入导出", file: "t06_sources_and_sinks.m", model: "tutorial06_sources_sinks.slx", demo: "signal" },
        { id: "t07", n: 7, title: "子系统", desc: "模型层次化封装", file: "t07_subsystem.m", model: "tutorial07_subsystem.slx" },
        { id: "t08", n: 8, title: "Mask 封装", desc: "参数化模块设计", file: "t08_masking.m", model: "tutorial08_masking.slx" },
      ],
    },
    {
      id: 2, title: "Phase 2 · 经典控制设计", range: "t16, t17, t22",
      items: [
        { id: "t16", n: 16, title: "频域分析", desc: "Bode/Nyquist、增益/相位裕度", file: "t16_freq_domain.m", model: "tutorial16_freq.slx", demo: "bode" },
        { id: "t17", n: 17, title: "超前-滞后校正", desc: "Lead/Lag 补偿器、频率整形", file: "t17_lead_lag.m", model: "tutorial17_leadlag.slx" },
        { id: "t22", n: 22, title: "根轨迹法", desc: "rlocus、极点走向、补偿器", file: "t22_root_locus.m", model: "tutorial22_root_locus.slx", demo: "rootlocus" },
      ],
    },
    {
      id: 3, title: "Phase 3 · 现代控制", range: "t09–t12",
      items: [
        { id: "t09", n: 9, title: "状态空间模型", desc: "ẋ=Ax+Bu, y=Cx+Du", file: "t09_state_space.m", model: "tutorial09_state_space.slx" },
        { id: "t10", n: 10, title: "状态反馈 / LQR", desc: "极点配置、Riccati、Q/R 调参", file: "t10_state_feedback.m", model: "tutorial10_state_feedback.slx", demo: "state-feedback" },
        { id: "t11", n: 11, title: "状态观测器", desc: "Luenberger、(A-LC)、对偶性", file: "t11_observer.m", model: "tutorial11_observer.slx", demo: "observer" },
        { id: "t12", n: 12, title: "Kalman 滤波", desc: "lqe()、Q/R 噪声建模", file: "t12_kalman_filter.m", model: "tutorial12_kalman.slx", demo: "kalman" },
      ],
    },
    {
      id: 4, title: "Phase 4 · 高级控制", range: "t18–t21, t23, t24",
      items: [
        { id: "t18", n: 18, title: "系统辨识", desc: "阶跃响应、最小二乘、验证", file: "t18_system_id.m", model: "tutorial18_sysid.slx" },
        { id: "t19", n: 19, title: "H∞ 鲁棒控制", desc: "混合灵敏度、hinfsyn、μ 分析", file: "t19_robust_control.m", model: "tutorial19_robust.slx" },
        { id: "t20", n: 20, title: "模型预测控制 MPC", desc: "滚动优化、QP 约束", file: "t20_mpc.m", model: "tutorial20_mpc.slx", demo: "mpc" },
        { id: "t21", n: 21, title: "滑模控制 SMC", desc: "滑模面、抖振、Super-Twisting", file: "t21_sliding_mode.m", model: "tutorial21_smc.slx", demo: "smc" },
        { id: "t23", n: 23, title: "MRAC 自适应", desc: "MIT 规则、参考模型", file: "t23_mrac.m", model: "tutorial23_mrac.slx" },
        { id: "t24", n: 24, title: "模糊逻辑控制", desc: "Sugeno FIS、隶属度、控制曲面", file: "t24_fuzzy_control.m", model: "tutorial24_fuzzy.slx", demo: "fuzzy" },
      ],
    },
    {
      id: 5, title: "Phase 5 · 机电系统与部署", range: "t13–t15, t25",
      items: [
        { id: "t13", n: 13, title: "DC 电机控制", desc: "电磁+机械耦合、级联 PI", file: "t13_dc_motor.m", model: "tutorial13_dc_motor.slx" },
        { id: "t14", n: 14, title: "PMSM + FOC", desc: "Clarke/Park、d-q 解耦", file: "t14_foc_pmsm.m", model: "tutorial14_foc.slx" },
        { id: "t25", n: 25, title: "Simscape 物理建模", desc: "多域耦合、自动推导", file: "t25_simscape.m", model: "tutorial25_simscape.slx" },
        { id: "t15", n: 15, title: "代码生成", desc: "c2d、dlqr、C 代码、FreeRTOS", file: "t15_code_generation.m", model: "tutorial15_codegen.slx" },
      ],
    },
    {
      id: 6, title: "Phase 6 · 综合案例", range: "t26–t30",
      items: [
        { id: "t26", n: 26, title: "机器人运动学", desc: "DH 参数、正逆运动学", file: "t26_robot_kinematics.m", model: "tutorial26_kinematics.slx", demo: "arm" },
        { id: "t27", n: 27, title: "MSD 系统建模", desc: "TF/SS/离散/数值积分对比", file: "t27_msd_modeling.m", model: "tutorial27_msd_models.slx", demo: "msd" },
        { id: "t28", n: 28, title: "DSP 基础", desc: "采样定理、FFT、窗函数", file: "t28_dsp_basics.m", model: "tutorial28_dsp.slx", demo: "dsp" },
        { id: "t29", n: 29, title: "MSD 控制对比", desc: "PID vs LQR + 噪声", file: "t29_msd_control.m", model: "tutorial29_control_compare.slx" },
        { id: "t30", n: 30, title: "主动悬挂", desc: "1/4 车模型 + PID", file: "t30_active_suspension.m", model: "tutorial30_suspension.slx" },
      ],
    },
    {
      id: 7, title: "Phase 7 · 非线性滤波", range: "t31–t35",
      items: [
        { id: "t31", n: 31, title: "EKF 基础", desc: "Van der Pol、Jacobian", file: "t31_ekf_basics.m", model: "tutorial31_ekf.slx" },
        { id: "t32", n: 32, title: "EKF 倒立摆", desc: "强非线性、初值收敛", file: "t32_ekf_pendulum.m", model: "tutorial32_pendulum.slx" },
        { id: "t33", n: 33, title: "UKF", desc: "Sigma 点、无迹变换", file: "t33_ukf_basics.m", model: "tutorial33_ukf.slx" },
        { id: "t34", n: 34, title: "EKF vs UKF", desc: "Monte Carlo 统计对比", file: "t34_ekf_vs_ukf.m", model: "tutorial34_ekfvsukf.slx" },
        { id: "t35", n: 35, title: "IMU 融合", desc: "陀螺+加速度、互补 vs EKF", file: "t35_imu_fusion.m", model: "tutorial35_imu.slx" },
      ],
    },
    {
      id: 8, title: "Phase 8 · Simulink 进阶", range: "t36–t43",
      items: [
        { id: "t36", n: 36, title: "Stateflow 状态机", desc: "状态/转移/条件动作", file: "t36_stateflow_basics.m", model: "tutorial36_stateflow.slx" },
        { id: "t37", n: 37, title: "触发/使能子系统", desc: "条件执行、采样保持", file: "t37_triggered_subsystem.m", model: "tutorial37_triggered.slx" },
        { id: "t38", n: 38, title: "Bus 信号", desc: "打包拆解、按名提取", file: "t38_bus_signals.m", model: "tutorial38_bus.slx" },
        { id: "t39", n: 39, title: "模型引用", desc: "Model block 子模型复用", file: "t39_model_referencing.m", model: "tutorial39_top.slx" },
        { id: "t40", n: 40, title: "变体子系统", desc: "一套模型多套方案", file: "t40_variant_subsystem.m", model: "tutorial40_variant.slx" },
        { id: "t41", n: 41, title: "模型回调", desc: "PreLoad/Init/StopFcn", file: "t41_callbacks.m", model: "tutorial41_callbacks.slx" },
        { id: "t42", n: 42, title: "S-Function", desc: "Level-2 MATLAB S-Function", file: "t42_sfunction_basics.m", model: "tutorial42_sfunction.slx" },
        { id: "t43", n: 43, title: "Model Advisor", desc: "静态分析、代数环检查", file: "t43_model_advisor.m", model: "tutorial43_advisor.slx" },
      ],
    },
  ],
};
