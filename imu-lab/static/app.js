/* IMU Lab · 静态版（无后端；Allan 拟合、导出、分享链接、悬浮读数） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { allanDeviation, cleanFrames } = window.IMUAllan;
  const { integrate, kf1d } = window.IMUKF;
  const { fitAllan, quantile } = window.IMUFit;

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

  let dataVersion = 0;
  let cleanRowsCache = null;
  const allanCache = new Map();
  let drawTimer = null;

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
    const bad = new Set();
    while (bad.size < 10) bad.add(Math.floor(rnd() * n));
    for (const i of bad) {
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

  function invalidate() {
    dataVersion += 1;
    cleanRowsCache = null;
    allanCache.clear();
  }

  function currentRows() {
    if (!cleanRowsCache) {
      cleanRowsCache = state.clean ? cleanFrames(state.rows, 5) : state.rows;
    }
    return cleanRowsCache;
  }

  function allanFor(axis) {
    const key = `${dataVersion}|${state.fs}|${state.clean ? 1 : 0}|${axis}`;
    if (!allanCache.has(key)) {
      const rows = currentRows();
      allanCache.set(key, allanDeviation(rows.map((r) => r[axis]), 1 / state.fs));
    }
    return allanCache.get(key);
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
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
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

  function attachHover(el, meta) {
    const svg = el.querySelector("svg");
    if (!svg) return;
    let tip = el.querySelector(".tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tip";
      el.appendChild(tip);
    }
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "crosshair");
    line.setAttribute("y1", meta.pad.t);
    line.setAttribute("y2", meta.h - meta.pad.b);
    line.setAttribute("x1", meta.pad.l);
    line.setAttribute("x2", meta.pad.l);
    line.setAttribute("opacity", "0");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "hover-dot");
    dot.setAttribute("r", "3");
    dot.setAttribute("opacity", "0");
    svg.appendChild(line);
    svg.appendChild(dot);

    const nearest = (pts, xv) => {
      let best = pts[0], bd = Infinity;
      for (const p of pts) {
        const d = Math.abs(p[0] - xv);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    };

    const onMove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const xv = meta.xInv(frac);
      const first = nearest(meta.series[0].points, xv);
      const px = meta.X(first[0]);
      line.setAttribute("x1", px);
      line.setAttribute("x2", px);
      line.setAttribute("opacity", "1");
      dot.setAttribute("cx", px);
      dot.setAttribute("cy", meta.Y(first[1]));
      dot.setAttribute("opacity", "1");
      let text = `${meta.xLabel} ${fmt(first[0])} · ${meta.series[0].name} ${fmt(first[1])}`;
      if (meta.series[1]) {
        const second = nearest(meta.series[1].points, xv);
        text += ` · ${meta.series[1].name} ${fmt(second[1])}`;
      }
      tip.textContent = text;
      tip.style.left = `${(px / meta.w) * 100}%`;
      tip.style.top = `${Math.max(8, (Number(dot.getAttribute("cy")) / meta.h) * 100 - 4)}%`;
      tip.style.opacity = "1";
    };

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerdown", onMove);
    svg.addEventListener("pointerleave", () => {
      tip.style.opacity = "0";
      line.setAttribute("opacity", "0");
      dot.setAttribute("opacity", "0");
    });
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
    const X = (v) => pad.l + (((logX ? Math.log10(v) : v) - lx0) / (lx1 - lx0)) * iw;
    const Y = (v) => pad.t + (1 - ((logY ? Math.log10(v) : v) - ly0) / (ly1 - ly0)) * ih;
    const xInv = (frac) => {
      const v = lx0 + frac * (lx1 - lx0);
      return logX ? Math.pow(10, v) : v;
    };

    const xt = logX ? logTicks(xmin, xmax) : linTicks(xmin, xmax, 5);
    const yt = logY ? logTicks(ymin, ymax) : linTicks(ymin, ymax, 4);

    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${cfg.aria || "数据图"}">`;
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
    attachHover(el, { w, h, pad, series, X, Y, xInv, xLabel: cfg.xLabel || "x" });
  }

  /* ---------- 主流程 ---------- */
  function updateStats(raw, clean) {
    $("stat-frames").textContent = raw.length.toLocaleString();
    $("stat-bad").textContent = (raw.length - clean.length).toLocaleString();
    const dur = raw.length ? raw[raw.length - 1].t - raw[0].t : 0;
    $("stat-duration").textContent = dur.toFixed(1) + " s";
    const ch = state.channel;
    const mean = clean.length ? clean.reduce((a, r) => a + r[ch], 0) / clean.length : 0;
    $("stat-mean").textContent = mean.toFixed(3) + " °/s";
    $("source-name").textContent = state.source;
    const badge = $("demo-badge");
    if (badge) badge.style.display = state.source.startsWith("示例数据") ? "" : "none";
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
      aria: `时域图：${clean.length} 帧角速度，原始与清洗后对比`,
      series: [
        { name: "原始", color: "#b9b3a5", width: 0.8, points: raw.map((r) => [r.t, r[ch]]) },
        { name: "清洗后", color: "#1f4e79", width: 1.0, points: clean.map((r) => [r.t, r[ch]]) },
      ],
    });

    const dt = 1 / state.fs;
    const pts = allanFor(ch);
    const fit = fitAllan(pts, dt);
    state.fit = fit;
    const fitSeries = [];
    if (fit) {
      fitSeries.push({
        name: "ARW 拟合", color: "#7a9cc6", width: 1.1, dash: "5 4", legend: false,
        points: pts.filter((p) => p.tau <= fit.shortMax).map((p) => [p.tau, fit.N / Math.sqrt(p.tau)]),
      });
      fitSeries.push({
        name: "RRW 拟合", color: "#c9a27a", width: 1.1, dash: "5 4", legend: false,
        points: pts.filter((p) => p.tau >= fit.longMin).map((p) => [p.tau, fit.K * Math.sqrt(p.tau / 3)]),
      });
    }
    plot($("chart-allan"), {
      height: 250,
      logX: true,
      logY: true,
      xLabel: "τ (s)",
      yLabel: "Allan 标准差 (°/s)",
      aria: `Allan 方差：三轴曲线，${fit ? `R²=${fit.r2.toFixed(3)}` : "未拟合"}`,
      series: AXES.map((a) => ({
        name: a.label.split(" · ")[0],
        color: a.color,
        width: 1.2,
        points: allanFor(a.key).map((p) => [p.tau, p.adev]),
      })).concat(fitSeries),
    });

    const fi = $("fit-info");
    if (fi) {
      if (fit) {
        const nLo = (fit.nCI[0] * 60).toFixed(2), nHi = (fit.nCI[1] * 60).toFixed(2);
        const kLo = (fit.kCI[0] * 60).toFixed(2), kHi = (fit.kCI[1] * 60).toFixed(2);
        fi.innerHTML =
          `ARW=${fit.arw.toFixed(3)} °/√h（95% ${nLo}–${nHi}）<br>` +
          `RRW=${fit.rrw.toFixed(3)} (°/s)/√h（95% ${kLo}–${kHi}）<br>` +
          `R²=${fit.r2.toFixed(3)} · R/Q=${(fit.r / fit.q).toFixed(1)}`;
      } else {
        fi.textContent = "拟合失败：数据太短或曲线异常";
      }
    }

    const angle = integrate(clean.map((r) => r[ch]), state.fs);
    const filtered = kf1d(angle, state.r, state.q, angle[0], 1);
    plot($("chart-kf"), {
      height: 230,
      xLabel: "时间 (s)",
      yLabel: "角度 (°)",
      aria: `滤波对比：原始积分与卡尔曼输出，R=${state.r.toExponential(1)}，Q=${state.q.toExponential(1)}`,
      series: [
        { name: "原始积分", color: "#d3ccba", width: 2.6, points: clean.map((r, i) => [r.t, angle[i] - angle[0]]) },
        { name: "卡尔曼", color: "#2f6b4f", width: 1.3, points: clean.map((r, i) => [r.t, filtered[i] - filtered[0]]) },
      ],
    });

    $("meta-time").textContent = `${clean.length.toLocaleString()} 帧 · ${raw.length - clean.length} 坏帧（尖峰已截断）`;
    $("meta-allan").textContent = fit ? `R²=${fit.r2.toFixed(3)}` : "log-log";
    $("meta-kf").textContent = `R=${state.r.toExponential(2)} · Q=${state.q.toExponential(2)}`;
    try { syncURL(); } catch (e) { /* ignore */ }
  }

  function scheduleDraw() {
    clearTimeout(drawTimer);
    drawTimer = setTimeout(draw, 80);
  }

  /* ---------- 导出 / 分享 ---------- */
  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function flash(msg) {
    const el = $("share-info");
    if (!el) return;
    el.textContent = msg;
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { el.textContent = "—"; }, 2500);
  }

  function exportCSV() {
    const clean = currentRows();
    if (!clean.length) return;
    const ch = state.channel;
    const angle = integrate(clean.map((r) => r[ch]), state.fs);
    const filtered = kf1d(angle, state.r, state.q, angle[0], 1);
    const lines = ["t,gx_dps,gy_dps,gz_dps,angle_deg,kf_deg"];
    clean.forEach((r, i) => {
      lines.push([
        r.t.toFixed(4),
        r.gx.toFixed(6), r.gy.toFixed(6), r.gz.toFixed(6),
        (angle[i] - angle[0]).toFixed(6),
        (filtered[i] - filtered[0]).toFixed(6),
      ].join(","));
    });
    downloadBlob(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
      `imu_lab_${ch}_R${state.r.toExponential(1)}_Q${state.q.toExponential(1)}.csv`.replace(/[^A-Za-z0-9_.+-]/g, ""));
    flash("CSV 已导出");
  }

  function exportPNG(el, name) {
    const svg = el && el.querySelector("svg");
    if (!svg) return;
    const vb = svg.viewBox.baseVal;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", vb.width);
    clone.setAttribute("height", vb.height);
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      "text{font-family:'Segoe UI','Microsoft YaHei',sans-serif}" +
      ".grid{stroke:#e7e3d8}.axis{stroke:#1b1d22}" +
      ".tick-label{fill:#6d685d;font-size:10px;font-family:Consolas,monospace}" +
      ".axis-label{fill:#6d685d;font-size:11px}.legend-label{fill:#1b1d22;font-size:11px}";
    clone.insertBefore(style, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vb.width * scale);
      canvas.height = Math.round(vb.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => downloadBlob(b, name + ".png"), "image/png");
      flash("PNG 已导出");
    };
    img.onerror = () => { URL.revokeObjectURL(url); flash("PNG 导出失败"); };
    img.src = url;
  }

  function syncURL() {
    const p = new URLSearchParams();
    p.set("r", Math.log10(state.r).toFixed(2));
    p.set("q", Math.log10(state.q).toFixed(2));
    p.set("ch", state.channel);
    p.set("fs", String(state.fs));
    try { history.replaceState(null, "", location.pathname + "?" + p.toString()); } catch (e) { /* file:// */ }
  }

  function loadURL() {
    const p = new URLSearchParams(location.search);
    if (p.has("r")) {
      const e = parseFloat(p.get("r"));
      if (isFinite(e)) {
        state.r = Math.pow(10, e);
        $("logR").value = e.toFixed(1);
        $("r-val").textContent = state.r.toExponential(2);
      }
    }
    if (p.has("q")) {
      const e = parseFloat(p.get("q"));
      if (isFinite(e)) {
        state.q = Math.pow(10, e);
        $("logQ").value = e.toFixed(1);
        $("q-val").textContent = state.q.toExponential(2);
      }
    }
    if (p.has("ch") && ["gx", "gy", "gz"].includes(p.get("ch"))) {
      state.channel = p.get("ch");
      $("channel").value = state.channel;
    }
    if (p.has("fs")) {
      const fs = parseFloat(p.get("fs"));
      if (isFinite(fs) && fs > 0) { state.fs = fs; $("fs").value = fs; }
    }
  }

  /* ---------- 事件 ---------- */
  function bind() {
    $("file").addEventListener("change", (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) {
        flash("文件超过 20 MB，请先降采样");
        ev.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        const head = text.split(/\r?\n/)[0] || "";
        if (!/gx_dps/i.test(head) || !/gy_dps/i.test(head) || !/gz_dps/i.test(head)) {
          flash("CSV 缺少列：gx_dps / gy_dps / gz_dps");
          return;
        }
        const rows = parseCSV(text);
        if (!rows.length) { flash("没有解析到有效数据，请检查列名与分隔符"); return; }
        if (rows.length > 200000) { flash("行数超过 20 万，请先降采样再上传"); return; }
        state.rows = rows;
        state.source = f.name;
        invalidate();
        fixTime(rows, state.fs);
        draw();
      };
      reader.readAsText(f);
    });

    $("fs").addEventListener("change", (ev) => {
      state.fs = Math.max(1, Number(ev.target.value) || 100);
      invalidate();
      fixTime(state.rows, state.fs);
      draw();
    });

    $("channel").addEventListener("change", (ev) => {
      state.channel = ev.target.value;
      draw();
    });

    $("clean").addEventListener("change", (ev) => {
      state.clean = ev.target.checked;
      invalidate();
      draw();
    });

    const bindSlider = (id, valId, setter) => {
      $(id).addEventListener("input", (ev) => {
        const e = Number(ev.target.value);
        setter(e);
        const v = Math.pow(10, e).toExponential(2);
        $(valId).textContent = v;
        ev.target.setAttribute("aria-valuetext", v);
        scheduleDraw();
      });
    };
    bindSlider("logR", "r-val", (e) => { state.r = Math.pow(10, e); });
    bindSlider("logQ", "q-val", (e) => { state.q = Math.pow(10, e); });

    $("reset").addEventListener("click", () => {
      state.rows = synth();
      state.source = "示例数据（合成）";
      state.fs = 100;
      $("fs").value = "100";
      invalidate();
      draw();
    });

    $("load-real").addEventListener("click", async () => {
      try {
        const res = await fetch("sample_real_60s.csv", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const rows = parseCSV(await res.text());
        if (!rows.length) throw new Error("empty");
        state.rows = rows;
        state.source = "真实样例（2 h 数据 60 s）";
        invalidate();
        fixTime(rows, state.fs);
        draw();
      } catch (e) {
        flash("file:// 下无法自动加载，请用“下载样例 CSV”后手动上传");
      }
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

    $("export-csv").addEventListener("click", exportCSV);

    $("share").addEventListener("click", async () => {
      syncURL();
      try {
        await navigator.clipboard.writeText(location.href);
        flash("链接已复制");
      } catch (e) {
        prompt("复制链接：", location.href);
      }
    });

    document.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", () => {
        exportPNG($(btn.getAttribute("data-export")), btn.getAttribute("data-name") || "chart");
      });
    });

    window.addEventListener("resize", scheduleDraw);
  }

  function init() {
    loadURL();
    state.rows = synth();
    bind();
    draw();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
