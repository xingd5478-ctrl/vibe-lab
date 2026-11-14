/* Control Play 扩展实验：状态反馈、观测器、根轨迹、离散化（复用 SimControl + chart.js） */
(function () {
  "use strict";
  const { plot } = window.IMUChart;
  const S = window.SimControl;
  const grid = document.getElementById("lab-grid");
  if (!grid || !S) return;

  const toPts = (t, y) => {
    const out = new Array(t.length);
    for (let i = 0; i < t.length; i++) out[i] = [t[i], y[i]];
    return out;
  };
  const maxOf = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const f2 = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

  function slider(label, min, max, step, value, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "lab-ctl";
    const head = document.createElement("div");
    head.className = "lab-ctl-head";
    const name = document.createElement("span");
    name.textContent = label;
    const val = document.createElement("b");
    val.textContent = String(value);
    head.appendChild(name);
    head.appendChild(val);
    const input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => {
      val.textContent = String(input.value);
      onChange(parseFloat(input.value));
    });
    wrap.appendChild(head);
    wrap.appendChild(input);
    return wrap;
  }

  function toggle(label, checked, onChange) {
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
    spec.controls(controls, state, refresh);
    refresh();
  }

  module({
    id: "lab-sf",
    title: "状态反馈 / 极点配置",
    note: "双积分对象 u=k₁(r−x₁)−k₂x₂，K=[ωn², 2ζωn]；闭环极点 −ζωn ± jωn√(1−ζ²)。",
    defaults: { wn: 4, zeta: 0.7 },
    controls(box, s, refresh) {
      box.appendChild(slider("ωn (rad/s)", 1, 12, 0.5, s.wn, (v) => { s.wn = v; refresh(); }));
      box.appendChild(slider("ζ", 0.1, 1.2, 0.05, s.zeta, (v) => { s.zeta = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.stateFeedback(s.wn, s.zeta, 8);
      const met = S.metrics(r.t, r.y, 1);
      plot(a, { height: 220, xLabel: "时间 (s)", yLabel: "位置 x1", yMin: 0, yMax: Math.max(1.1, maxOf(r.y)) * 1.1,
        series: [{ name: "x1", color: "#1f4e79", width: 1.8, points: toPts(r.t, r.y) }] });
      plot(b, { height: 220, xLabel: "时间 (s)", yLabel: "控制 u",
        series: [{ name: "u", color: "#2f6b4f", width: 1.2, points: toPts(r.t, r.u) }] });
      metrics(m, [["K", `[${r.k[0].toFixed(1)}, ${r.k[1].toFixed(1)}]`], ["超调", f2(met.overshoot) + "%"], ["调节", f2(met.settle) + "s"]]);
    },
  });

  module({
    id: "lab-ob",
    title: "Luenberger 观测器",
    note: "只测位置 y，估计 x̂；观测器极点由 L=[2ζoωo, ωo²] 决定，应比控制器快 2–5 倍。",
    defaults: { wo: 12, zetao: 0.9, noise: false },
    controls(box, s, refresh) {
      box.appendChild(slider("观测器 ωo", 2, 20, 0.5, s.wo, (v) => { s.wo = v; refresh(); }));
      box.appendChild(slider("观测器 ζo", 0.3, 1.2, 0.05, s.zetao, (v) => { s.zetao = v; refresh(); }));
      box.appendChild(toggle("测量噪声", s.noise, (v) => { s.noise = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.observer(4, 0.8, s.wo, s.zetao, s.noise);
      let maxErr = 0;
      for (let i = 0; i < r.err.length; i++) if (r.t[i] > 1 && r.err[i] > maxErr) maxErr = r.err[i];
      plot(a, { height: 220, xLabel: "时间 (s)", yLabel: "x1 / x̂1", yMin: 0, yMax: Math.max(1.1, maxOf(r.y)) * 1.1,
        series: [
          { name: "真实", color: "#b9b3a5", width: 2.6, points: toPts(r.t, r.y) },
          { name: "估计", color: "#1f4e79", width: 1.3, points: toPts(r.t, r.est) },
        ] });
      plot(b, { height: 220, xLabel: "时间 (s)", yLabel: "误差",
        series: [{ name: "|x−x̂|", color: "#8a4a12", width: 1.2, points: toPts(r.t, r.err) }] });
      metrics(m, [["L", `[${r.L[0].toFixed(1)}, ${r.L[1].toFixed(1)}]`], ["t>1s 最大误差", maxErr.toFixed(4)], ["噪声", s.noise ? "有" : "无"]]);
    },
  });

  module({
    id: "lab-rl",
    title: "根轨迹",
    note: "G(s)=1/(s(s+1)(s+2))。X=开环极点（0,−1,−2），实心点=当前闭环极点；本系统无零点，所以没有 O。K 过 6 后进入右半平面。",
    defaults: { K: 1 },
    controls(box, s, refresh) {
      box.appendChild(slider("开环增益 K", 0.1, 50, 0.1, s.K, (v) => { s.K = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.rootLocusDemo(s.K);
      let mi = 0.1;
      r.branches.forEach((br) => br.forEach(([, im]) => { if (Math.abs(im) > mi) mi = Math.abs(im); }));
      const series = r.branches.map((br, i) => ({
        name: `分支${i + 1}`, color: ["#1f4e79", "#2f6b4f", "#8a4a12"][i], width: 1.4, legend: false, points: br,
      }));
      series.push({
        name: "开环极点 X", color: "#5b564c", marker: "x", line: false, legend: true,
        points: r.openPoles.map((p) => [p, 0]),
      });
      series.push({
        name: "当前闭环极点", color: "#1f4e79", marker: "dot", line: false, legend: true,
        points: r.current.map((p) => [p.re, p.im]),
      });
      if (r.zeros.length) {
        series.push({ name: "零点 O", color: "#2f6b4f", marker: "o", line: false, legend: true, points: r.zeros.map((p) => [p, 0]) });
      }
      plot(a, {
        height: 220, xLabel: "Re", yLabel: "Im",
        yMin: -mi * 1.25, yMax: mi * 1.25,
        series,
      });
      b.innerHTML = "";
      const poles = r.current.map((q) => `${q.re.toFixed(2)}${q.im >= 0 ? "+" : ""}${q.im.toFixed(2)}j`).join("  ");
      metrics(m, [["稳定性", r.stable ? "稳定" : "不稳定"], ["当前极点", poles], ["最大实部", r.maxRe.toFixed(3)], ["零点", "无"]]);
    },
  });

  module({
    id: "lab-dt",
    title: "离散化 / 采样周期",
    note: "数字 PID 每 Ts 更新一次并保持；Ts 越大，响应越偏离连续控制器，甚至失稳。",
    defaults: { Ts: 0.02 },
    controls(box, s, refresh) {
      box.appendChild(slider("采样周期 Ts (s)", 0.002, 0.2, 0.002, s.Ts, (v) => { s.Ts = v; refresh(); }));
    },
    render(s, a, b, m) {
      const r = S.discreteDemo(s.Ts);
      let se = 0;
      for (let i = 0; i < r.t.length; i++) se += Math.pow(r.yc[i] - r.yd[i], 2);
      const rmse = Math.sqrt(se / r.t.length);
      const met = S.metrics(r.t, r.yd, 1);
      plot(a, { height: 220, xLabel: "时间 (s)", yLabel: "输出 y", yMin: 0, yMax: Math.max(1.2, maxOf(r.yd)) * 1.1,
        series: [
          { name: "连续 PID", color: "#b9b3a5", width: 2.4, points: toPts(r.t, r.yc) },
          { name: "离散 PID", color: "#1f4e79", width: 1.4, points: toPts(r.t, r.yd) },
        ] });
      plot(b, { height: 220, xLabel: "时间 (s)", yLabel: "误差 (离散−连续)",
        series: [{ name: "Δy", color: "#8a4a12", width: 1.2, points: toPts(r.t, Float64Array.from(r.t, (_, i) => r.yd[i] - r.yc[i])) }] });
      metrics(m, [["采样数", String(r.samples)], ["RMSE 差异", rmse.toFixed(4)], ["离散超调", f2(met.overshoot) + "%"]]);
    },
  });
})();
