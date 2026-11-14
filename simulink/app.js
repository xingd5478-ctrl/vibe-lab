/* Simulink 教程页：目录 + 5 个交互复现（chart.js + SimControl） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { plot } = window.IMUChart;
  const S = window.SimControl;
  const DATA = window.SIMULINK_LESSONS;
  const REPO = DATA.repo;

  const lessonById = {};
  DATA.phases.forEach((ph) => ph.items.forEach((l) => { lessonById[l.id] = l; }));

  const toPts = (t, y) => {
    const out = new Array(t.length);
    for (let i = 0; i < t.length; i++) out[i] = [t[i], y[i]];
    return out;
  };
  const maxOf = (arr) => arr.reduce((m, v) => (v > m ? v : m), -Infinity);
  const minOf = (arr) => arr.reduce((m, v) => (v < m ? v : m), Infinity);
  const f2 = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

  function metrics(list) {
    $("metrics").innerHTML = list
      .map(([k, v]) => `<div class="metric"><span>${k}</span><b>${v}</b></div>`)
      .join("");
  }

  function links(id) {
    const l = lessonById[id];
    if (!l) { $("links").innerHTML = ""; return; }
    $("links").innerHTML =
      `<a href="${REPO}/blob/main/${l.file}" target="_blank" rel="noreferrer">第 ${l.n} 课 · ${l.file}</a>` +
      `<a href="models/${l.model}" download>下载 ${l.model}（本站）</a>` +
      `<a href="${REPO}" target="_blank" rel="noreferrer">教程仓库</a>`;
  }

  function diagram(spec) {
    const el = $("diagram");
    const n = spec.blocks.length;
    const w = Math.max(el.clientWidth || 640, 420);
    const h = spec.feedback ? 170 : 120;
    const bw = Math.max(84, Math.min(150, (w - 40 - (n - 1) * 34) / n));
    const gap = 34, y = 26, bh = 52;
    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${spec.aria || "Simulink 框图"}">
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#1b1d22"/></marker>
        <marker id="ah2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#2f6b4f"/></marker>
      </defs>`;
    spec.blocks.forEach((b, i) => {
      const x = 20 + i * (bw + gap);
      const isSum = b.label === "Σ";
      svg += `<rect class="blk${isSum ? " blk-sum" : ""}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3"/>`;
      svg += `<text class="blk-label" x="${x + bw / 2}" y="${y + (b.sub ? 21 : 30)}" text-anchor="middle">${b.label}</text>`;
      if (b.sub) svg += `<text class="blk-sub" x="${x + bw / 2}" y="${y + 37}" text-anchor="middle">${b.sub}</text>`;
      if (i < n - 1) {
        svg += `<line class="arrow" x1="${x + bw}" y1="${y + bh / 2}" x2="${x + bw + gap - 3}" y2="${y + bh / 2}"/>`;
      }
    });
    if (spec.feedback) {
      const lastX = 20 + (n - 1) * (bw + gap) + bw / 2;
      const firstX = 20 + spec.sumIndex * (bw + gap) + bw / 2;
      const yb = y + bh, yf = h - 16;
      svg += `<path class="fb" d="M${lastX},${yb} V${yf} H${firstX} V${yb + 2}" marker-end="url(#ah2)"/>`;
      svg += `<text class="fb-label" x="${(lastX + firstX) / 2}" y="${yf - 6}" text-anchor="middle">${spec.feedback}</text>`;
    }
    svg += "</svg>";
    el.innerHTML = svg;
  }

  function renderArm(el, a) {
    const W = Math.max(el.clientWidth || 640, 320), H = 300;
    const scale = Math.min((W * 0.55) / a.maxReach, (H * 0.72) / a.maxReach);
    const ox = W * 0.2, oy = H * 0.8;
    const x1 = ox + a.l1 * Math.cos(a.th1) * scale;
    const y1 = oy - a.l1 * Math.sin(a.th1) * scale;
    const x2 = x1 + a.l2 * Math.cos(a.th1 + a.th2) * scale;
    const y2 = y1 - a.l2 * Math.sin(a.th1 + a.th2) * scale;
    const tx = ox + a.ex * scale, ty = oy - a.ey * scale;
    el.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="两连杆机械臂，末端 ${a.ex.toFixed(2)},${a.ey.toFixed(2)}">
        <line x1="0" y1="${oy}" x2="${W}" y2="${oy}" stroke="#e7e3d8"/>
        <line x1="${ox}" y1="0" x2="${ox}" y2="${H}" stroke="#e7e3d8"/>
        <circle cx="${ox}" cy="${oy}" r="7" fill="#1b1d22"/>
        <line x1="${ox}" y1="${oy}" x2="${x1}" y2="${y1}" stroke="#1f4e79" stroke-width="7" stroke-linecap="round"/>
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2f6b4f" stroke-width="7" stroke-linecap="round"/>
        <circle cx="${x1}" cy="${y1}" r="6" fill="#fff" stroke="#1f4e79" stroke-width="2"/>
        <circle cx="${x2}" cy="${y2}" r="8" fill="${a.reachable ? "#1f4e79" : "#8a4a12"}"/>
        <line x1="${tx - 7}" y1="${ty}" x2="${tx + 7}" y2="${ty}" stroke="#8a4a12" stroke-width="1.5"/>
        <line x1="${tx}" y1="${ty - 7}" x2="${tx}" y2="${ty + 7}" stroke="#8a4a12" stroke-width="1.5"/>
        <text x="${ox + 8}" y="${oy - 8}" font-size="11" fill="#5b564c" font-family="Consolas">base</text>
      </svg>`;
  }

  const sfState = { state: 0, log: [[0, 0]], lastCmd: 0 };

  const DEMOS = {
    stateflow: {
      title: "t36 · Stateflow 状态机",
      lesson: "t36",
      note: "状态机只认「状态 + 事件」：启动→Running，故障→Fault 锁存，必须复位才回 Idle。点按钮看状态迁移。",
      diagram: {
        aria: "状态机：事件进入 Stateflow，输出状态",
        blocks: [{ label: "事件" }, { label: "Stateflow", sub: "Idle/Run/Fault" }, { label: "状态输出" }],
      },
      params: [{
        id: "cmd", label: "事件", type: "buttons", value: 0,
        options: [{ label: "启动", value: 1 }, { label: "停止", value: 0 }, { label: "故障", value: 2 }, { label: "复位", value: 3 }],
      }],
      render(p) {
        if (p.cmd !== sfState.lastCmd) {
          const ns = S.nextState(sfState.state, p.cmd);
          sfState.state = ns;
          sfState.log.push([sfState.log.length, ns]);
          sfState.lastCmd = p.cmd;
        }
        const pts = [];
        sfState.log.forEach(([i, s]) => { pts.push([i, s]); pts.push([i + 0.9, s]); });
        plot($("chart-a"), {
          height: 250, xLabel: "事件序号", yLabel: "状态 (0=Idle, 1=Run, 2=Fault)",
          yMin: -0.3, yMax: 2.4,
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
      params: [{
        id: "mode", label: "变体", type: "buttons", value: 1,
        options: [{ label: "开环", value: 0 }, { label: "PID", value: 1 }, { label: "状态反馈", value: 2 }],
      }],
      render(p) {
        const r = S.variantDemo(p.mode);
        const m = S.metrics(r.t, r.y, 1);
        plot($("chart-a"), {
          height: 250, xLabel: "时间 (s)", yLabel: "输出 y",
          yMin: 0, yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: `变体 ${r.label} 的阶跃响应`,
          series: [{ name: r.label, color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "控制 u",
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
          height: 260, xLabel: "时间 (s)", yLabel: "u(t) / y(t)",
          yMin: -3.6, yMax: 3.6,
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
        blocks: [{ label: "Step" }, { label: "Σ", sub: "+ −" }, { label: "PID" }, { label: "Plant", sub: "二阶对象" }, { label: "Scope" }],
        sumIndex: 1, feedback: "输出 y",
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
          height: 250, xLabel: "时间 (s)", yLabel: "输出 y",
          yMin: 0, yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: `PID 阶跃响应，Kp=${p.kp}，Ki=${p.ki}，Kd=${p.kd}`,
          series: [{ name: "y", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "控制 u",
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
        blocks: [{ label: "真值 1" }, { label: "测量 z", sub: "+噪声" }, { label: "Kalman", sub: "K=P/(P+R)" }, { label: "Scope" }],
      },
      params: [
        { id: "R", label: "测量噪声 R", min: 0.01, max: 1, step: 0.01, value: 0.1 },
        { id: "Q", label: "过程噪声 Q", min: 0.001, max: 0.1, step: 0.001, value: 0.005 },
      ],
      render(p) {
        const r = S.kalmanDemo(p.R, p.Q);
        plot($("chart-a"), {
          height: 250, xLabel: "时间 (s)", yLabel: "真值 / 测量 / 估计",
          yMin: 0.4, yMax: 1.6,
          aria: `卡尔曼估计，R=${p.R}，Q=${p.Q}`,
          series: [
            { name: "测量 z", color: "#d3ccba", width: 1.0, points: toPts(r.t, r.z) },
            { name: "估计 x̂", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.x) },
          ],
        });
        const e1 = new Float64Array(r.t.length), e2 = new Float64Array(r.t.length);
        for (let i = 0; i < r.t.length; i++) { e1[i] = r.z[i] - 1; e2[i] = r.x[i] - 1; }
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "误差",
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
          height: 250, logX: true, xLabel: "ω (rad/s)", yLabel: "幅值 (dB)",
          aria: `二阶系统 Bode 幅频，ωn=${p.wn}，ζ=${p.zeta}`,
          series: [{ name: "|G|", color: "#1f4e79", width: 1.8, points: b.w.map((w, i) => [w, b.mag[i]]) }],
        });
        plot($("chart-b"), {
          height: 250, logX: true, xLabel: "ω (rad/s)", yLabel: "相位 (°)",
          yMin: -190, yMax: 5,
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
        sumIndex: 0, feedback: "状态反馈",
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
          height: 250, xLabel: "时间 (s)", yLabel: "输出 x",
          yMin: 0, yMax: Math.max(1.2, maxOf(r.x)) * 1.1,
          aria: `MPC 跟踪，N=${p.N}，uMax=${p.uMax}`,
          series: [
            { name: "x", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.x) },
            { name: "参考", color: "#b9b3a5", width: 1.2, dash: "5 4", points: [[0, 0], [1, 0], [1, 1], [8, 1]] },
          ],
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "控制 u",
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
      note: "G(s)=1/(s(s+1)(s+2))。X=开环极点（0,−1,−2），实心点=当前闭环极点；本系统无零点，所以没有 O。K 过 6 后极点进入右半平面。",
      diagram: {
        aria: "根轨迹：增益 K 与开环 G(s) 的闭环极点",
        blocks: [{ label: "K" }, { label: "G(s)", sub: "1/(s(s+1)(s+2))" }, { label: "rlocus" }],
      },
      params: [{ id: "K", label: "开环增益 K", min: 0.1, max: 50, step: 0.1, value: 1 }],
      render(p) {
        const b = S.rootLocusDemo(p.K);
        let maxIm = 0.1;
        b.branches.forEach((br) => br.forEach(([, im]) => { if (Math.abs(im) > maxIm) maxIm = Math.abs(im); }));
        const series = b.branches.map((br, i) => ({
          name: `分支 ${i + 1}`, color: i === 0 ? "#1f4e79" : i === 1 ? "#2f6b4f" : "#8a4a12",
          width: 1.4, legend: false, points: br,
        }));
        series.push({ name: "虚轴", color: "#b9b3a5", width: 1, dash: "4 4", legend: false, points: [[0, -maxIm * 1.25], [0, maxIm * 1.25]] });
        series.push({ name: "开环极点 X", color: "#5b564c", marker: "x", line: false, points: b.openPoles.map((p) => [p, 0]) });
        series.push({ name: "当前闭环极点", color: "#1f4e79", marker: "dot", line: false, points: b.current.map((p) => [p.re, p.im]) });
        if (b.zeros.length) {
          series.push({ name: "零点 O", color: "#2f6b4f", marker: "o", line: false, points: b.zeros.map((p) => [p, 0]) });
        }
        plot($("chart-a"), {
          height: 270, xLabel: "Re", yLabel: "Im", equalAspect: true,
          yMin: -maxIm * 1.25, yMax: maxIm * 1.25,
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
          height: 250, xLabel: "时间 (s)", yLabel: "输出 y",
          yMin: 0, yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: `模糊控制响应，尺度=${p.scale}`,
          series: [{ name: "y", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "控制 u",
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
        blocks: [{ label: "Force" }, { label: "m", sub: "质量" }, { label: "k / c", sub: "弹簧/阻尼" }, { label: "Scope" }],
      },
      params: [
        { id: "k", label: "刚度 k (N/m)", min: 1, max: 20, step: 0.5, value: 5 },
        { id: "c", label: "阻尼 c (N·s/m)", min: 0.1, max: 5, step: 0.1, value: 1 },
      ],
      render(p) {
        const r = S.msdDemo(p.k, p.c);
        const m = S.metrics(r.t, r.x, 1 / p.k);
        plot($("chart-a"), {
          height: 250, xLabel: "时间 (s)", yLabel: "位移 x",
          yMin: 0, yMax: Math.max(1 / p.k, maxOf(r.x)) * 1.2,
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
          height: 250, xLabel: "时间 (s)", yLabel: "幅值",
          yMin: -1.3, yMax: 1.3,
          aria: `采样演示，f=${p.f}，fs=${p.fs}`,
          series: [
            { name: "真实正弦", color: "#b9b3a5", width: 1.4, points: toPts(r.t, r.y) },
            { name: "采样点连线", color: "#1f4e79", width: 1.6, points: toPts(r.ts, r.z) },
          ],
        });
        const ya = new Float64Array(r.t.length);
        for (let i = 0; i < r.t.length; i++) ya[i] = Math.sin(2 * Math.PI * r.alias * r.t[i]);
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "真实 / 混叠重建",
          yMin: -1.3, yMax: 1.3,
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
        blocks: [{ label: "Gyro", sub: "积分" }, { label: "互补滤波", sub: "α" }, { label: "Accel", sub: "倾角" }, { label: "Scope" }],
      },
      params: [
        { id: "alpha", label: "互补系数 α", min: 0.8, max: 0.99, step: 0.01, value: 0.95 },
        { id: "noise", label: "加入噪声/漂移", type: "toggle", value: true },
      ],
      render(p) {
        const r = S.imuFusionDemo(p.alpha, p.noise);
        plot($("chart-a"), {
          height: 250, xLabel: "时间 (s)", yLabel: "倾角 (°)",
          aria: `IMU 融合，α=${p.alpha}`,
          series: [
            { name: "真值", color: "#b9b3a5", width: 1.2, points: toPts(r.t, r.truth) },
            { name: "加速度计", color: "#8a4a12", width: 0.9, points: toPts(r.t, r.acc) },
            { name: "互补输出", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.comp) },
          ],
        });
        const e1 = new Float64Array(r.t.length), e2 = new Float64Array(r.t.length);
        for (let i = 0; i < r.t.length; i++) { e1[i] = r.acc[i] - r.truth[i]; e2[i] = r.comp[i] - r.truth[i]; }
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "误差 (°)",
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
          height: 250, xLabel: "时间 (s)", yLabel: "四路信号",
          aria: "Bus 中的四路信号",
          series: names.map((n, i) => ({ name: n, color: colors[i], width: 1.2, points: toPts(r.t, r.sigs[i]) })),
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: names[r.sel],
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
          height: 260, xLabel: "时间 (s)", yLabel: "y(t)",
          yMin: 0, yMax: Math.max(1.1, p.K) * 1.15,
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
          height: 260, xLabel: "时间 (s)", yLabel: "y(t)",
          yMin: 0, yMax: Math.max(1.1, maxOf(r.y)) * 1.12,
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
        sumIndex: 1, feedback: "K = [ωn², 2ζωn]",
      },
      params: [
        { id: "wn", label: "闭环 ωn (rad/s)", min: 1, max: 12, step: 0.5, value: 4 },
        { id: "zeta", label: "闭环 ζ", min: 0.1, max: 1.2, step: 0.05, value: 0.7 },
      ],
      render(p) {
        const r = S.stateFeedback(p.wn, p.zeta, 6);
        const m = S.metrics(r.t, r.y, 1);
        plot($("chart-a"), {
          height: 250, xLabel: "时间 (s)", yLabel: "位置 x1",
          yMin: 0, yMax: Math.max(1.1, maxOf(r.y)) * 1.12,
          aria: `状态反馈位置响应，ωn=${p.wn}，ζ=${p.zeta}`,
          series: [{ name: "x1", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }],
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "控制 u",
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
        sumIndex: 1, feedback: "x̂ (Luenberger Observer)",
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
          height: 250, xLabel: "时间 (s)", yLabel: "位置 x1 / x̂1",
          yMin: 0, yMax: Math.max(1.1, maxOf(r.y)) * 1.12,
          aria: "真实状态与观测器估计对比",
          series: [
            { name: "真实 x1", color: "#b9b3a5", width: 2.8, points: toPts(r.t, r.y) },
            { name: "估计 x̂1", color: "#1f4e79", width: 1.4, points: toPts(r.t, r.est) },
          ],
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "|x1 − x̂1|",
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
        blocks: [{ label: "Step" }, { label: "Σ", sub: "e" }, { label: "SMC", sub: "sat(s/φ)" }, { label: "1/s²", sub: "Plant" }, { label: "Scope" }],
        sumIndex: 1, feedback: "x",
      },
      params: [
        { id: "lambda", label: "滑模面 λ", min: 1, max: 12, step: 0.5, value: 4 },
        { id: "k", label: "切换增益 k", min: 2, max: 20, step: 0.5, value: 8 },
        { id: "phi", label: "边界层 φ", min: 0.01, max: 0.5, step: 0.01, value: 0.05 },
      ],
      render(p) {
        const r = S.smc(p.lambda, p.k, p.phi);
        let maxErr = 0;
        for (let i = 0; i < r.t.length; i++) if (r.t[i] > 1 && Math.abs(r.y[i] - 1) > maxErr) maxErr = Math.abs(r.y[i] - 1);
        plot($("chart-a"), {
          height: 250, xLabel: "时间 (s)", yLabel: "位置 x1",
          yMin: 0, yMax: Math.max(1.2, maxOf(r.y)) * 1.1,
          aria: "滑模控制位置跟踪",
          series: [
            { name: "x1", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) },
            { name: "参考", color: "#b9b3a5", width: 1.2, dash: "5 4", points: [[0, 1], [6, 1]] },
          ],
        });
        plot($("chart-b"), {
          height: 250, xLabel: "时间 (s)", yLabel: "控制 u",
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

  let current = "first-order";

  function fmtVal(v) {
    const a = Math.abs(v);
    if (a >= 10) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    if (a >= 0.01) return v.toFixed(2);
    return v.toFixed(3);
  }

  function buildControls(params, onChange) {
    const box = $("controls");
    box.innerHTML = "";
    params.forEach((d) => {
      if (d.type === "toggle") {
        const lab = document.createElement("label");
        lab.className = "ctl toggle";
        lab.innerHTML = `<input type="checkbox" id="p-${d.id}" ${d.value ? "checked" : ""}> ${d.label}`;
        box.appendChild(lab);
        lab.querySelector("input").addEventListener("change", onChange);
        return;
      }
      if (d.type === "buttons") {
        const div = document.createElement("div");
        div.className = "ctl buttons";
        const head = document.createElement("div");
        head.className = "ctl-head";
        const label = document.createElement("span");
        label.textContent = d.label || "";
        head.appendChild(label);
        div.appendChild(head);
        const row = document.createElement("div");
        row.className = "btn-row";
        d.options.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = o.label;
          if (d.value === o.value) b.setAttribute("aria-pressed", "true");
          b.addEventListener("click", () => {
            d.value = o.value;
            row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            onChange();
          });
          row.appendChild(b);
        });
        div.appendChild(row);
        box.appendChild(div);
        return;
      }
      const div = document.createElement("div");
      div.className = "ctl";
      div.innerHTML =
        `<div class="ctl-head"><span>${d.label}</span><b id="v-${d.id}">${fmtVal(d.value)}</b></div>` +
        `<input type="range" id="p-${d.id}" min="${d.min}" max="${d.max}" step="${d.step}" value="${d.value}" aria-label="${d.label}">`;
      box.appendChild(div);
      div.querySelector("input").addEventListener("input", onChange);
    });
  }

  function readParams(params) {
    const p = {};
    params.forEach((d) => {
      if (d.type === "buttons") { p[d.id] = d.value; return; }
      const el = $("p-" + d.id);
      p[d.id] = d.type === "toggle" ? el.checked : parseFloat(el.value);
    });
    return p;
  }

  function refresh() {
    const demo = DEMOS[current];
    const p = readParams(demo.params);
    demo.params.forEach((d) => {
      const v = $("v-" + d.id);
      if (v) v.textContent = fmtVal(p[d.id]);
    });
    demo.render(p);
    links(demo.lesson);
  }

  function selectDemo(id) {
    current = id;
    const demo = DEMOS[id];
    $("demo-title").textContent = demo.title;
    $("demo-note").innerHTML = demo.note;
    document.querySelectorAll("#tabs button").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.demo === id));
    });
    diagram(demo.diagram);
    buildControls(demo.params, refresh);
    refresh();
  }

  function buildTabs() {
    const box = $("tabs");
    const order = Object.keys(DEMOS).sort((a, b) =>
      parseInt(DEMOS[a].lesson.slice(1), 10) - parseInt(DEMOS[b].lesson.slice(1), 10));
    order.forEach((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.demo = id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === current));
      b.textContent = `${DEMOS[id].lesson.toUpperCase()} · ${DEMOS[id].title.split(" · ")[1]}`;
      b.addEventListener("click", () => selectDemo(id));
      box.appendChild(b);
    });
  }

  function buildPhases() {
    const box = $("phases");
    if (!box) return;
    DATA.phases.forEach((ph) => {
      const b = document.createElement("a");
      b.className = "phase-link";
      b.href = `course.html?id=${ph.items[0].id}`;
      b.innerHTML = `<b>${ph.title}</b><span>${ph.items.length} 课 · ${ph.range}</span>`;
      box.appendChild(b);
    });
  }

  buildPhases();
  buildTabs();
  const hash = location.hash.replace(/^#/, "");
  const byLesson = Object.keys(DEMOS).find((id) => DEMOS[id].lesson === hash);
  selectDemo(byLesson || (DEMOS[hash] ? hash : "signal"));
  window.addEventListener("resize", () => {
    clearTimeout(window.__simT);
    window.__simT = setTimeout(() => { diagram(DEMOS[current].diagram); refresh(); }, 120);
  });
})();
