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
    compare: null,
    pendingText: null,
    pendingName: "",
    cols: null,
    mask: null,
  };

  let dataVersion = 0;
  let cleanRowsCache = null;
  const allanCache = new Map();
  const angleCache = new Map();
  let rafId = 0;
  let resizeTimer = null;
  let allanWorker = null;
  let workerAllan = null;
  let workerReq = 0;

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

  function parseHeader(line) {
    const norm = (s) => s.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const head = line.split(",").map(norm);
    const pick = (names) => {
      for (const n of names) {
        const i = head.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    let idx = {
      t: pick(["t", "time", "timestamp", "sec", "seconds"]),
      gx: pick(["gx_dps", "gx", "gyro_x", "gyrox", "gx_deg_s"]),
      gy: pick(["gy_dps", "gy", "gyro_y", "gyroy", "gy_deg_s"]),
      gz: pick(["gz_dps", "gz", "gyro_z", "gyroz", "gz_deg_s"]),
      crc: pick(["crc_ok", "crc", "crcok"]),
    };
    const rawHead = line.split(",").map((s) => s.trim());
    const looksHeader = rawHead.some((v) => v !== "" && !isFinite(Number(v)));
    if (looksHeader && (idx.gx < 0 || idx.gy < 0 || idx.gz < 0)) return null;
    let start = 1;
    if (idx.gx < 0 || idx.gy < 0 || idx.gz < 0) {
      idx = { t: 0, gx: 1, gy: 2, gz: 3, crc: 4 };
      start = 0;
    }
    return { idx, start };
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return [];
    const h = parseHeader(lines[0]);
    if (!h) return [];
    const { idx, start } = h;
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

  async function parseCSVChunked(text, onProgress) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return [];
    const h = parseHeader(lines[0]);
    if (!h) return [];
    const { idx, start } = h;
    const rows = [];
    for (let i = start; i < lines.length; i++) {
      const c = lines[i].split(",");
      const gx = Number(c[idx.gx]), gy = Number(c[idx.gy]), gz = Number(c[idx.gz]);
      if (isFinite(gx) && isFinite(gy) && isFinite(gz)) {
        const t = idx.t >= 0 ? Number(c[idx.t]) : NaN;
        const crc = idx.crc >= 0 ? Number(c[idx.crc]) : 1;
        rows.push({ t, gx, gy, gz, crc: isFinite(crc) ? crc : 1 });
      }
      if (i % 20000 === 0) {
        if (onProgress) onProgress(Math.round((i / lines.length) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    if (onProgress) onProgress(100);
    return rows;
  }

  function applyRows(rows, source) {
    state.rows = rows;
    state.source = source;
    state.pendingText = null;
    $("map-ui").style.display = "none";
    prepare();
    draw();
  }

  function showMapping(text, name) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    const head = (lines[0] || "").split(",").map((s) => s.trim());
    if (head.length < 2 || head.every((v) => isFinite(Number(v)))) {
      flash("无法识别列，请提供带表头的 CSV");
      return;
    }
    const opts = head.map((h, i) => `<option value="${i}">${h || "列" + (i + 1)}</option>`).join("");
    ["gx", "gy", "gz"].forEach((k) => { $("map-" + k).innerHTML = opts; });
    const pick = (re) => head.findIndex((h) => re.test(h.toLowerCase()));
    $("map-gx").value = String(Math.max(0, pick(/gx|x/)));
    $("map-gy").value = String(Math.max(0, pick(/gy|y/)));
    $("map-gz").value = String(Math.max(0, pick(/gz|z/)));
    state.pendingText = text;
    state.pendingName = name;
    $("map-ui").style.display = "";
    flash(`未识别列，请手动映射（共 ${head.length} 列）`);
  }

  function parseWithMapping(text, map) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      const gx = Number(c[map.gx]), gy = Number(c[map.gy]), gz = Number(c[map.gz]);
      if (!isFinite(gx) || !isFinite(gy) || !isFinite(gz)) continue;
      rows.push({ t: NaN, gx, gy, gz, crc: 1 });
    }
    return rows;
  }

  function finishLoad(rows, f, text) {
    if (!rows.length) {
      showMapping(text, f.name);
      $("source-name").textContent = state.source;
      return;
    }
    if (rows.length > 1000000) {
      flash("行数超过 100 万，请先降采样");
      $("source-name").textContent = state.source;
      return;
    }
    applyRows(rows, f.name);
  }

  function loadFile(f) {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      flash("文件超过 20 MB，请先降采样");
      return;
    }
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        $("source-name").textContent = `读取中 ${Math.round((e.loaded / e.total) * 100)}%`;
      }
    };
    reader.onload = () => {
      const text = String(reader.result);
      $("source-name").textContent = "解析中…";
      if (text.length > 4000000) {
        parseCSVChunked(text, (p) => { $("source-name").textContent = `解析中 ${p}%`; })
          .then((rows) => finishLoad(rows, f, text))
          .catch(() => {
            flash("解析失败，请检查文件格式");
            $("source-name").textContent = state.source;
          });
      } else {
        setTimeout(() => finishLoad(parseCSV(text), f, text), 20);
      }
    };
    reader.onerror = () => flash("文件读取失败");
    reader.readAsText(f);
  }

  function fixTime(rows, fs) {
    let ok = true, prev = -Infinity;
    for (let i = 0; i < rows.length; i++) {
      const t = rows[i].t;
      if (!isFinite(t) || t <= prev) { ok = false; break; }
      prev = t;
    }
    if (!ok) {
      for (let i = 0; i < rows.length; i++) rows[i].t = i / fs;
      flash("时间戳缺失或非单调，已按采样率重建");
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
    if (workerAllan && workerAllan[axis]) return workerAllan[axis];
    if (state.rows.length > 150000 && allanWorker) return [];
    const key = `${dataVersion}|${state.fs}|${state.clean ? 1 : 0}|${axis}`;
    if (!allanCache.has(key)) {
      if (state.cols && window.IMUData) {
        allanCache.set(key, IMUData.allan(state.cols, axis, state.fs, state.mask));
      } else {
        const rows = currentRows();
        allanCache.set(key, allanDeviation(rows.map((r) => r[axis]), 1 / state.fs));
      }
    }
    return allanCache.get(key);
  }

  function plotTimeCanvas(el, raw, clean, ch) {
    const H = 230;
    const pad = { l: 58, r: 16, t: 28, b: 34 };
    const w = Math.max(el.clientWidth || 640, 320);
    let canvas = el.querySelector("canvas");
    if (!canvas) {
      el.innerHTML = "";
      canvas = document.createElement("canvas");
      el.appendChild(canvas);
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = "100%";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);

    const iw = w - pad.l - pad.r, ih = H - pad.t - pad.b;
    const xmin = raw[0].t, xmax = raw[raw.length - 1].t;
    const ymin = -6, ymax = 6;
    const X = (t) => pad.l + ((t - xmin) / (xmax - xmin)) * iw;
    const Y = (v) => pad.t + (1 - (v - ymin) / (ymax - ymin)) * ih;

    ctx.font = "11px Consolas, monospace";
    ctx.fillStyle = "#5b564c";
    ctx.strokeStyle = "#e7e3d8";
    ctx.lineWidth = 1;
    for (const v of [-5, 0, 5]) {
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(String(v), pad.l - 22, y + 4);
    }
    for (let i = 0; i <= 5; i++) {
      const t = xmin + (i / 5) * (xmax - xmin);
      const x = X(t);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
      ctx.fillText(t.toFixed(1), x - 12, H - pad.b + 15);
    }
    ctx.strokeStyle = "#1b1d22";
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b);
    ctx.lineTo(w - pad.r, H - pad.b); ctx.stroke();
    ctx.fillStyle = "#5b564c";
    ctx.fillText("角速度 (°/s)", pad.l, pad.t - 10);
    ctx.fillText("时间 (s)", w - pad.r - 48, H - 4);

    const drawSeries = (rows, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      let idx = 0;
      for (let px = 0; px <= iw; px++) {
        const t = xmin + (px / iw) * (xmax - xmin);
        let lo = Infinity, hi = -Infinity;
        while (idx < rows.length && rows[idx].t <= t) {
          const v = rows[idx][ch];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
          idx++;
        }
        if (lo <= hi) {
          ctx.moveTo(pad.l + px, Y(hi));
          ctx.lineTo(pad.l + px, Y(lo));
        }
      }
      ctx.stroke();
    };
    drawSeries(raw, "#b9b3a5", 0.8);
    drawSeries(clean, "#1f4e79", 1.0);

    canvas.setAttribute("aria-label", `时域图：${raw.length} 帧，Canvas 绘制`);
    let tip = el.querySelector(".tip");
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; el.appendChild(tip); }
    canvas.onmousemove = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const t = xmin + frac * (xmax - xmin);
      let lo = 0, hi = raw.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (raw[mid].t < t) lo = mid + 1; else hi = mid;
      }
      let l2 = 0, h2 = clean.length - 1;
      while (l2 < h2) {
        const mid = (l2 + h2) >> 1;
        if (clean[mid].t < t) l2 = mid + 1; else h2 = mid;
      }
      const r = raw[lo], c = clean[Math.min(l2, clean.length - 1)];
      tip.textContent = `时间 ${r.t.toFixed(2)} s · 原始 ${r[ch].toFixed(3)} · 清洗 ${c[ch].toFixed(3)} °/s`;
      tip.style.left = `${frac * 100}%`;
      tip.style.top = "12%";
      tip.style.opacity = "1";
    };
    canvas.onmouseleave = () => { tip.style.opacity = "0"; };

    canvas.tabIndex = 0;
    let kidx = 0;
    const live = document.getElementById("chart-live");
    const step = Math.max(1, Math.floor(raw.length / 500));
    const showIdx = (i) => {
      kidx = Math.max(0, Math.min(raw.length - 1, i));
      const r = raw[kidx];
      let lo = 0, hi = clean.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (clean[mid].t < r.t) lo = mid + 1; else hi = mid;
      }
      const c = clean[Math.min(lo, clean.length - 1)];
      const text = `时间 ${r.t.toFixed(2)} s · 原始 ${r[ch].toFixed(3)} · 清洗 ${c[ch].toFixed(3)} °/s`;
      tip.textContent = text;
      tip.style.left = `${(X(r.t) / w) * 100}%`;
      tip.style.top = "12%";
      tip.style.opacity = "1";
      if (live) live.textContent = text;
    };
    canvas.addEventListener("focus", () => showIdx(kidx));
    canvas.addEventListener("blur", () => { tip.style.opacity = "0"; });
    canvas.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { showIdx(kidx + step); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { showIdx(kidx - step); ev.preventDefault(); }
      else if (ev.key === "Home") { showIdx(0); ev.preventDefault(); }
      else if (ev.key === "End") { showIdx(raw.length - 1); ev.preventDefault(); }
    });
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

  /* min/max 包络降采样：保留尖峰，按 x 顺序输出 */
  function decimate(pts, max) {
    if (pts.length <= max) return pts;
    const bucket = Math.ceil(pts.length / max);
    const out = [];
    for (let i = 0; i < pts.length; i += bucket) {
      const slice = pts.slice(i, i + bucket);
      let lo = slice[0], hi = slice[0];
      for (const p of slice) {
        if (p[1] < lo[1]) lo = p;
        if (p[1] > hi[1]) hi = p;
      }
      if (lo[0] <= hi[0]) out.push(lo, hi);
      else out.push(hi, lo);
    }
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
      let lo = 0, hi = pts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pts[mid][0] < xv) lo = mid + 1;
        else hi = mid;
      }
      const a = pts[lo], b = pts[Math.max(0, lo - 1)];
      return Math.abs(a[0] - xv) <= Math.abs(b[0] - xv) ? a : b;
    };

    const live = document.getElementById("chart-live");
    const showAt = (xv) => {
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
      if (live) live.textContent = text;
    };
    const hide = () => {
      tip.style.opacity = "0";
      line.setAttribute("opacity", "0");
      dot.setAttribute("opacity", "0");
    };
    const onMove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      showAt(meta.xInv(frac));
    };

    svg.setAttribute("tabindex", "0");
    let idx = 0;
    const showIdx = (i) => {
      const pts = meta.series[0].points;
      idx = Math.max(0, Math.min(pts.length - 1, i));
      showAt(pts[idx][0]);
    };

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerdown", onMove);
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("focus", () => showIdx(idx));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { showIdx(idx + 1); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { showIdx(idx - 1); ev.preventDefault(); }
      else if (ev.key === "Home") { showIdx(0); ev.preventDefault(); }
      else if (ev.key === "End") { showIdx(meta.series[0].points.length - 1); ev.preventDefault(); }
    });
  }

  function plot(el, cfg) {
    const pad = { l: 58, r: 16, t: 28, b: 34 };
    const w = Math.max(el.clientWidth || 640, 320);
    const h = cfg.height || 230;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const series = cfg.series
      .map((s) => ({ ...s, points: decimate(s.points.filter((p) => isFinite(p[0]) && isFinite(p[1])), 1500) }))
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
    attachHover(el, { w, h, pad, series, X, Y, xInv, xLabel: cfg.xLabel || "x", aria: cfg.aria || "" });
  }

  /* ---------- 主流程 ---------- */
  function updateStats() {
    const s = state.stats;
    if (!s) return;
    $("stat-frames").textContent = s.frames.toLocaleString();
    $("stat-bad").textContent = s.bad.toLocaleString();
    $("stat-duration").textContent = s.duration.toFixed(1) + " s";
    $("stat-mean").textContent = (s.means[state.channel] || 0).toFixed(3) + " °/s";
    $("source-name").textContent = state.source;
    const badge = $("demo-badge");
    if (badge) badge.style.display = state.source.startsWith("示例数据") ? "" : "none";
  }

  function prepare() {
    invalidate();
    fixTime(state.rows, state.fs);
    const raw = state.rows;
    const clean = currentRows();

    if (raw.length <= 150000 && window.IMUData) {
      state.cols = IMUData.fromRows(raw);
      state.mask = state.clean ? IMUData.cleanMask(state.cols) : new Uint8Array(state.cols.n).fill(1);
      state.stats = IMUData.stats(state.cols, state.mask);
    } else {
      state.cols = null;
      state.mask = null;
      const means = {};
      AXES.forEach((a) => {
        means[a.key] = clean.length ? clean.reduce((sum, r) => sum + r[a.key], 0) / clean.length : 0;
      });
      state.stats = {
        frames: raw.length,
        bad: raw.length - clean.length,
        duration: raw.length ? raw[raw.length - 1].t - raw[0].t : 0,
        means,
      };
    }

    workerAllan = null;
    if (allanWorker && raw.length > 150000) {
      const n = raw.length;
      const gx = new Float32Array(n), gy = new Float32Array(n), gz = new Float32Array(n);
      const crc = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const r = raw[i];
        gx[i] = r.gx; gy[i] = r.gy; gz[i] = r.gz;
        crc[i] = r.crc === 1 ? 1 : 0;
      }
      workerReq += 1;
      allanWorker.postMessage(
        { id: workerReq, gx, gy, gz, crc, fs: state.fs, clean: state.clean },
        [gx.buffer, gy.buffer, gz.buffer, crc.buffer]
      );
    }
  }

  function updateSRSummary() {
    const el = $("sr-summary");
    const s = state.stats;
    if (!el || !s) return;
    const fit = state.fit;
    el.textContent =
      `统计：${s.frames} 帧，坏帧 ${s.bad}，时长 ${s.duration.toFixed(1)} 秒；` +
      `主通道 ${state.channel} 均值 ${(s.means[state.channel] || 0).toFixed(3)} 度每秒；` +
      `R=${state.r.toExponential(2)}，Q=${state.q.toExponential(2)}；` +
      (fit ? `拟合 ARW ${fit.arw.toFixed(3)}，RRW ${fit.rrw.toFixed(3)}，R² ${fit.r2.toFixed(3)}` : "Allan 计算中");
  }

  function updateAllanTable(pts) {
    const tbody = document.querySelector("#sr-allan tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!pts.length) return;
    const n = Math.min(8, pts.length);
    for (let j = 0; j < n; j++) {
      const i = Math.floor((j * (pts.length - 1)) / Math.max(1, n - 1));
      const tr = document.createElement("tr");
      const vals = [pts[i].tau.toFixed(3)].concat(
        AXES.map((a) => {
          const arr = allanFor(a.key);
          return arr[i] ? arr[i].adev.toFixed(5) : "—";
        })
      );
      vals.forEach((v) => {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  }

  function draw() {
    const raw = state.rows;
    if (!raw.length) return;
    const clean = currentRows();
    updateStats();

    const ch = state.channel;
    if (raw.length > 100000) {
      plotTimeCanvas($("chart-time"), raw, clean, ch);
    } else {
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
    }

    const dt = 1 / state.fs;
    const pts = allanFor(ch);
    const pending = !!(allanWorker && raw.length > 150000 && pts.length === 0);
    const fit = pending ? null : fitAllan(pts, dt);
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
    if (pending) {
      $("chart-allan").innerHTML = `<div class="hint" style="padding:24px">Allan 计算中…（${(raw.length / 1000).toFixed(0)}k 帧，Worker）</div>`;
    } else {
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
    }

    const fi = $("fit-info");
    if (fi) {
      if (pending) {
        fi.textContent = "Allan 计算中…";
      } else if (fit) {
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

    $("meta-time").textContent = `${clean.length.toLocaleString()} 帧 · ${raw.length - clean.length} 坏帧（尖峰已截断）`;
    $("meta-allan").textContent = pending ? "计算中…" : (fit ? `R²=${fit.r2.toFixed(3)}` : "log-log");
    updateAllanTable(pending ? [] : pts);
    updateSRSummary();
    drawKF();
  }

  function drawKF() {
    const clean = currentRows();
    if (!clean.length) return;
    const ch = state.channel;
    const key = `${dataVersion}|${state.fs}|${state.clean ? 1 : 0}|${ch}`;
    let angle = angleCache.get(key);
    if (!angle) {
      angle = integrate(clean.map((r) => r[ch]), state.fs);
      angleCache.set(key, angle);
    }
    const filtered = kf1d(angle, state.r, state.q, angle[0], 1);
    const series = [
      { name: "原始积分", color: "#d3ccba", width: 2.6, points: clean.map((r, i) => [r.t, angle[i] - angle[0]]) },
      { name: "卡尔曼", color: "#2f6b4f", width: 1.3, points: clean.map((r, i) => [r.t, filtered[i] - filtered[0]]) },
    ];
    if (state.compare) {
      const comp = kf1d(angle, state.compare.r, state.compare.q, angle[0], 1);
      series.push({
        name: `对比 A (R/Q=${(state.compare.r / state.compare.q).toFixed(1)})`,
        color: "#b5651d", width: 1.1, dash: "6 4",
        points: clean.map((r, i) => [r.t, comp[i] - comp[0]]),
      });
    }
    plot($("chart-kf"), {
      height: 230,
      xLabel: "时间 (s)",
      yLabel: "角度 (°)",
      aria: `滤波对比：原始积分与卡尔曼输出，R=${state.r.toExponential(1)}，Q=${state.q.toExponential(1)}${state.compare ? "，含对比组" : ""}`,
      series,
    });
    $("meta-kf").textContent = `R=${state.r.toExponential(2)} · Q=${state.q.toExponential(2)}`;
    updateSRSummary();
    syncURL();
  }

  function scheduleKF() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; drawKF(); });
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
    if (state.cols && window.IMUData) {
      const text = IMUData.csv(state.cols, state.mask, ch, state.fs, state.r, state.q);
      downloadBlob(new Blob([text], { type: "text/csv;charset=utf-8" }),
        `imu_lab_${ch}_R${state.r.toExponential(1)}_Q${state.q.toExponential(1)}.csv`.replace(/[^A-Za-z0-9_.+-]/g, ""));
      flash("CSV 已导出");
      return;
    }
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

  function svgMarkup(el) {
    const svg = el && el.querySelector("svg");
    if (!svg) return "";
    const vb = svg.viewBox.baseVal;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", vb.width);
    clone.setAttribute("height", vb.height);
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      "text{font-family:'Segoe UI','Microsoft YaHei',sans-serif}" +
      ".grid{stroke:#e7e3d8}.axis{stroke:#1b1d22}" +
      ".tick-label{fill:#6d685d;font-size:11px;font-family:Consolas,monospace}" +
      ".axis-label{fill:#6d685d;font-size:11px}.legend-label{fill:#1b1d22;font-size:11px}";
    clone.insertBefore(style, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }

  function exportPNG(el, name) {
    const svg = el && el.querySelector("svg");
    const xml = svgMarkup(el);
    if (!svg || !xml) return;
    const vb = svg.viewBox.baseVal;
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

  function exportAllanCSV() {
    const keys = AXES.map((a) => a.key);
    const series = keys.map((k) => allanFor(k));
    const n = Math.min(...series.map((s) => s.length));
    if (!n) { flash("Allan 尚未就绪"); return; }
    const lines = ["tau_s," + keys.map((k) => "adev_" + k).join(",")];
    for (let i = 0; i < n; i++) {
      lines.push([series[0][i].tau.toFixed(6)].concat(series.map((s) => s[i].adev.toFixed(9))).join(","));
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadBlob(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
      `imu_allan_${stamp}.csv`);
    flash("Allan CSV 已导出");
  }

  function exportReport() {
    const clean = currentRows();
    if (!clean.length) return;
    const fit = state.fit;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const blocks = [["时域", "chart-time"], ["Allan 方差", "chart-allan"], ["滤波对比", "chart-kf"]]
      .map(([title, id]) => `<h2>${title}</h2>${svgMarkup($(id))}`)
      .join("");
    const fitText = $("fit-info").innerText.replace(/\n+/g, "；");
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>IMU Lab 报告</title><style>
body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;max-width:900px;margin:32px auto;padding:0 20px;color:#1b1d22;background:#f4f2ec}
h1{font-size:22px}h2{font-size:15px;margin-top:28px;border-top:1px solid #d8d3c7;padding-top:14px}
p,li{font-size:13px;line-height:1.7;color:#3c3a34}
svg{max-width:100%;height:auto;background:#fffdf8;border:1px solid #d8d3c7;margin-top:8px}
code{font-family:Consolas,monospace;background:#ece8dd;padding:1px 4px}
@media print{body{background:#fff;margin:0;max-width:none}.noprint{display:none}h2{page-break-after:avoid}svg{page-break-inside:avoid}}
</style></head><body>
<div class="noprint" style="text-align:right"><button onclick="window.print()" style="padding:8px 14px;border:1px solid #1f4e79;background:#1f4e79;color:#fff;border-radius:2px;cursor:pointer">打印 / 保存为 PDF</button></div>
<h1>IMU 数据实验室 · 分析报告</h1>
<p>生成时间：${new Date().toLocaleString("zh-CN")}</p>
<p>数据来源：${state.source} · 采样率 ${state.fs} Hz · 主通道 ${state.channel} · 总帧数 ${$("stat-frames").textContent} · 坏帧 ${$("stat-bad").textContent}</p>
<p>拟合：${fitText || "未完成"}</p>
<p>滤波参数：R=${state.r.toExponential(3)}，Q=${state.q.toExponential(3)}，R/Q=${(state.r / state.q).toFixed(1)}${fit ? `，拟合 R²=${fit.r2.toFixed(3)}` : ""}</p>
${blocks}
<p style="margin-top:28px;color:#6d685d">说明：R/Q 为工程近似映射；演示数据不代表标定结果。页面：https://xingd5478-ctrl.github.io/vibe-lab/imu/</p>
</body></html>`;
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `imu_report_${stamp}.html`);
    flash("报告已导出");
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
      if (f) loadFile(f);
      ev.target.value = "";
    });

    const panel = document.querySelector(".controls");
    if (panel) {
      ["dragenter", "dragover"].forEach((ev) =>
        panel.addEventListener(ev, (e) => { e.preventDefault(); panel.classList.add("dragging"); }));
      ["dragleave", "drop"].forEach((ev) =>
        panel.addEventListener(ev, (e) => { e.preventDefault(); panel.classList.remove("dragging"); }));
      panel.addEventListener("drop", (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) loadFile(f);
      });
    }

    $("fs").addEventListener("change", (ev) => {
      state.fs = Math.max(1, Number(ev.target.value) || 100);
      prepare();
      draw();
    });

    $("channel").addEventListener("change", (ev) => {
      state.channel = ev.target.value;
      draw();
    });

    $("clean").addEventListener("change", (ev) => {
      state.clean = ev.target.checked;
      prepare();
      draw();
    });

    const bindSlider = (id, valId, setter) => {
      $(id).addEventListener("input", (ev) => {
        const e = Number(ev.target.value);
        setter(e);
        const v = Math.pow(10, e).toExponential(2);
        $(valId).textContent = v;
        ev.target.setAttribute("aria-valuetext", v);
        scheduleKF();
      });
    };
    bindSlider("logR", "r-val", (e) => { state.r = Math.pow(10, e); });
    bindSlider("logQ", "q-val", (e) => { state.q = Math.pow(10, e); });

    $("reset").addEventListener("click", () => {
      state.fs = 100;
      $("fs").value = "100";
      applyRows(synth(), "示例数据（合成）");
    });

    $("map-apply").addEventListener("click", () => {
      if (!state.pendingText) return;
      const rows = parseWithMapping(state.pendingText, {
        gx: Number($("map-gx").value),
        gy: Number($("map-gy").value),
        gz: Number($("map-gz").value),
      });
      if (!rows.length) { flash("映射后没有有效数据"); return; }
      applyRows(rows, state.pendingName || "手动映射");
    });

    $("load-real").addEventListener("click", async () => {
      try {
        let text;
        try {
          const res = await fetch("sample_real_10min.csv.gz", { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          if (typeof DecompressionStream !== "undefined" && res.body) {
            text = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
          } else {
            throw new Error("no DecompressionStream");
          }
        } catch (gzErr) {
          const res = await fetch("sample_real_10min.csv", { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          text = await res.text();
        }
        const rows = parseCSV(text);
        if (!rows.length) throw new Error("empty");
        applyRows(rows, "真实片段（10 min，仅演示）");
      } catch (e) {
        flash("file:// 下无法自动加载，请用“下载片段 CSV”后手动上传");
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
      drawKF();
    });

    $("export-csv").addEventListener("click", exportCSV);
    $("export-report").addEventListener("click", exportReport);
    $("export-allan").addEventListener("click", exportAllanCSV);

    $("compare").addEventListener("click", () => {
      const btn = $("compare");
      if (state.compare) {
        state.compare = null;
        btn.textContent = "保存对比";
        btn.setAttribute("aria-pressed", "false");
        flash("已清除对比");
      } else {
        state.compare = { r: state.r, q: state.q };
        btn.textContent = "清除对比";
        btn.setAttribute("aria-pressed", "true");
        flash(`已保存对比：R/Q=${(state.r / state.q).toFixed(1)}`);
      }
      drawKF();
    });

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

    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 120);
    });
  }

  function init() {
    if (window.Worker) {
      try {
        allanWorker = new Worker("allan-worker.js");
        allanWorker.onmessage = (e) => {
          if (e.data.id !== workerReq) return;
          workerAllan = e.data.results;
          draw();
        };
        allanWorker.onerror = () => {
          allanWorker = null;
          workerAllan = null;
          draw();
        };
      } catch (e) {
        allanWorker = null;
      }
    }
    loadURL();
    state.rows = synth();
    bind();
    prepare();
    draw();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
