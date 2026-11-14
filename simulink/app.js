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

  const DEMOS = {
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
    return v.toFixed(2);
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
    Object.keys(DEMOS).forEach((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.demo = id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === current));
      b.textContent = DEMOS[id].title.split(" · ")[1];
      b.addEventListener("click", () => selectDemo(id));
      box.appendChild(b);
    });
  }

  function buildCatalog() {
    const box = $("catalog");
    DATA.phases.forEach((ph) => {
      const h = document.createElement("div");
      h.className = "phase-title";
      h.textContent = ph.title;
      box.appendChild(h);
      ph.items.forEach((l) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "lesson";
        b.dataset.text = (l.id + " " + l.title + " " + l.desc).toLowerCase();
        b.title = l.desc;
        b.innerHTML = `<span class="n">${l.id}</span>${l.title}` + (l.demo ? '<span class="tag">交互</span>' : "");
        b.addEventListener("click", () => {
          if (l.demo) {
            selectDemo(l.demo);
            $("demo-title").scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            location.href = `course.html?id=${l.id}`;
          }
        });
        box.appendChild(b);
      });
    });
  }

  $("search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".lesson").forEach((b) => {
      b.classList.toggle("dim", q && !b.dataset.text.includes(q));
    });
  });

  buildCatalog();
  buildTabs();
  selectDemo("first-order");
  window.addEventListener("resize", () => {
    clearTimeout(window.__simT);
    window.__simT = setTimeout(() => { diagram(DEMOS[current].diagram); refresh(); }, 120);
  });
})();
