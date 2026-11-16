/* Interactive Simulink demos, registered for app-ui.js. */
(function () {
  const { $, S, toPts, maxOf, minOf, f2, metrics, links, diagram, renderArm, sfState, plot } = window.SimApp;
  window.SIMULINK_DEMOS = {
    stateflow: {
      title: "t36 · Stateflow 状态机",
      lesson: "t36",
      note: "状态机只认「状态 + 事件」：启动→Running，故障→Fault 锁存，必须复位才回 Idle。点按钮看状态迁移。",
      diagram: {
        aria: "状态机：事件进入 Stateflow，输出状态",
        blocks: [{ label: "事件" }, { label: "Stateflow", sub: "Idle/Run/Fault" }, { label: "状态输出" }],
      },
      params: [
        {
          id: "cmd",
          label: "事件",
          type: "buttons",
          value: 0,
          options: [
            { label: "启动", value: 1 },
            { label: "停止", value: 0 },
            { label: "故障", value: 2 },
            { label: "复位", value: 3 },
          ],
        },
      ],
      render(p) {
        if (p.cmd !== sfState.lastCmd) {
          const ns = S.nextState(sfState.state, p.cmd);
          sfState.state = ns;
          sfState.log.push([sfState.log.length, ns]);
          sfState.lastCmd = p.cmd;
        }
        const pts = [];
        sfState.log.forEach(([i, s]) => {
          pts.push([i, s]);
          pts.push([i + 0.9, s]);
        });
        plot($("chart-a"), {
          height: 250,
          xLabel: "事件序号",
          yLabel: "状态 (0=Idle, 1=Run, 2=Fault)",
          yMin: -0.3,
          yMax: 2.4,
          aria: "状态机状态随事件变化",
          series: [{ name: "state", color: "#1f4e79", width: 2.0, points: pts }],
        });
        $("chart-b").innerHTML = "";
        const names = ["Idle", "Running", "Fault"];
        metrics([
          ["当前状态", names[sfState.state]],
          ["事件数", String(sfState.log.length - 1)],
          ["故障锁存", sfState.state === 2 ? "是（需复位）" : "否"],
        ]);
      },
    },

    variant: {
      title: "t40 · 变体切换",
      lesson: "t40",
      note: "同一个被控对象，切换「开环 / PID / 状态反馈」三个变体。变体只是配置选择，不是重新建模。",
      diagram: {
        aria: "变体子系统：三个控制器实现切换",
        blocks: [{ label: "参考" }, { label: "Variant", sub: "开环/PID/PD" }, { label: "Plant" }, { label: "Scope" }],
      },
      params: [
        {
          id: "mode",
          label: "变体",
          type: "buttons",
          value: 1,
          options: [
            { label: "开环", value: 0 },
            { label: "PID", value: 1 },
            { label: "状态反馈", value: 2 },
          ],
        },
      ],
      render(p) {
        const r = S.variantDemo(p.mode);
        const m = S.metrics(r.t, r.y, 1);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "输出 y",
          yMin: 0,
          yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: `变体 ${r.label} 的阶跃响应`,
          series: [{ name: r.label, color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "控制 u",
          aria: "变体控制量",
          series: [{ name: "u", color: "#2f6b4f", width: 1.2, points: toPts(r.t, r.u) }],
        });
        metrics([
          ["当前变体", r.label],
          ["超调量", f2(m.overshoot) + " %"],
          ["2% 调节时间", f2(m.settle) + " s"],
          ["稳态误差", m.ess.toFixed(3)],
        ]);
      },
    },

    signal: {
      title: "t01 · 信号与增益",
      lesson: "t01",
      note: "y(t)=K·u(t)。先看输入，再看放大后的输出；打开噪声模拟真实传感器。",
      diagram: {
        aria: "信号流：正弦输入经增益到示波器",
        blocks: [{ label: "Sine" }, { label: "Gain K" }, { label: "Scope" }],
      },
      params: [
        { id: "K", label: "增益 K", min: 0.5, max: 3, step: 0.1, value: 2 },
        { id: "freq", label: "频率 (Hz)", min: 0.2, max: 2, step: 0.05, value: 0.5 },
        { id: "noise", label: "叠加噪声", type: "toggle", value: false },
      ],
      render(p) {
        const r = S.signalDemo(p.K, p.freq, p.noise);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "u(t) / y(t)",
          yMin: -3.6,
          yMax: 3.6,
          aria: `正弦输入经增益 K=${p.K} 的输出`,
          series: [
            { name: "输入 u", color: "#b9b3a5", width: 1.6, points: toPts(r.t, r.u) },
            { name: "输出 y=K·u", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) },
          ],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["输入幅值", "1.00"],
          ["输出幅值", p.K.toFixed(2)],
          ["频率", p.freq.toFixed(2) + " Hz"],
          ["噪声", p.noise ? "有" : "无"],
        ]);
      },
    },

    pid: {
      title: "t05 · PID 控制",
      lesson: "t05",
      note: "u = Kp·e + Ki·∫e + Kd·de。先把 Ki、Kd 调 0 只看 P，再加 I 消稳态误差，最后加 D 压超调。",
      diagram: {
        aria: "PID 闭环框图：参考与输出相减进入 PID，控制二阶对象",
        blocks: [
          { label: "Step" },
          { label: "Σ", sub: "+ −" },
          { label: "PID" },
          { label: "Plant", sub: "二阶对象" },
          { label: "Scope" },
        ],
        sumIndex: 1,
        feedback: "输出 y",
      },
      params: [
        { id: "kp", label: "Kp", min: 0, max: 6, step: 0.1, value: 1.5 },
        { id: "ki", label: "Ki", min: 0, max: 4, step: 0.1, value: 1.2 },
        { id: "kd", label: "Kd", min: 0, max: 1, step: 0.01, value: 0.05 },
      ],
      render(p) {
        const r = S.pidDemo(p.kp, p.ki, p.kd);
        const m = S.metrics(r.t, r.y, 1);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "输出 y",
          yMin: 0,
          yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: `PID 阶跃响应，Kp=${p.kp}，Ki=${p.ki}，Kd=${p.kd}`,
          series: [{ name: "y", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "控制 u",
          aria: "PID 控制量",
          series: [{ name: "u", color: "#2f6b4f", width: 1.2, points: toPts(r.t, r.u) }],
        });
        metrics([
          ["超调量", f2(m.overshoot) + " %"],
          ["2% 调节时间", f2(m.settle) + " s"],
          ["稳态误差", m.ess.toFixed(4)],
          ["控制峰值", maxOf(r.u).toFixed(2)],
        ]);
      },
    },

    kalman: {
      title: "t12 · Kalman 滤波",
      lesson: "t12",
      note: "预测 P←P+Q，更新 K=P/(P+R)。R 是传感器噪声，Q 是模型噪声；调大 R 更信模型，调大 Q 更信测量。",
      diagram: {
        aria: "卡尔曼滤波：测量 z 与模型预测融合",
        blocks: [
          { label: "真值 1" },
          { label: "测量 z", sub: "+噪声" },
          { label: "Kalman", sub: "K=P/(P+R)" },
          { label: "Scope" },
        ],
      },
      params: [
        { id: "R", label: "测量噪声 R", min: 0.01, max: 1, step: 0.01, value: 0.1 },
        { id: "Q", label: "过程噪声 Q", min: 0.001, max: 0.1, step: 0.001, value: 0.005 },
      ],
      render(p) {
        const r = S.kalmanDemo(p.R, p.Q);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "真值 / 测量 / 估计",
          yMin: 0.4,
          yMax: 1.6,
          aria: `卡尔曼估计，R=${p.R}，Q=${p.Q}`,
          series: [
            { name: "测量 z", color: "#d3ccba", width: 1.0, points: toPts(r.t, r.z) },
            { name: "估计 x̂", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.x) },
          ],
        });
        const e1 = new Float64Array(r.t.length),
          e2 = new Float64Array(r.t.length);
        for (let i = 0; i < r.t.length; i++) {
          e1[i] = r.z[i] - 1;
          e2[i] = r.x[i] - 1;
        }
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "误差",
          aria: "测量误差与滤波误差",
          series: [
            { name: "测量误差", color: "#b9b3a5", width: 1.0, points: toPts(r.t, e1) },
            { name: "滤波误差", color: "#2f6b4f", width: 1.4, points: toPts(r.t, e2) },
          ],
        });
        metrics([
          ["测量 RMSE", r.rmseMeas.toFixed(4)],
          ["滤波 RMSE", r.rmseKf.toFixed(4)],
          ["R / Q", `${p.R.toFixed(2)} / ${p.Q.toFixed(3)}`],
        ]);
      },
    },

    bode: {
      title: "t16 · 频域 Bode",
      lesson: "t16",
      note: "幅频看不同频率被放大/衰减多少（dB），相频看滞后。ζ 小会出现谐振峰；−3 dB 点近似带宽。",
      diagram: {
        aria: "频域分析：正弦扫频经系统到 Bode",
        blocks: [{ label: "Sine Sweep" }, { label: "G(s)" }, { label: "Bode" }],
      },
      params: [
        { id: "wn", label: "固有频率 ωn (rad/s)", min: 1, max: 15, step: 0.5, value: 5 },
        { id: "zeta", label: "阻尼比 ζ", min: 0.05, max: 1.2, step: 0.05, value: 0.3 },
      ],
      render(p) {
        const b = S.bodeDemo(p.wn, p.zeta);
        plot($("chart-a"), {
          height: 250,
          logX: true,
          xLabel: "ω (rad/s)",
          yLabel: "幅值 (dB)",
          aria: `二阶系统 Bode 幅频，ωn=${p.wn}，ζ=${p.zeta}`,
          series: [{ name: "|G|", color: "#1f4e79", width: 1.8, points: b.w.map((w, i) => [w, b.mag[i]]) }],
        });
        plot($("chart-b"), {
          height: 250,
          logX: true,
          xLabel: "ω (rad/s)",
          yLabel: "相位 (°)",
          yMin: -190,
          yMax: 5,
          aria: "二阶系统 Bode 相频",
          series: [{ name: "∠G", color: "#8a4a12", width: 1.6, points: b.w.map((w, i) => [w, b.phase[i]]) }],
        });
        metrics([
          ["谐振峰值", b.peak.toFixed(2) + " dB"],
          ["−3 dB 带宽", b.bw.toFixed(2) + " rad/s"],
          ["ωn 处相位", b.phaseAtWn.toFixed(1) + "°"],
          ["ζ", p.zeta.toFixed(2)],
        ]);
      },
    },

    mpc: {
      title: "t20 · MPC 模型预测控制",
      lesson: "t20",
      note: "每步往后预测 N 步，只执行第一个控制量，再滚动重算。uMax 是输入约束；N 太小短视，Q/R 权衡跟踪与省力。",
      diagram: {
        aria: "MPC 框图：参考进入预测优化器，控制对象并反馈",
        blocks: [{ label: "参考" }, { label: "MPC", sub: "min Σ Q e²+R u²" }, { label: "Plant" }, { label: "Scope" }],
        sumIndex: 0,
        feedback: "状态反馈",
      },
      params: [
        { id: "N", label: "预测步数 N", min: 3, max: 15, step: 1, value: 8 },
        { id: "Q", label: "跟踪权重 Q", min: 0.1, max: 10, step: 0.1, value: 1 },
        { id: "R", label: "控制权重 R", min: 0.01, max: 1, step: 0.01, value: 0.1 },
        { id: "uMax", label: "输入约束 uMax", min: 0.05, max: 1, step: 0.05, value: 0.3 },
      ],
      render(p) {
        const r = S.mpcDemo(p.N, p.Q, p.R, p.uMax);
        const m = S.metrics(r.t, r.x, 1);
        let sat = 0;
        for (const u of r.u) if (Math.abs(u) >= p.uMax * 0.999) sat++;
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "输出 x",
          yMin: 0,
          yMax: Math.max(1.2, maxOf(r.x)) * 1.1,
          aria: `MPC 跟踪，N=${p.N}，uMax=${p.uMax}`,
          series: [
            { name: "x", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.x) },
            {
              name: "参考",
              color: "#b9b3a5",
              width: 1.2,
              dash: "5 4",
              points: [
                [0, 0],
                [1, 0],
                [1, 1],
                [8, 1],
              ],
            },
          ],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "控制 u",
          aria: "MPC 控制量",
          series: [{ name: "u", color: "#2f6b4f", width: 1.4, points: toPts(r.t, r.u) }],
        });
        metrics([
          ["超调量", f2(m.overshoot) + " %"],
          ["末值误差", Math.abs(r.x[r.x.length - 1] - 1).toFixed(4)],
          ["贴限幅比例", ((sat / r.u.length) * 100).toFixed(0) + " %"],
          ["N", String(p.N)],
        ]);
      },
    },

    rootlocus: {
      title: "t22 · 根轨迹",
      lesson: "t22",
      note: "G(s)=1/(s(s+1)(s+2))。X=开环极点（0,−1,−2），实心点=当前闭环极点，蓝色虚线为 60° 渐近线；本系统无零点（无 O）。K 过 6 后极点进入右半平面。",
      diagram: {
        aria: "根轨迹：增益 K 与开环 G(s) 的闭环极点",
        blocks: [{ label: "K" }, { label: "G(s)", sub: "1/(s(s+1)(s+2))" }, { label: "rlocus" }],
      },
      params: [{ id: "K", label: "开环增益 K", min: 0.1, max: 50, step: 0.1, value: 1 }],
      render(p) {
        const b = S.rootLocusDemo(p.K);
        let maxIm = 0.1;
        b.branches.forEach((br) =>
          br.forEach(([, im]) => {
            if (Math.abs(im) > maxIm) maxIm = Math.abs(im);
          })
        );
        const series = b.branches.map((br, i) => ({
          name: `分支 ${i + 1}`,
          color: i === 0 ? "#1f4e79" : i === 1 ? "#2f6b4f" : "#8a4a12",
          width: 1.4,
          legend: false,
          points: br,
        }));
        b.highlight.forEach((br, i) => {
          if (br.length > 1) {
            series.push({ name: "K∈[20,50]", color: "#b5651d", width: 3.0, legend: i === 0, points: br });
          }
        });
        series.push({
          name: "y 轴 (x=0)",
          color: "#1b1d22",
          width: 1.3,
          legend: true,
          points: [
            [0, -4.5],
            [0, 4.5],
          ],
        });
        [60, 180, 300].forEach((deg) => {
          const rad = (deg * Math.PI) / 180;
          series.push({
            name: "渐近线",
            color: "#7a9cc6",
            width: 1,
            dash: "6 5",
            legend: false,
            points: [
              [-1, 0],
              [-1 + 8 * Math.cos(rad), 8 * Math.sin(rad)],
            ],
          });
        });
        series.push({
          name: "开环极点 X",
          color: "#5b564c",
          marker: "x",
          line: false,
          points: b.openPoles.map((p) => [p, 0]),
        });
        series.push({
          name: "当前闭环极点",
          color: "#1f4e79",
          marker: "dot",
          line: false,
          points: b.current.map((p) => [p.re, p.im]),
        });
        if (b.zeros.length) {
          series.push({
            name: "零点 O",
            color: "#2f6b4f",
            marker: "o",
            line: false,
            points: b.zeros.map((p) => [p, 0]),
          });
        }
        plot($("chart-a"), {
          height: 270,
          xLabel: "Re",
          yLabel: "Im",
          xMin: -5.5,
          xMax: 1.5,
          yMin: -4.5,
          yMax: 4.5,
          aria: `根轨迹，K=${p.K}`,
          series,
        });
        $("chart-b").innerHTML = "";
        const poles = b.current.map((q) => `${q.re.toFixed(2)}${q.im >= 0 ? "+" : ""}${q.im.toFixed(2)}j`).join("  ");
        metrics([
          ["闭环极点", poles],
          ["稳定性", b.stable ? "稳定" : "不稳定"],
          ["最大实部", b.maxRe.toFixed(3)],
          ["零点", "无（O 不显示）"],
        ]);
      },
    },

    fuzzy: {
      title: "t24 · 模糊控制",
      lesson: "t24",
      note: "误差分为 N/Z/P 三个隶属度，规则输出加权平均；scale 是总增益。它不依赖精确模型，靠规则表；纯模糊 P 会留下稳态误差，实际常加积分或提高尺度。",
      diagram: {
        aria: "模糊控制：误差进入模糊推理，输出控制对象",
        blocks: [{ label: "e" }, { label: "Fuzzy", sub: "N/Z/P" }, { label: "Plant" }, { label: "Scope" }],
      },
      params: [{ id: "scale", label: "输出尺度", min: 0.5, max: 10, step: 0.5, value: 4 }],
      render(p) {
        const r = S.fuzzyDemo(p.scale);
        const m = S.metrics(r.t, r.y, 1);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "输出 y",
          yMin: 0,
          yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: `模糊控制响应，尺度=${p.scale}`,
          series: [{ name: "y", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "控制 u",
          aria: "模糊控制量",
          series: [{ name: "u", color: "#2f6b4f", width: 1.2, points: toPts(r.t, r.u) }],
        });
        metrics([
          ["超调量", f2(m.overshoot) + " %"],
          ["2% 调节时间", f2(m.settle) + " s"],
          ["稳态误差", m.ess.toFixed(3)],
          ["控制峰值", maxOf(r.u).toFixed(2)],
          ["输出尺度", p.scale.toFixed(1)],
        ]);
      },
    },

    msd: {
      title: "t27 · 质量-弹簧-阻尼",
      lesson: "t27",
      note: "m ẍ + c ẋ + k x = F。ωn=√(k/m)、ζ=c/(2√(km))：k 决定晃多快，c 决定多久停。",
      diagram: {
        aria: "质量弹簧阻尼系统：力作用于质量，经弹簧阻尼到示波器",
        blocks: [
          { label: "Force" },
          { label: "m", sub: "质量" },
          { label: "k / c", sub: "弹簧/阻尼" },
          { label: "Scope" },
        ],
      },
      params: [
        { id: "k", label: "刚度 k (N/m)", min: 1, max: 20, step: 0.5, value: 5 },
        { id: "c", label: "阻尼 c (N·s/m)", min: 0.1, max: 5, step: 0.1, value: 1 },
      ],
      render(p) {
        const r = S.msdDemo(p.k, p.c);
        const m = S.metrics(r.t, r.x, 1 / p.k);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "位移 x",
          yMin: 0,
          yMax: Math.max(1 / p.k, maxOf(r.x)) * 1.2,
          aria: `质量弹簧阻尼位移，k=${p.k}，c=${p.c}`,
          series: [{ name: "x", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.x) }],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["ωn", r.wn.toFixed(2) + " rad/s"],
          ["ζ", r.zeta.toFixed(2)],
          ["超调量", f2(m.overshoot) + " %"],
          ["2% 调节时间", f2(m.settle) + " s"],
        ]);
      },
    },

    arm: {
      title: "t26 · 机器人运动学",
      lesson: "t26",
      note: "给目标点 (x,y)，用几何逆解算 θ1、θ2；目标超出 l1+l2=1.8 就不可达。红叉是目标，蓝点是末端。",
      diagram: {
        aria: "两连杆机械臂：关节角到末端位置",
        blocks: [{ label: "θ1, θ2" }, { label: "正运动学", sub: "l1, l2" }, { label: "末端 (x,y)" }],
      },
      params: [
        { id: "x", label: "目标 x (m)", min: 0.1, max: 1.7, step: 0.05, value: 1.2 },
        { id: "y", label: "目标 y (m)", min: -1, max: 1, step: 0.05, value: 0.6 },
      ],
      render(p) {
        const a = S.armDemo(p.x, p.y);
        renderArm($("chart-a"), a);
        $("chart-b").innerHTML = "";
        metrics([
          ["可达性", a.reachable ? "可达" : "不可达（>1.8 m）"],
          ["θ1", ((a.th1 * 180) / Math.PI).toFixed(1) + "°"],
          ["θ2", ((a.th2 * 180) / Math.PI).toFixed(1) + "°"],
          ["末端", `(${a.ex.toFixed(2)}, ${a.ey.toFixed(2)})`],
        ]);
      },
    },

    dsp: {
      title: "t28 · 采样与混叠",
      lesson: "t28",
      note: "采样定理要求 fs>2f。f 超过 fs/2 后，重建波形会折叠成低频假信号——这就是混叠。",
      diagram: {
        aria: "采样流程：正弦、采样、FFT",
        blocks: [{ label: "正弦 f" }, { label: "采样 fs" }, { label: "重建/FFT" }],
      },
      params: [
        { id: "f", label: "信号频率 f (Hz)", min: 1, max: 40, step: 1, value: 5 },
        { id: "fs", label: "采样率 fs (Hz)", min: 10, max: 100, step: 5, value: 40 },
      ],
      render(p) {
        const r = S.dspDemo(p.f, p.fs);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "幅值",
          yMin: -1.3,
          yMax: 1.3,
          aria: `采样演示，f=${p.f}，fs=${p.fs}`,
          series: [
            { name: "真实正弦", color: "#b9b3a5", width: 1.4, points: toPts(r.t, r.y) },
            { name: "采样点连线", color: "#1f4e79", width: 1.6, points: toPts(r.ts, r.z) },
          ],
        });
        const ya = new Float64Array(r.t.length);
        for (let i = 0; i < r.t.length; i++) ya[i] = Math.sin(2 * Math.PI * r.alias * r.t[i]);
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "真实 / 混叠重建",
          yMin: -1.3,
          yMax: 1.3,
          aria: "真实频率与混叠频率对比",
          series: [
            { name: "真实", color: "#b9b3a5", width: 1.2, points: toPts(r.t, r.y) },
            { name: "重建", color: "#8a4a12", width: 1.6, points: toPts(r.t, ya) },
          ],
        });
        metrics([
          ["奈奎斯特 fs/2", r.nyquist.toFixed(1) + " Hz"],
          ["混叠频率", r.alias.toFixed(1) + " Hz"],
          ["是否混叠", r.aliased ? "是" : "否"],
          ["f / fs", (p.f / p.fs).toFixed(2)],
        ]);
      },
    },

    imu: {
      title: "t35 · IMU 融合",
      lesson: "t35",
      note: "互补滤波：θ̂←α(θ̂+ωdt)+(1−α)θacc。α 大更信陀螺（平滑但漂），α 小更信加速度计（跟得快但抖）。",
      diagram: {
        aria: "IMU 融合：陀螺积分与加速度计倾角互补",
        blocks: [
          { label: "Gyro", sub: "积分" },
          { label: "互补滤波", sub: "α" },
          { label: "Accel", sub: "倾角" },
          { label: "Scope" },
        ],
      },
      params: [
        { id: "alpha", label: "互补系数 α", min: 0.8, max: 0.99, step: 0.01, value: 0.95 },
        { id: "noise", label: "加入噪声/漂移", type: "toggle", value: true },
      ],
      render(p) {
        const r = S.imuFusionDemo(p.alpha, p.noise);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "倾角 (°)",
          aria: `IMU 融合，α=${p.alpha}`,
          series: [
            { name: "真值", color: "#b9b3a5", width: 1.2, points: toPts(r.t, r.truth) },
            { name: "加速度计", color: "#8a4a12", width: 0.9, points: toPts(r.t, r.acc) },
            { name: "互补输出", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.comp) },
          ],
        });
        const e1 = new Float64Array(r.t.length),
          e2 = new Float64Array(r.t.length);
        for (let i = 0; i < r.t.length; i++) {
          e1[i] = r.acc[i] - r.truth[i];
          e2[i] = r.comp[i] - r.truth[i];
        }
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "误差 (°)",
          aria: "加速度计与互补滤波误差",
          series: [
            { name: "加速度计误差", color: "#b9b3a5", width: 0.9, points: toPts(r.t, e1) },
            { name: "互补误差", color: "#2f6b4f", width: 1.4, points: toPts(r.t, e2) },
          ],
        });
        metrics([
          ["加速度计 RMSE", r.rmseAcc.toFixed(3)],
          ["互补 RMSE", r.rmseComp.toFixed(3)],
          ["α", p.alpha.toFixed(2)],
        ]);
      },
    },

    bus: {
      title: "t38 · Bus 信号",
      lesson: "t38",
      note: "Bus Creator 把 4 路信号打包成一条总线；Bus Selector 按索引/名字取出其中一路。打包不改变信号值。",
      diagram: {
        aria: "Bus：四路信号打包后选择一路",
        blocks: [{ label: "u1..u4" }, { label: "Bus Creator" }, { label: "Bus Selector" }, { label: "Scope" }],
      },
      params: [{ id: "sel", label: "选择第几路 (0–3)", min: 0, max: 3, step: 1, value: 1 }],
      render(p) {
        const r = S.busDemo(p.sel);
        const names = ["sin", "cos", "ramp", "square"];
        const colors = ["#1f4e79", "#2f6b4f", "#8a4a12", "#7a9cc6"];
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "四路信号",
          aria: "Bus 中的四路信号",
          series: names.map((n, i) => ({ name: n, color: colors[i], width: 1.2, points: toPts(r.t, r.sigs[i]) })),
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: names[r.sel],
          aria: `Bus 选择 ${names[r.sel]}`,
          series: [{ name: names[r.sel], color: "#1f4e79", width: 2.0, points: toPts(r.t, r.sigs[r.sel]) }],
        });
        metrics([
          ["Bus 元素", "4 路"],
          ["选择", `#${r.sel} ${names[r.sel]}`],
          ["末值", r.sigs[r.sel][r.sigs[r.sel].length - 1].toFixed(3)],
        ]);
      },
    },

    motor: {
      title: "t13 · DC 电机",
      lesson: "t13",
      note: "电压→电流→转矩→转速：电气时间常数 ~0.5s、机械 ~0.1s。速度 PI 调 Kp/Ki；负载加大后靠积分拉回。",
      diagram: {
        aria: "直流电机：电压经电气与机械动态到转速",
        blocks: [
          { label: "电压 u" },
          { label: "电气 L/R", sub: "电流环" },
          { label: "机械 J/b", sub: "转速" },
          { label: "Scope" },
        ],
      },
      params: [
        { id: "kp", label: "速度环 Kp", min: 0.05, max: 2, step: 0.05, value: 0.5 },
        { id: "ki", label: "速度环 Ki", min: 0, max: 10, step: 0.1, value: 2 },
        { id: "load", label: "负载转矩", min: 0, max: 1, step: 0.05, value: 0.1 },
      ],
      render(p) {
        const r = S.motorDemo(p.kp, p.ki, p.load);
        const m = S.metrics(r.t, r.w, 50);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "转速 (rad/s)",
          yMin: 0,
          yMax: 60,
          aria: "直流电机转速",
          series: [{ name: "转速", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.w) }],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "电流 (A)",
          aria: "直流电机电流",
          series: [{ name: "电流", color: "#8a4a12", width: 1.2, points: toPts(r.t, r.cur) }],
        });
        metrics([
          ["超调", f2(m.overshoot) + "%"],
          ["调节时间", f2(m.settle) + "s"],
          ["稳态误差", m.ess.toFixed(2)],
          ["负载", p.load.toFixed(2)],
        ]);
      },
    },

    triggered: {
      title: "t37 · 触发子系统",
      lesson: "t37",
      note: "输入 1Hz 正弦；子系统只在触发沿执行一次，输出保持到下一次触发。改触发频率看阶梯疏密。",
      diagram: {
        aria: "触发子系统：正弦经触发采样保持输出",
        blocks: [{ label: "Sine 1Hz" }, { label: "Triggered", sub: "rising" }, { label: "Hold/Scope" }],
      },
      params: [{ id: "fs", label: "触发频率 (Hz)", min: 2, max: 50, step: 1, value: 20 }],
      render(p) {
        const r = S.triggeredDemo(p.fs);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "幅值",
          yMin: -1.3,
          yMax: 1.3,
          aria: "触发采样保持",
          series: [
            { name: "连续输入", color: "#b9b3a5", width: 1.4, points: toPts(r.t, r.y) },
            { name: "保持输出", color: "#1f4e79", width: 2.0, points: r.ts.map((t, i) => [t, r.z[i]]) },
          ],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["采样次数", String(r.samples)],
          ["保持周期", (1000 / p.fs).toFixed(0) + " ms"],
          ["触发频率", p.fs + " Hz"],
        ]);
      },
    },

    leadlag: {
      title: "t17 · 超前-滞后校正",
      lesson: "t17",
      note: "C(s)=(s+z)/(s+p)，对象 1/(s(s+1))。p>z 为超前：抬相位、增裕度；z>p 为滞后。看 Bode 与闭环阶跃。",
      diagram: {
        aria: "校正器串联对象，反馈到参考",
        blocks: [{ label: "Step" }, { label: "C(s)", sub: "(s+z)/(s+p)" }, { label: "1/(s(s+1))" }, { label: "Scope" }],
      },
      params: [
        { id: "z", label: "零点 z", min: 0.5, max: 10, step: 0.1, value: 2 },
        { id: "p", label: "极点 p", min: 1, max: 30, step: 0.5, value: 10 },
      ],
      render(p) {
        const r = S.leadlagDemo(p.z, p.p);
        const m = S.metrics(r.t, r.y, 1);
        plot($("chart-a"), {
          height: 250,
          logX: true,
          xLabel: "ω (rad/s)",
          yLabel: "开环幅值 (dB)",
          aria: "校正后开环 Bode 幅频",
          series: [{ name: "|L|", color: "#1f4e79", width: 1.6, points: r.w.map((w, i) => [w, r.mag[i]]) }],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "闭环输出",
          aria: "校正后闭环阶跃",
          series: [{ name: "y", color: "#2f6b4f", width: 1.8, points: toPts(r.t, r.y) }],
        });
        metrics([
          ["相位裕度", isFinite(r.pm) ? r.pm.toFixed(1) + "°" : "—"],
          ["超调", f2(m.overshoot) + "%"],
          ["调节时间", f2(m.settle) + "s"],
          ["p>z?", p.p > p.z ? "超前" : "滞后"],
        ]);
      },
    },

    sysid: {
      title: "t18 · 系统辨识",
      lesson: "t18",
      note: "对带噪阶跃响应，用终值估 K、63.2% 时间估 τ；虚线是拟合模型。噪声越大，参数越飘。",
      diagram: {
        aria: "阶跃输入未知对象，记录数据并拟合",
        blocks: [{ label: "Step" }, { label: "Unknown Plant" }, { label: "Log Data" }, { label: "Fit" }],
      },
      params: [
        { id: "noise", label: "测量噪声", min: 0, max: 0.3, step: 0.01, value: 0.05 },
        { id: "tau", label: "真实 τ (s)", min: 0.1, max: 1, step: 0.05, value: 0.4 },
      ],
      render(p) {
        const r = S.sysidDemo(p.noise, p.tau);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "输出 y",
          yMin: 0,
          yMax: 2.4,
          aria: "阶跃响应与拟合",
          series: [
            { name: "实测", color: "#b9b3a5", width: 1.2, points: toPts(r.t, r.data) },
            { name: "拟合", color: "#1f4e79", width: 1.6, dash: "5 4", points: toPts(r.t, r.fit) },
          ],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["K 估计", r.Kfit.toFixed(3)],
          ["τ 估计", r.tauFit.toFixed(2) + "s"],
          ["RMSE", r.rmse.toFixed(4)],
          ["真实 τ", p.tau.toFixed(2) + "s"],
        ]);
      },
    },

    mrac: {
      title: "t23 · MRAC 自适应",
      lesson: "t23",
      note: "参考模型给出理想响应；对象增益在 2s 从 1 变 2，MIT 规则按误差调 θ，约几秒恢复跟踪。γ 太大会振荡。",
      diagram: {
        aria: "MRAC：参考模型与对象误差驱动自适应律",
        blocks: [
          { label: "参考模型" },
          { label: "自适应律", sub: "γ" },
          { label: "Controller", sub: "θ" },
          { label: "Plant" },
        ],
      },
      params: [{ id: "gamma", label: "自适应增益 γ", min: 0.05, max: 2, step: 0.05, value: 0.5 }],
      render(p) {
        const r = S.mracDemo(p.gamma);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "输出",
          aria: "参考模型与对象输出",
          series: [
            { name: "参考模型", color: "#b9b3a5", width: 2.2, points: toPts(r.t, r.ym) },
            { name: "对象 y", color: "#1f4e79", width: 1.6, points: toPts(r.t, r.y) },
          ],
        });
        $("chart-b").innerHTML = "";
        const err = Math.abs(r.y[r.y.length - 1] - r.ym[r.ym.length - 1]);
        metrics([
          ["末值误差", err.toFixed(4)],
          ["θ 末值", r.theta[r.theta.length - 1].toFixed(3)],
          ["γ", p.gamma.toFixed(2)],
        ]);
      },
    },

    msdcompare: {
      title: "t29 · MSD：PID vs LQR",
      lesson: "t29",
      note: "同一质量-弹簧-阻尼对象：PID（固定参数）与离散 LQR（Q/R 可调）对比位置与控制量；LQR 带参考前馈。",
      diagram: {
        aria: "MSD 控制对比：PID 与 LQR 分别闭环",
        blocks: [{ label: "参考" }, { label: "PID / LQR" }, { label: "MSD" }, { label: "Scope" }],
      },
      params: [
        { id: "Q", label: "LQR Q（位置权重）", min: 1, max: 200, step: 1, value: 100 },
        { id: "R", label: "LQR R（控制权重）", min: 0.1, max: 10, step: 0.1, value: 1 },
      ],
      render(p) {
        const r = S.msdCompareDemo(p.Q, p.R);
        const mp = S.metrics(r.pid.t, r.pid.y, 1);
        const ml = S.metrics(r.lqr.t, r.lqr.y, 1);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "位置 x",
          yMin: 0,
          yMax: 1.6,
          aria: "PID 与 LQR 位置对比",
          series: [
            { name: "PID", color: "#b9b3a5", width: 2.2, points: toPts(r.pid.t, r.pid.y) },
            { name: "LQR", color: "#1f4e79", width: 1.6, points: toPts(r.lqr.t, r.lqr.y) },
          ],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "控制 u",
          aria: "PID 与 LQR 控制量",
          series: [
            { name: "PID u", color: "#b9b3a5", width: 1.4, points: toPts(r.pid.t, r.pid.u) },
            { name: "LQR u", color: "#2f6b4f", width: 1.4, points: toPts(r.lqr.t, r.lqr.u) },
          ],
        });
        metrics([
          ["PID 超调", f2(mp.overshoot) + "%"],
          ["LQR 超调", f2(ml.overshoot) + "%"],
          ["LQR K", `[${r.K[0].toFixed(1)}, ${r.K[1].toFixed(1)}]`],
          ["末值误差", `${mp.ess.toFixed(3)} / ${ml.ess.toFixed(3)}`],
        ]);
      },
    },

    suspension: {
      title: "t30 · 主动悬挂",
      lesson: "t30",
      note: "1/4 车两质量模型，5cm 路面阶跃。csky=0 为被动；增大天棚阻尼看车身加速度与轮胎动载的取舍。",
      diagram: {
        aria: "1/4 车：路面经轮胎、悬架到车身",
        blocks: [{ label: "路面 zr" }, { label: "轮胎 kt" }, { label: "悬架 ks/cs" }, { label: "车身 ms" }],
      },
      params: [{ id: "csky", label: "天棚阻尼 csky", min: 0, max: 5000, step: 100, value: 0 }],
      render(p) {
        const r = S.suspensionDemo(p.csky);
        let pa = 0,
          pl = 0;
        for (let i = 0; i < r.t.length; i++) {
          pa = Math.max(pa, Math.abs(r.acc[i]));
          pl = Math.max(pl, Math.abs(r.load[i]));
        }
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "车身加速度 (m/s²)",
          aria: "车身加速度",
          series: [{ name: "a_s", color: "#1f4e79", width: 1.4, points: toPts(r.t, r.acc) }],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "轮胎动载 (N)",
          aria: "轮胎动载",
          series: [{ name: "F_z", color: "#8a4a12", width: 1.4, points: toPts(r.t, r.load) }],
        });
        metrics([
          ["加速度峰值", pa.toFixed(2)],
          ["动载峰值", pl.toFixed(0) + " N"],
          ["模式", p.csky > 0 ? "主动" : "被动"],
          ["csky", String(p.csky)],
        ]);
      },
    },

    ekf: {
      title: "t31 · EKF",
      lesson: "t31",
      note: "Van der Pol 振子只测 x1，EKF 用 Jacobian 局部线性化；R 越大越信模型、估计更平滑但跟踪变慢。",
      diagram: {
        aria: "EKF：非线性对象与带噪观测",
        blocks: [
          { label: "Van der Pol" },
          { label: "测量 y=x1" },
          { label: "EKF", sub: "Jacobian" },
          { label: "Scope" },
        ],
      },
      params: [{ id: "R", label: "测量噪声 R", min: 0.001, max: 0.5, step: 0.001, value: 0.05 }],
      render(p) {
        const r = S.ekfDemo(p.R);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "x1",
          aria: "EKF 估计与真值",
          series: [
            { name: "真值", color: "#b9b3a5", width: 1.2, points: toPts(r.t, r.truth) },
            { name: "测量", color: "#d3ccba", width: 0.8, points: toPts(r.t, r.meas) },
            { name: "EKF", color: "#1f4e79", width: 1.6, points: toPts(r.t, r.est) },
          ],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["测量 RMSE", r.rmseMeas.toFixed(4)],
          ["EKF RMSE", r.rmseEst.toFixed(4)],
          ["R", p.R.toFixed(3)],
        ]);
      },
    },

    pendulum: {
      title: "t32 · 倒立摆 EKF",
      lesson: "t32",
      note: "倒立摆由 LQR/PD 稳定；只测角度（带噪），EKF 估角速度，初值故意偏 0.2rad。R 可调。",
      diagram: {
        aria: "倒立摆：控制器、EKF 与角度测量",
        blocks: [{ label: "θ 测量" }, { label: "EKF" }, { label: "Controller" }, { label: "Pendulum" }],
      },
      params: [{ id: "R", label: "测量噪声 R", min: 0.001, max: 0.5, step: 0.001, value: 0.05 }],
      render(p) {
        const r = S.pendulumEkfDemo(p.R);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "角度 θ (rad)",
          aria: "倒立摆角度估计",
          series: [
            { name: "真值", color: "#b9b3a5", width: 1.2, points: toPts(r.t, r.truth) },
            { name: "测量", color: "#d3ccba", width: 0.8, points: toPts(r.t, r.meas) },
            { name: "EKF", color: "#1f4e79", width: 1.6, points: toPts(r.t, r.est) },
          ],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["测量 RMSE", r.rmseMeas.toFixed(4)],
          ["EKF RMSE", r.rmseEst.toFixed(4)],
          ["R", p.R.toFixed(3)],
        ]);
      },
    },

    foc: {
      title: "t14 · PMSM / FOC",
      lesson: "t14",
      note: "id=0、iq 给转矩：反 Park 到 αβ、再反 Clarke 到三相。拖角度看三相电流与 dq 的对应关系。",
      diagram: {
        aria: "FOC：dq 电流经反 Park/Clarke 到三相",
        blocks: [{ label: "id=0, iq" }, { label: "反 Park" }, { label: "反 Clarke" }, { label: "PWM" }],
      },
      params: [
        { id: "iq", label: "iq (A)", min: 0, max: 5, step: 0.1, value: 2 },
        { id: "deg", label: "转子角 θ (°)", min: 0, max: 360, step: 5, value: 30 },
      ],
      render(p) {
        const r = S.focDemo(p.iq, p.deg);
        plot($("chart-a"), {
          height: 250,
          xLabel: "θ (°)",
          yLabel: "三相电流 (A)",
          yMin: -6,
          yMax: 6,
          aria: "三相电流随角度",
          series: [
            { name: "ia", color: "#1f4e79", width: 1.4, points: r.ang.map((d, i) => [d, r.A[i]]) },
            { name: "ib", color: "#2f6b4f", width: 1.4, points: r.ang.map((d, i) => [d, r.B[i]]) },
            { name: "ic", color: "#8a4a12", width: 1.4, points: r.ang.map((d, i) => [d, r.C[i]]) },
          ],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["θ 处 ia/ib/ic", `${r.ia.toFixed(2)} / ${r.ib.toFixed(2)} / ${r.ic.toFixed(2)}`],
          ["id / iq", `${r.id} / ${r.iq}`],
          ["三相和", (r.ia + r.ib + r.ic).toFixed(3)],
        ]);
      },
    },

    "first-order": {
      title: "t03 · 一阶系统",
      lesson: "t03",
      note: "G(s)=K/(τs+1)。τ 越小响应越快；63.2% 时间 = τ，2% 调节时间 ≈ 4τ（阶跃在 0.5 s）。",
      diagram: {
        aria: "一阶系统框图：阶跃输入经一阶传递函数到示波器",
        blocks: [{ label: "Step" }, { label: "K/(τs+1)", sub: "一阶惯性" }, { label: "Scope" }],
      },
      params: [
        { id: "tau", label: "时间常数 τ (s)", min: 0.1, max: 3, step: 0.05, value: 0.8 },
        { id: "K", label: "增益 K", min: 0.5, max: 2, step: 0.1, value: 1 },
      ],
      render(p) {
        const r = S.firstOrder(p.tau, p.K, 6);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "y(t)",
          yMin: 0,
          yMax: Math.max(1.1, p.K) * 1.15,
          aria: `一阶系统阶跃响应，τ=${p.tau}s，K=${p.K}`,
          series: [{ name: "输出 y", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["63.2% 时间", f2(0.5 + p.tau) + " s"],
          ["2% 调节时间", f2(0.5 + 4 * p.tau) + " s"],
          ["稳态值", f2(p.K)],
          ["转折频率 1/τ", f2(1 / p.tau) + " rad/s"],
        ]);
      },
    },

    "second-order": {
      title: "t04 · 二阶系统",
      lesson: "t04",
      note: "G(s)=ωn²/(s²+2ζωn s+ωn²)。ζ<1 时超调，超调量 ≈ exp(−πζ/√(1−ζ²))。",
      diagram: {
        aria: "二阶系统框图：阶跃输入经二阶传递函数到示波器",
        blocks: [{ label: "Step" }, { label: "ωn²/(s²+2ζωn s+ωn²)", sub: "二阶系统" }, { label: "Scope" }],
      },
      params: [
        { id: "wn", label: "固有频率 ωn (rad/s)", min: 1, max: 15, step: 0.5, value: 4 },
        { id: "zeta", label: "阻尼比 ζ", min: 0.05, max: 1.2, step: 0.05, value: 0.4 },
      ],
      render(p) {
        const r = S.secondOrder(p.wn, p.zeta, 6);
        const m = S.metrics(r.t, r.y, 1);
        const pl = S.poles(p.wn, p.zeta);
        plot($("chart-a"), {
          height: 260,
          xLabel: "时间 (s)",
          yLabel: "y(t)",
          yMin: 0,
          yMax: Math.max(1.1, maxOf(r.y)) * 1.12,
          aria: `二阶系统阶跃响应，ωn=${p.wn}，ζ=${p.zeta}`,
          series: [{ name: "输出 y", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        $("chart-b").innerHTML = "";
        metrics([
          ["超调量", f2(m.overshoot) + " %"],
          ["峰值时间", f2(m.tPeak) + " s"],
          ["2% 调节时间", f2(m.settle) + " s"],
          ["极点", `−${pl.re.toFixed(1)} ± j${pl.im.toFixed(1)}`],
        ]);
      },
    },

    "state-feedback": {
      title: "t10 · 状态反馈 / 极点配置",
      lesson: "t10",
      note: "双积分对象 1/s²，u = k1(r−x1) − k2x2，K=[ωn², 2ζωn] 把闭环极点放到 −ζωn ± jωn√(1−ζ²)（LQR + 参考前馈的特例）。",
      diagram: {
        aria: "状态反馈框图：参考经求和进入双积分对象，状态经 K 反馈",
        blocks: [{ label: "Step" }, { label: "Σ", sub: "+ −" }, { label: "1/s²", sub: "Plant" }, { label: "Scope" }],
        sumIndex: 1,
        feedback: "K = [ωn², 2ζωn]",
      },
      params: [
        { id: "wn", label: "闭环 ωn (rad/s)", min: 1, max: 12, step: 0.5, value: 4 },
        { id: "zeta", label: "闭环 ζ", min: 0.1, max: 1.2, step: 0.05, value: 0.7 },
      ],
      render(p) {
        const r = S.stateFeedback(p.wn, p.zeta, 6);
        const m = S.metrics(r.t, r.y, 1);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "位置 x1",
          yMin: 0,
          yMax: Math.max(1.1, maxOf(r.y)) * 1.12,
          aria: `状态反馈位置响应，ωn=${p.wn}，ζ=${p.zeta}`,
          series: [{ name: "x1", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "控制 u",
          aria: "状态反馈控制量",
          series: [{ name: "u", color: "#2f6b4f", width: 1.4, points: toPts(r.t, r.u) }],
        });
        metrics([
          ["K", `[${r.k[0].toFixed(1)}, ${r.k[1].toFixed(1)}]`],
          ["超调量", f2(m.overshoot) + " %"],
          ["2% 调节时间", f2(m.settle) + " s"],
          ["极点", `−${r.poles.re.toFixed(1)} ± j${r.poles.im.toFixed(1)}`],
        ]);
      },
    },

    observer: {
      title: "t11 · Luenberger 观测器",
      lesson: "t11",
      note: "只用 y=x1 估计 x̂；观测器增益 L=[2ζoωo, ωo²] 把 (A−LC) 极点放到 −ζoωo ± jωo√(1−ζo²)。噪声可开关。",
      diagram: {
        aria: "观测器框图：对象输出 y 进入观测器，估计状态用于反馈",
        blocks: [{ label: "Step" }, { label: "Σ", sub: "+ −" }, { label: "1/s²", sub: "Plant" }, { label: "Scope" }],
        sumIndex: 1,
        feedback: "x̂ (Luenberger Observer)",
      },
      params: [
        { id: "wn", label: "控制器 ωn", min: 1, max: 10, step: 0.5, value: 4 },
        { id: "zeta", label: "控制器 ζ", min: 0.3, max: 1.2, step: 0.05, value: 0.8 },
        { id: "wo", label: "观测器 ωo", min: 2, max: 20, step: 0.5, value: 10 },
        { id: "zetao", label: "观测器 ζo", min: 0.3, max: 1.2, step: 0.05, value: 0.9 },
        { id: "noise", label: "测量噪声 1%", type: "toggle", value: false },
      ],
      render(p) {
        const r = S.observer(p.wn, p.zeta, p.wo, p.zetao, p.noise);
        let maxErr = 0;
        for (let i = 0; i < r.t.length; i++) if (r.t[i] > 1 && r.err[i] > maxErr) maxErr = r.err[i];
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "位置 x1 / x̂1",
          yMin: 0,
          yMax: Math.max(1.1, maxOf(r.y)) * 1.12,
          aria: "真实状态与观测器估计对比",
          series: [
            { name: "真实 x1", color: "#b9b3a5", width: 2.8, points: toPts(r.t, r.y) },
            { name: "估计 x̂1", color: "#1f4e79", width: 1.4, points: toPts(r.t, r.est) },
          ],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "|x1 − x̂1|",
          aria: "观测误差",
          series: [{ name: "误差", color: "#8a4a12", width: 1.2, points: toPts(r.t, r.err) }],
        });
        metrics([
          ["L", `[${r.L[0].toFixed(1)}, ${r.L[1].toFixed(1)}]`],
          ["观测器极点", `−${r.poles.re.toFixed(1)} ± j${r.poles.im.toFixed(1)}`],
          ["t>1s 最大误差", maxErr.toFixed(4)],
          ["末值误差", r.err[r.err.length - 1].toFixed(5)],
        ]);
      },
    },

    smc: {
      title: "t21 · 滑模控制 SMC",
      lesson: "t21",
      note: "滑模面 s = ė + λe，u = −k·sat(s/φ)。φ 越小越接近 sign → 抖振更大；φ 越大越平滑但稳态误差变大。",
      diagram: {
        aria: "滑模控制框图：误差进入 SMC，控制双积分对象，状态反馈",
        blocks: [
          { label: "Step" },
          { label: "Σ", sub: "e" },
          { label: "SMC", sub: "sat(s/φ)" },
          { label: "1/s²", sub: "Plant" },
          { label: "Scope" },
        ],
        sumIndex: 1,
        feedback: "x",
      },
      params: [
        { id: "lambda", label: "滑模面 λ", min: 1, max: 12, step: 0.5, value: 4 },
        { id: "k", label: "切换增益 k", min: 2, max: 20, step: 0.5, value: 8 },
        { id: "phi", label: "边界层 φ", min: 0.01, max: 0.5, step: 0.01, value: 0.05 },
      ],
      render(p) {
        const r = S.smc(p.lambda, p.k, p.phi);
        let maxErr = 0;
        for (let i = 0; i < r.t.length; i++)
          if (r.t[i] > 1 && Math.abs(r.y[i] - 1) > maxErr) maxErr = Math.abs(r.y[i] - 1);
        plot($("chart-a"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "位置 x1",
          yMin: 0,
          yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: "滑模控制位置跟踪",
          series: [
            { name: "x1", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) },
            {
              name: "参考",
              color: "#b9b3a5",
              width: 1.2,
              dash: "5 4",
              points: [
                [0, 1],
                [6, 1],
              ],
            },
          ],
        });
        plot($("chart-b"), {
          height: 250,
          xLabel: "时间 (s)",
          yLabel: "控制 u",
          aria: "滑模控制量（抖振）",
          series: [{ name: "u", color: "#2f6b4f", width: 1.2, points: toPts(r.t, r.u) }],
        });
        metrics([
          ["t>1s 最大误差", maxErr.toFixed(4)],
          ["抖振指标 mean|Δu|", r.chattering.toFixed(3)],
          ["λ / k / φ", `${p.lambda} / ${p.k} / ${p.phi}`],
        ]);
      },
    },
  };
})();
