/* Control Play 扩展实验：状态反馈、观测器、根轨迹、离散化（复用 SimControl + chart.js） */
(function () {
  "use strict";
  const { plot } = window.IMUChart;
  const S = window.SimControl;
  const grid = document.getElementById("lab-grid");
  if (!grid || !S) return;
  const refreshes = [];
const LAB_EN = {
  "状态反馈 / 极点配置": "State feedback / pole placement",
  "双积分对象 u=k₁(r−x₁)−k₂x₂，K=[ωn², 2ζωn]；闭环极点 −ζωn ± jωn√(1−ζ²)。": "Double-integrator plant u=k₁(r−x₁)−k₂x₂, K=[ωn², 2ζωn]; closed-loop poles −ζωn ± jωn√(1−ζ²).",
  "时间 (s)": "Time (s)",
  "位置 x1": "Position x1",
  "控制 u": "Control u",
  "超调": "Overshoot",
  "调节": "Settling",
  "Luenberger 观测器": "Luenberger observer",
  "只测位置 y，估计 x̂；观测器极点由 L=[2ζoωo, ωo²] 决定，应比控制器快 2–5 倍。": "Only position y is measured; estimate x̂. Observer poles are set by L=[2ζoωo, ωo²] and should be 2–5× faster than the controller.",
  "观测器 ωo": "Observer ωo",
  "观测器 ζo": "Observer ζo",
  "测量噪声": "Measurement noise",
  "真实": "True",
  "估计": "Estimate",
  "误差": "Error",
  "t>1s 最大误差": "Max error after t>1s",
  "噪声": "Noise",
  "有": "yes",
  "无": "no",
  "根轨迹": "Root locus",
  "G(s)=1/(s(s+1)(s+2))。X=开环极点（0,−1,−2），实心点=当前闭环极点；蓝色虚线为 60° 渐近线，本系统无零点（无 O）。K 过 6 后进入右半平面。": "G(s)=1/(s(s+1)(s+2)). X=open-loop poles (0,−1,−2); filled dot=current closed-loop poles; blue dashed lines are the 60° asymptotes. This plant has no zeros (no O). For K above 6 the poles enter the right half-plane.",
  "开环增益 K": "Open-loop gain K",
  "y 轴 (x=0)": "y-axis (x=0)",
  "渐近线": "Asymptote",
  "开环极点 X": "Open-loop poles X",
  "当前闭环极点": "Current closed-loop poles",
  "零点 O": "Zeros O",
  "稳定性": "Stability",
  "稳定": "Stable",
  "不稳定": "Unstable",
  "当前极点": "Current poles",
  "最大实部": "Max real part",
  "零点": "Zeros",
  "离散化 / 采样周期": "Discretization / sample period",
  "数字 PID 每 Ts 更新一次并保持；Ts 越大，响应越偏离连续控制器，甚至失稳。": "The digital PID updates once per Ts and holds; larger Ts moves the response away from the continuous controller and can destabilize it.",
  "采样周期 Ts (s)": "Sample period Ts (s)",
  "输出 y": "Output y",
  "连续 PID": "Continuous PID",
  "离散 PID": "Discrete PID",
  "误差 (离散−连续)": "Error (discrete − continuous)",
  "采样数": "Samples",
  "RMSE 差异": "RMSE difference",
  "离散超调": "Discrete overshoot",
  "分支": "Branch"
};
  const tr = (x) => (window.VibeI18n && window.VibeI18n.lang === "en" ? (LAB_EN[x] || x) : x);


  const toPts = (t, y) => {
    const out = new Array(t.length);
    for (let i = 0; i < t.length; i++) out[i] = [t[i], y[i]];
    return out;
  };
  const maxOf = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const f2 = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

  function slider(label, min, max, step, value, onChange) {
    if (window.LabKit && window.LabKit.slider) return window.LabKit.slider(label, min, max, step, value, onChange);
    // 回退实现（离线/旧缓存）
    const wrap = document.createElement("div");
    wrap.className = "lab-ctl";
    const head = document.createElement("div");
    head.className = "lab-ctl-head";
    const name = document.createElement("span");
    name.textContent = label;
    const val = document.createElement("b");
    val.textContent = String(value);
    head.appendChild(name); head.appendChild(val);
    const input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => { val.textContent = String(input.value); onChange(parseFloat(input.value)); });
    wrap.appendChild(head); wrap.appendChild(input);
    return wrap;
  }

  function toggle(label, checked, onChange) {
    if (window.LabKit && window.LabKit.toggle) return window.LabKit.toggle(label, checked, onChange);
    const lab = document.createElement("label");
    lab.className = "lab-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    lab.appendChild(input);
    lab.appendChild(document.createTextNode(" " + label));
    return lab;
  }

  function metrics(el, rows) {
    if (window.LabKit) return window.LabKit.metrics(el, rows);
    el.innerHTML = rows.map(([k, v]) => `<span><i>${k}</i><b>${v}</b></span>`).join("");
  }

  function module(spec) {
    const card = document.createElement("article");
    card.className = "lab-module";
    card.id = spec.id;
    const h = document.createElement("h3");
    h.textContent = spec.title;
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = spec.note;
    const controls = document.createElement("div");
    controls.className = "lab-controls";
    const charts = document.createElement("div");
    charts.className = "lab-charts";
    const a = document.createElement("div");
    const b = document.createElement("div");
    a.id = spec.id + "-a";
    b.id = spec.id + "-b";
    charts.appendChild(a);
    charts.appendChild(b);
    const m = document.createElement("div");
    m.className = "lab-metrics";
    card.appendChild(h); card.appendChild(p); card.appendChild(controls);
    card.appendChild(charts); card.appendChild(m);
    grid.appendChild(card);

    const state = Object.assign({}, spec.defaults);
    const refresh = () => spec.render(state, a, b, m);
    refreshes.push(refresh);
    spec.controls(controls, state, refresh);
    refresh();
  }

  module({
    id: "lab-sf",
    title: tr("状态反馈 / 极点配置"),
    note: tr("双积分对象 u=k₁(r−x₁)−k₂x₂，K=[ωn², 2ζωn]；闭环极点 −ζωn ± jωn√(1−ζ²)。"),
    defaults: { wn: 4, zeta: 0.7 },
    controls(box, s, refresh) {
      box.appendChild(slider("ωn (rad/s)", 1, 12, 0.5, s.wn, (v) => { s.wn = v; refresh(); }));
      box.appendChild(slider("ζ", 0.1, 1.2, 0.05, s.zeta, (v) => { s.zeta = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.stateFeedback(s.wn, s.zeta, 8);
      const met = S.metrics(r.t, r.y, 1);
      plot(a, { height: 220, xLabel: tr("时间 (s)"), yLabel: tr("位置 x1"), yMin: 0, yMax: Math.max(1.1, maxOf(r.y)) * 1.1,
        series: [{ name: "x1", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }] });
      plot(b, { height: 220, xLabel: tr("时间 (s)"), yLabel: tr("控制 u"),
        series: [{ name: "u", color: "#2f6b4f", width: 1.2, points: toPts(r.t, r.u) }] });
      metrics(m, [["K", `[${r.k[0].toFixed(1)}, ${r.k[1].toFixed(1)}]`], [tr("超调"), f2(met.overshoot) + "%"], [tr("调节"), f2(met.settle) + "s"]]);
    },
  });

  module({
    id: "lab-ob",
    title: tr("Luenberger 观测器"),
    note: tr("只测位置 y，估计 x̂；观测器极点由 L=[2ζoωo, ωo²] 决定，应比控制器快 2–5 倍。"),
    defaults: { wo: 12, zetao: 0.9, noise: false },
    controls(box, s, refresh) {
      box.appendChild(slider(tr("观测器 ωo"), 2, 20, 0.5, s.wo, (v) => { s.wo = v; refresh(); }));
      box.appendChild(slider(tr("观测器 ζo"), 0.3, 1.2, 0.05, s.zetao, (v) => { s.zetao = v; refresh(); }));
      box.appendChild(toggle(tr("测量噪声"), s.noise, (v) => { s.noise = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.observer(4, 0.8, s.wo, s.zetao, s.noise);
      let maxErr = 0;
      for (let i = 0; i < r.err.length; i++) if (r.t[i] > 1 && r.err[i] > maxErr) maxErr = r.err[i];
      plot(a, { height: 220, xLabel: tr("时间 (s)"), yLabel: "x1 / x̂1", yMin: 0, yMax: Math.max(1.1, maxOf(r.y)) * 1.1,
        series: [
          { name: tr("真实"), color: "#b9b3a5", width: 2.6, points: toPts(r.t, r.y) },
          { name: tr("估计"), color: "#1f4e79", width: 1.3, points: toPts(r.t, r.est) },
        ] });
      plot(b, { height: 220, xLabel: tr("时间 (s)"), yLabel: tr("误差"),
        series: [{ name: "|x−x̂|", color: "#8a4a12", width: 1.2, points: toPts(r.t, r.err) }] });
      metrics(m, [["L", `[${r.L[0].toFixed(1)}, ${r.L[1].toFixed(1)}]`], [tr("t>1s 最大误差"), maxErr.toFixed(4)], [tr("噪声"), s.noise ? tr("有") : tr("无")]]);
    },
  });

  module({
    id: "lab-rl",
    title: tr("根轨迹"),
    note: tr("G(s)=1/(s(s+1)(s+2))。X=开环极点（0,−1,−2），实心点=当前闭环极点；蓝色虚线为 60° 渐近线，本系统无零点（无 O）。K 过 6 后进入右半平面。"),
    defaults: {
      K: (() => {
        const m = location.hash.match(/K=([0-9.]+)/);
        const v = m ? parseFloat(m[1]) : 1;
        return isFinite(v) && v > 0 ? v : 1;
      })(),
    },
    controls(box, s, refresh) {
      box.appendChild(slider(tr("开环增益 K"), 0.1, 50, 0.1, s.K, (v) => { s.K = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.rootLocusDemo(s.K);
      let mi = 0.1;
      r.branches.forEach((br) => br.forEach(([, im]) => { if (Math.abs(im) > mi) mi = Math.abs(im); }));
      const series = r.branches.map((br, i) => ({
        name: tr("分支") + (i + 1), color: ["#1f4e79", "#2f6b4f", "#8a4a12"][i], width: 1.4, legend: false, points: br,
      }));
      r.highlight.forEach((br, i) => {
        if (br.length > 1) {
          series.push({
            name: "K∈[20,50]", color: "#b5651d", width: 3.0, legend: i === 0, points: br,
          });
        }
      });
      series.push({
        name: tr("y 轴 (x=0)"), color: "#1b1d22", width: 1.3, legend: true,
        points: [[0, -4.5], [0, 4.5]],
      });
      [60, 180, 300].forEach((deg) => {
        const rad = (deg * Math.PI) / 180;
        series.push({
          name: tr("渐近线"), color: "#7a9cc6", width: 1, dash: "6 5", legend: false,
          points: [[-1, 0], [-1 + 8 * Math.cos(rad), 8 * Math.sin(rad)]],
        });
      });
      series.push({
        name: tr("开环极点 X"), color: "#5b564c", marker: "x", line: false, legend: true,
        points: r.openPoles.map((p) => [p, 0]),
      });
      series.push({
        name: tr("当前闭环极点"), color: "#1f4e79", marker: "dot", line: false, legend: true,
        points: r.current.map((p) => [p.re, p.im]),
      });
      if (r.zeros.length) {
        series.push({ name: tr("零点 O"), color: "#2f6b4f", marker: "o", line: false, legend: true, points: r.zeros.map((p) => [p, 0]) });
      }
      plot(a, {
        height: 240, xLabel: "Re", yLabel: "Im",
        xMin: -5.5, xMax: 1.5, yMin: -4.5, yMax: 4.5,
        series,
      });
      b.innerHTML = "";
      const poles = r.current.map((q) => `${q.re.toFixed(2)}${q.im >= 0 ? "+" : ""}${q.im.toFixed(2)}j`).join("  ");
      metrics(m, [[tr("稳定性"), r.stable ? tr("稳定") : tr("不稳定")], [tr("当前极点"), poles], [tr("最大实部"), r.maxRe.toFixed(3)], [tr("零点"), tr("无")]]);
    },
  });

  module({
    id: "lab-dt",
    title: tr("离散化 / 采样周期"),
    note: tr("数字 PID 每 Ts 更新一次并保持；Ts 越大，响应越偏离连续控制器，甚至失稳。"),
    defaults: { Ts: 0.02 },
    controls(box, s, refresh) {
      box.appendChild(slider(tr("采样周期 Ts (s)"), 0.002, 0.2, 0.002, s.Ts, (v) => { s.Ts = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.discreteDemo(s.Ts);
      let se = 0;
      for (let i = 0; i < r.t.length; i++) se += Math.pow(r.yc[i] - r.yd[i], 2);
      const rmse = Math.sqrt(se / r.t.length);
      const met = S.metrics(r.t, r.yd, 1);
      plot(a, { height: 220, xLabel: tr("时间 (s)"), yLabel: tr("输出 y"), yMin: 0, yMax: Math.max(1.2, maxOf(r.yd)) * 1.1,
        series: [
          { name: tr("连续 PID"), color: "#b9b3a5", width: 2.4, points: toPts(r.t, r.yc) },
          { name: tr("离散 PID"), color: "#1f4e79", width: 1.4, points: toPts(r.t, r.yd) },
        ] });
      plot(b, { height: 220, xLabel: tr("时间 (s)"), yLabel: tr("误差 (离散−连续)"),
        series: [{ name: "Δy", color: "#8a4a12", width: 1.2, points: toPts(r.t, Float64Array.from(r.t, (_, i) => r.yd[i] - r.yc[i])) }] });
      metrics(m, [[tr("采样数"), String(r.samples)], [tr("RMSE 差异"), rmse.toFixed(4)], [tr("离散超调"), f2(met.overshoot) + "%"]]);
    },
  });

  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => refreshes.forEach((fn) => fn()), 120);
  });
})();
