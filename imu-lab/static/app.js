/* IMU Lab · 静态版（无后端，数据在浏览器内计算） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { allanDeviation, cleanFrames } = window.IMUAllan;
  const { integrate, kf1d } = window.IMUKF;

  const AXES = [
    { key: "gx", label: "GX · roll rate", color: "#1f4e79" },
    { key: "gy", label: "GY · pitch rate", color: "#2f6b4f" },
    { key: "gz", label: "GZ · yaw rate", color: "#b5651d" },
  ];

  const state = {
    rows: [],
    fs: 100,
    channel: "gz",
    clean: true,
    source: "示例数据（合成）",
    r: 2.51188643150958e-7,
    q: 2.51188643150958e-9,
    fit: null,
  };

  /* ---------- 数据 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rnd) {
    let u = 0, v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function synth() {
    const fs = 100, n = fs * 60, rnd = mulberry32(42), rows = [];
    let bias = 0;
    for (let i = 0; i < n; i++) {
      bias += gauss(rnd) * 0.0005;
      rows.push({
        t: i / fs,
        gx: gauss(rnd) * 0.35 + bias,
        gy: gauss(rnd) * 0.35 + bias,
        gz: gauss(rnd) * 0.35 + bias,
        crc: 1,
      });
    }
    for (let k = 0; k < 10; k++) {
      const i = Math.floor(rnd() * n);
      const s = rnd() < 0.5 ? -1 : 1;
      rows[i].crc = 0;
      rows[i].gx = 200 * s;
      rows[i].gy = 200 * s;
      rows[i].gz = 200 * s;
    }
    return rows;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return [];
    const head = lines[0].split(",").map((s) => s.trim().toLowerCase());
    let idx = {
      t: head.indexOf("t"),
      gx: head.indexOf("gx_dps"),
      gy: head.indexOf("gy_dps"),
      gz: head.indexOf("gz_dps"),
      crc: head.indexOf("crc_ok"),
    };
    let start = 1;
    if (idx.gx < 0) {
      idx = { t: 0, gx: 1, gy: 2, gz: 3, crc: 4 };
      start = 0;
    }
    const rows = [];
    for (let i = start; i < lines.length; i++) {
      const c = lines[i].split(",");
      const gx = Number(c[idx.gx]), gy = Number(c[idx.gy]), gz = Number(c[idx.gz]);
      if (!isFinite(gx) || !isFinite(gy) || !isFinite(gz)) continue;
      const t = idx.t >= 0 ? Number(c[idx.t]) : NaN;
      const crc = idx.crc >= 0 ? Number(c[idx.crc]) : 1;
      rows.push({ t, gx, gy, gz, crc: isFinite(crc) ? crc : 1 });
    }
    return rows;
  }

  function fixTime(rows, fs) {
    for (let i = 0; i < rows.length; i++) {
      if (!isFinite(rows[i].t)) rows[i].t = i / fs;
    }
  }

  /* ---------- 绘图 ---------- */
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function linTicks(min, max, count) {
    const step = niceStep((max - min) / (count || 5));
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(v);
    return out;
  }

  function logTicks(min, max) {
    const out = [];
    const e0 = Math.floor(Math.log10(min)), e1 = Math.ceil(Math.log10(max));
    for (let e = e0; e <= e1; e++) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
      }
    }
    if (out.length > 8) return out.filter((_, i) => i % 2 === 0);
    return out;
  }

  function fmt(v) {
    const a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 10000 || a < 0.01) return v.toExponential(1);
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    return v.toFixed(2);
  }

  function downsample(pts, max) {
    if (pts.length <= max) return pts;
    const step = pts.length / max, out = [];
    for (let i = 0; i < pts.length; i += step) out.push(pts[Math.floor(i)]);
    out.push(pts[pts.length - 1]);
    return out;
  }

  function median(arr) {
    const a = [...arr].sort((x, y) => x - y);
    if (!a.length) return NaN;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* 从 Allan 曲线拟合 ARW/RRW：
     σ(τ)=N/√τ（短 τ），σ(τ)=K√(τ/3)（长 τ）；N、K 单位为 °/√s 与 (°/s)/√s */
  function fitAllan(pts, dt) {
    if (!pts.length) return null;
    const tmin = pts[0].tau, tmax = pts[pts.length - 1].tau;
    const shortMax = Math.min(1.0, tmax / 3);
    const longMin = Math.max(2 * tmin, tmax / 4);
    const short = pts.filter((p) => p.tau <= shortMax);
    const long = pts.filter((p) => p.tau >= longMin);
    const N = median(short.map((p) => p.adev * Math.sqrt(p.tau)));
    const K = median(long.map((p) => p.adev / Math.sqrt(p.tau / 3)));
    if (!isFinite(N) || !isFinite(K) || N <= 0 || K <= 0) return null;
    return {
      N,
      K,
      arw: N * 60,
      rrw: K * 60,
      r: N * N * dt,
      q: K * K * dt,
      shortMax,
      longMin,
    };
  }

  function plot(el, cfg) {
    const pad = { l: 58, r: 16, t: 28, b: 34 };
    const w = Math.max(el.clientWidth || 640, 320);
    const h = cfg.height || 230;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const series = cfg.series
      .map((s) => ({ ...s, points: downsample(s.points.filter((p) => isFinite(p[0]) && isFinite(p[1])), 1500) }))
      .filter((s) => s.points.length > 1);

    if (!series.length) { el.innerHTML = ""; return; }

    let xs = [], ys = [];
    series.forEach((s) => s.points.forEach(([x, y]) => { xs.push(x); ys.push(y); }));

    const logX = !!cfg.logX, logY = !!cfg.logY;
    const pos = (a) => a.filter((v) => v > 0);
    let xmin = logX ? Math.min(...pos(xs)) : Math.min(...xs);
    let xmax = logX ? Math.max(...pos(xs)) : Math.max(...xs);
    let ymin = cfg.yMin !== undefined ? cfg.yMin : (logY ? Math.min(...pos(ys)) : Math.min(...ys));
    let ymax = cfg.yMax !== undefined ? cfg.yMax : (logY ? Math.max(...pos(ys)) : Math.max(...ys));

    if (xmax <= xmin) xmax = xmin + 1;
    if (ymax <= ymin) ymax = ymin + 1;
    if (!logY && cfg.yMin === undefined && cfg.yMax === undefined) {
      const padv = (ymax - ymin) * 0.06;
      ymin -= padv; ymax += padv;
    }

    const lx0 = logX ? Math.log10(xmin) : xmin, lx1 = logX ? Math.log10(xmax) : xmax;
    const ly0 = logY ? Math.log10(ymin) : ymin, ly1 = logY ? Math.log10(ymax) : ymax;
    const X = (v) => pad.l + ((logX ? Math.log10(v) : v) - lx0) / (lx1 - lx0) * iw;
    const Y = (v) => pad.t + (1 - ((logY ? Math.log10(v) : v) - ly0) / (ly1 - ly0)) * ih;

    const xt = logX ? logTicks(xmin, xmax) : linTicks(xmin, xmax, 5);
    const yt = logY ? logTicks(ymin, ymax) : linTicks(ymin, ymax, 4);

    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img">`;
    const clipId = "clip" + ((el._cid = (el._cid || 0) + 1));
    svg += `<defs><clipPath id="${clipId}"><rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}"/></clipPath></defs>`;
    yt.forEach((v) => {
      const y = Y(v);
      svg += `<line class="grid" x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}"/>`;
      svg += `<text class="tick-label" x="${pad.l - 7}" y="${y + 3}" text-anchor="end">${fmt(v)}</text>`;
    });
    xt.forEach((v) => {
      const x = X(v);
      svg += `<line class="grid" x1="${x}" y1="${pad.t}" x2="${x}" y2="${h - pad.b}"/>`;
      svg += `<text class="tick-label" x="${x}" y="${h - pad.b + 14}" text-anchor="middle">${fmt(v)}</text>`;
    });

    svg += `<line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${h - pad.b}"/>`;
    svg += `<line class="axis" x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}"/>`;
    svg += `<text class="axis-label" x="${w - pad.r}" y="${h - 4}" text-anchor="end">${cfg.xLabel || ""}</text>`;
    svg += `<text class="axis-label" x="${pad.l}" y="${pad.t - 10}">${cfg.yLabel || ""}</text>`;

    svg += `<g clip-path="url(#${clipId})">`;
    series.forEach((s) => {
      let d = "";
      s.points.forEach(([x, y], i) => { d += `${i ? "L" : "M"}${X(x).toFixed(2)},${Y(y).toFixed(2)}`; });
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.2}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>`;
    });
    svg += `</g>`;

    let total = 0;
    series.forEach((s) => { if (s.legend !== false) total += 28 + s.name.length * 11; });
    let lx = Math.max(pad.l + 84, w - pad.r - total);
    series.forEach((s) => {
      if (s.legend === false) return;
      svg += `<line x1="${lx}" y1="${pad.t - 18}" x2="${lx + 14}" y2="${pad.t - 18}" stroke="${s.color}" stroke-width="2"/>`;
      svg += `<text class="legend-label" x="${lx + 19}" y="${pad.t - 14}">${s.name}</text>`;
      lx += 28 + s.name.length * 11;
    });

    svg += "</svg>";
    el.innerHTML = svg;
  }

  /* ---------- 主流程 ---------- */
  function currentRows() {
    return state.clean ? cleanFrames(state.rows, 5) : state.rows;
  }

  function updateStats(raw, clean) {
    $("stat-frames").textContent = raw.length.toLocaleString();
    const bad = raw.length - clean.length;
    $("stat-bad").textContent = bad.toLocaleString();
    const dur = raw.length ? (raw[raw.length - 1].t - raw[0].t) : 0;
    $("stat-duration").textContent = dur.toFixed(1) + " s";
    const ch = state.channel;
    const mean = clean.length ? clean.reduce((a, r) => a + r[ch], 0) / clean.length : 0;
    $("stat-mean").textContent = mean.toFixed(3) + " °/s";
    $("source-name").textContent = state.source;
    $("meta-time").textContent = `${clean.length.toLocaleString()} 帧 · ${raw.length - clean.length} 坏帧（尖峰已截断）`;
    $("meta-allan").textContent = "log-log";
    $("meta-kf").textContent = `R=${state.r.toExponential(1)} · Q=${state.q.toExponential(1)}`;
  }

  function draw() {
    const raw = state.rows;
    if (!raw.length) return;
    fixTime(raw, state.fs);
    const clean = currentRows();
    updateStats(raw, clean);

    const ch = state.channel;
    plot($("chart-time"), {
      height: 230,
      xLabel: "时间 (s)",
      yLabel: "角速度 (°/s)",
      yMin: -6,
      yMax: 6,
      series: [
        { name: "原始", color: "#b9b3a5", width: 0.8, points: raw.map((r) => [r.t, r[ch]]) },
        { name: "清洗后", color: "#1f4e79", width: 1.0, points: clean.map((r) => [r.t, r[ch]]) },
      ],
    });

    const dt = 1 / state.fs;
    const allan = {};
    AXES.forEach((a) => { allan[a.key] = allanDeviation(clean.map((r) => r[a.key]), dt); });
    const fit = fitAllan(allan[ch] || [], dt);
    state.fit = fit;
    const fitSeries = [];
    if (fit) {
      const shortPts = (allan[ch] || [])
        .filter((p) => p.tau <= fit.shortMax)
        .map((p) => [p.tau, fit.N / Math.sqrt(p.tau)]);
      const longPts = (allan[ch] || [])
        .filter((p) => p.tau >= fit.longMin)
        .map((p) => [p.tau, fit.K * Math.sqrt(p.tau / 3)]);
      fitSeries.push({ name: "ARW 拟合", color: "#7a9cc6", width: 1.1, dash: "5 4", legend: false, points: shortPts });
      fitSeries.push({ name: "RRW 拟合", color: "#c9a27a", width: 1.1, dash: "5 4", legend: false, points: longPts });
    }
    plot($("chart-allan"), {
      height: 250,
      logX: true,
      logY: true,
      xLabel: "τ (s)",
      yLabel: "Allan 标准差 (°/s)",
      series: AXES.map((a) => ({
        name: a.label.split(" · ")[0],
        color: a.color,
        width: 1.2,
        points: allan[a.key].map((p) => [p.tau, p.adev]),
      })).concat(fitSeries),
    });
    const fi = $("fit-info");
    if (fi) {
      fi.textContent = fit
        ? `ARW=${fit.arw.toFixed(3)} °/√h · RRW=${fit.rrw.toFixed(3)} (°/s)/√h · R/Q=${(fit.r / fit.q).toFixed(1)}`
        : "拟合失败：数据太短或曲线异常";
    }

    const angle = integrate(clean.map((r) => r[ch]), state.fs);
    const filtered = kf1d(angle, state.r, state.q, angle[0], 1);
    plot($("chart-kf"), {
      height: 230,
      xLabel: "时间 (s)",
      yLabel: "角度 (°)",
      series: [
        { name: "原始积分", color: "#d3ccba", width: 2.6, points: clean.map((r, i) => [r.t, angle[i] - angle[0]]) },
        { name: "卡尔曼", color: "#2f6b4f", width: 1.3, points: clean.map((r, i) => [r.t, filtered[i] - filtered[0]]) },
      ],
    });

    $("meta-time").textContent = `${clean.length.toLocaleString()} 帧 · ${raw.length - clean.length} 坏帧（尖峰已截断）`;
    $("meta-allan").textContent = "log-log";
    $("meta-kf").textContent = `R=${state.r.toExponential(2)} · Q=${state.q.toExponential(2)}`;
  }

  function debounce(fn, ms) {
    let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ---------- 事件 ---------- */
  function bind() {
    $("file").addEventListener("change", (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = parseCSV(String(reader.result));
        if (!rows.length) { alert("没有解析到有效数据，请检查列名。"); return; }
        state.rows = rows;
        state.source = f.name;
        fixTime(rows, state.fs);
        draw();
      };
      reader.readAsText(f);
    });

    $("fs").addEventListener("change", (ev) => {
      state.fs = Math.max(1, Number(ev.target.value) || 100);
      fixTime(state.rows, state.fs);
      draw();
    });

    $("channel").addEventListener("change", (ev) => {
      state.channel = ev.target.value;
      draw();
    });

    $("clean").addEventListener("change", (ev) => {
      state.clean = ev.target.checked;
      draw();
    });

    $("logR").addEventListener("input", (ev) => {
      const e = Number(ev.target.value);
      state.r = Math.pow(10, e);
      $("r-val").textContent = state.r.toExponential(2);
      draw();
    });

    $("logQ").addEventListener("input", (ev) => {
      const e = Number(ev.target.value);
      state.q = Math.pow(10, e);
      $("q-val").textContent = state.q.toExponential(2);
      draw();
    });

    $("reset").addEventListener("click", () => {
      state.rows = synth();
      state.source = "示例数据（合成）";
      state.fs = 100;
      $("fs").value = "100";
      draw();
    });

    $("fit").addEventListener("click", () => {
      if (!state.fit) return;
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
      const lr = clamp(Math.log10(state.fit.r), -10, -2);
      const lq = clamp(Math.log10(state.fit.q), -12, -4);
      state.r = Math.pow(10, lr);
      state.q = Math.pow(10, lq);
      $("logR").value = lr.toFixed(1);
      $("logQ").value = lq.toFixed(1);
      $("r-val").textContent = state.r.toExponential(2);
      $("q-val").textContent = state.q.toExponential(2);
      draw();
    });

    window.addEventListener("resize", debounce(draw, 150));
  }

  function init() {
    state.rows = synth();
    bind();
    draw();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
