/* IMU Lab · 静态版（无后端；Allan 拟合、导出、分享链接、悬浮读数） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const T = (zh, en) => (document.documentElement.lang === "en" ? en : zh);
  const CALIB_KEY = "vibe-imu-calib-v1";
  const { allanDeviation, cleanFrames } = window.IMUAllan;
  const { integrate, kf1d } = window.IMUKF;
  const { fitAllan, quantile } = window.IMUFit;
  const { plot, plotTimeCanvas } = window.IMUChart;

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
    sixFace: {},
    sixCalib: null,
    gyroScale: {},
    tempPoints: [],
    tempExcluded: new Set(),
    tempFit: null,
    cols: null,
    mask: null,
    warnedVersion: 0,
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
  let parseWorker = null;
  let parsePending = 0;
  let kfWorker = null;
  let kfPending = 0;
  let kfRateKey = "";

  /* ---------- 数据 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rnd) {
    let u = 0,
      v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function synth() {
    const fs = 100,
      n = fs * 60,
      rnd = mulberry32(42),
      rows = [];
    let bias = 0;
    for (let i = 0; i < n; i++) {
      bias += gauss(rnd) * 0.0005;
      rows.push({
        t: i / fs,
        gx: gauss(rnd) * 0.35 + bias,
        gy: gauss(rnd) * 0.35 + bias,
        gz: gauss(rnd) * 0.35 + bias,
        ax: Math.sin(i / 40) * 0.05,
        ay: Math.sin(i / 160) * 0.1,
        az: 1,
        temp: 25 + Math.sin(i / 300) * 0.5,
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
    const norm = (s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
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
      ax: pick(["ax", "ax_g", "accel_x"]),
      ay: pick(["ay", "ay_g", "accel_y"]),
      az: pick(["az", "az_g", "accel_z"]),
      temp: pick(["temp", "temperature", "temp_c", "t_c", "degc"]),
      crc: pick(["crc_ok", "crc", "crcok"]),
    };
    const rawHead = line.split(",").map((s) => s.trim());
    const looksHeader = rawHead.some((v) => v !== "" && !isFinite(Number(v)));
    if (looksHeader && (idx.gx < 0 || idx.gy < 0 || idx.gz < 0)) return null;
    let start = 1;
    if (idx.gx < 0 || idx.gy < 0 || idx.gz < 0) {
      idx = { t: 0, gx: 1, gy: 2, gz: 3, ax: -1, ay: -1, az: -1, temp: -1, crc: 4 };
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
      const gx = Number(c[idx.gx]),
        gy = Number(c[idx.gy]),
        gz = Number(c[idx.gz]);
      if (!isFinite(gx) || !isFinite(gy) || !isFinite(gz)) continue;
      const t = idx.t >= 0 ? Number(c[idx.t]) : NaN;
      const crc = idx.crc >= 0 ? Number(c[idx.crc]) : 1;
      const row = { t, gx, gy, gz, crc: isFinite(crc) ? crc : 1 };
      if (idx.ax >= 0 && idx.ay >= 0 && idx.az >= 0) {
        row.ax = Number(c[idx.ax]);
        row.ay = Number(c[idx.ay]);
        row.az = Number(c[idx.az]);
      }
      if (idx.temp >= 0) row.temp = Number(c[idx.temp]);
      rows.push(row);
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
      const gx = Number(c[idx.gx]),
        gy = Number(c[idx.gy]),
        gz = Number(c[idx.gz]);
      if (isFinite(gx) && isFinite(gy) && isFinite(gz)) {
        const t = idx.t >= 0 ? Number(c[idx.t]) : NaN;
        const crc = idx.crc >= 0 ? Number(c[idx.crc]) : 1;
        const row = { t, gx, gy, gz, crc: isFinite(crc) ? crc : 1 };
        if (idx.ax >= 0 && idx.ay >= 0 && idx.az >= 0) {
          row.ax = Number(c[idx.ax]);
          row.ay = Number(c[idx.ay]);
          row.az = Number(c[idx.az]);
        }
        if (idx.temp >= 0) row.temp = Number(c[idx.temp]);
        rows.push(row);
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
    state.fusionRows = null;
    state.accelBackup = null;
    state.gyroBackup = null;
    state.tempBackup = null;
    state.combinedBackup = null;
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
    ["gx", "gy", "gz", "ax", "ay", "az", "temp"].forEach((k) => {
      $("map-" + k).innerHTML = opts;
    });
    const pick = (re) => head.findIndex((h) => re.test(h.toLowerCase()));
    $("map-gx").value = String(Math.max(0, pick(/gx|x/)));
    $("map-gy").value = String(Math.max(0, pick(/gy|y/)));
    $("map-gz").value = String(Math.max(0, pick(/gz|z/)));
    $("map-ax").value = String(Math.max(0, pick(/ax/)));
    $("map-ay").value = String(Math.max(0, pick(/ay/)));
    $("map-az").value = String(Math.max(0, pick(/az/)));
    $("map-temp").value = String(Math.max(0, pick(/temp|temperature/)));
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
      const gx = Number(c[map.gx]),
        gy = Number(c[map.gy]),
        gz = Number(c[map.gz]);
      if (!isFinite(gx) || !isFinite(gy) || !isFinite(gz)) continue;
      const row = { t: NaN, gx, gy, gz, crc: 1 };
      if (map.ax != null && map.ay != null && map.az != null) {
        row.ax = Number(c[map.ax]);
        row.ay = Number(c[map.ay]);
        row.az = Number(c[map.az]);
      }
      if (map.temp != null) row.temp = Number(c[map.temp]);
      rows.push(row);
    }
    return rows;
  }

  function buildRowsChunked(cols, f, text) {
    const n = cols.n;
    if (!n) {
      finishLoad([], f, text);
      return;
    }
    const rows = new Array(n);
    let i = 0;
    const step = () => {
      const end = Math.min(n, i + 50000);
      for (; i < end; i++) {
        rows[i] = { t: cols.t[i], gx: cols.gx[i], gy: cols.gy[i], gz: cols.gz[i], crc: cols.crc[i] };
        if (cols.hasAccel) {
          rows[i].ax = cols.ax[i];
          rows[i].ay = cols.ay[i];
          rows[i].az = cols.az[i];
        }
        if (cols.hasTemp) rows[i].temp = cols.temp[i];
      }
      $("source-name").textContent = `解析中 ${Math.round((i / n) * 100)}%`;
      if (i < n) setTimeout(step, 0);
      else finishLoad(rows, f, text);
    };
    step();
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
        if (parseWorker) {
          parsePending += 1;
          const id = parsePending;
          $("source-name").textContent = "解析中…（Worker）";
          parseWorker.onmessage = (e) => {
            const m = e.data;
            if (m.id !== id) return;
            if (!m.ok) {
              showMapping(text, f.name);
              $("source-name").textContent = state.source;
              return;
            }
            buildRowsChunked(
              {
                t: m.t,
                gx: m.gx,
                gy: m.gy,
                gz: m.gz,
                ax: m.ax,
                ay: m.ay,
                az: m.az,
                hasAccel: m.hasAccel,
                temp: m.temp,
                hasTemp: m.hasTemp,
                crc: m.crc,
                n: m.n,
              },
              f,
              text
            );
          };
          parseWorker.postMessage({ id, text });
        } else {
          parseCSVChunked(text, (p) => {
            $("source-name").textContent = `解析中 ${p}%`;
          })
            .then((rows) => finishLoad(rows, f, text))
            .catch(() => {
              flash("解析失败，请检查文件格式");
              $("source-name").textContent = state.source;
            });
        }
      } else {
        setTimeout(() => finishLoad(parseCSV(text), f, text), 20);
      }
    };
    reader.onerror = () => flash("文件读取失败");
    reader.readAsText(f);
  }

  function fixTime(rows, fs) {
    let ok = true,
      prev = -Infinity;
    for (let i = 0; i < rows.length; i++) {
      const t = rows[i].t;
      if (!isFinite(t) || t <= prev) {
        ok = false;
        break;
      }
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
        allanCache.set(
          key,
          allanDeviation(
            rows.map((r) => r[axis]),
            1 / state.fs
          )
        );
      }
    }
    return allanCache.get(key);
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
    if (state.warnedVersion !== dataVersion) {
      state.warnedVersion = dataVersion;
      if (window.IMUData) {
        IMUData.validate(state.rows, state.fs)
          .slice(0, 2)
          .forEach((w) => flash(w));
      }
    }
    if (allanWorker && raw.length > 150000) {
      const n = raw.length;
      const gx = new Float32Array(n),
        gy = new Float32Array(n),
        gz = new Float32Array(n);
      const crc = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const r = raw[i];
        gx[i] = r.gx;
        gy[i] = r.gy;
        gz[i] = r.gz;
        crc[i] = r.crc === 1 ? 1 : 0;
      }
      workerReq += 1;
      allanWorker.postMessage({ id: workerReq, gx, gy, gz, crc, fs: state.fs, clean: state.clean }, [
        gx.buffer,
        gy.buffer,
        gz.buffer,
        crc.buffer,
      ]);
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
        yMin: (() => {
          let lo = Infinity;
          for (const r of clean) lo = Math.min(lo, r[ch]);
          return Number.isFinite(lo) ? Math.min(-1, lo - Math.max(0.5, Math.abs(lo) * 0.1)) : -6;
        })(),
        yMax: (() => {
          let hi = -Infinity;
          for (const r of clean) hi = Math.max(hi, r[ch]);
          return Number.isFinite(hi) ? Math.max(1, hi + Math.max(0.5, Math.abs(hi) * 0.1)) : 6;
        })(),
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
        name: "ARW 拟合",
        color: "#7a9cc6",
        width: 1.1,
        dash: "5 4",
        legend: false,
        points: pts.filter((p) => p.tau <= fit.shortMax).map((p) => [p.tau, fit.N / Math.sqrt(p.tau)]),
      });
      fitSeries.push({
        name: "RRW 拟合",
        color: "#c9a27a",
        width: 1.1,
        dash: "5 4",
        legend: false,
        points: pts.filter((p) => p.tau >= fit.longMin).map((p) => [p.tau, fit.K * Math.sqrt(p.tau / 3)]),
      });
    }
    if (pending) {
      $("chart-allan").innerHTML =
        `<div class="hint" style="padding:24px">Allan 计算中…（${(raw.length / 1000).toFixed(0)}k 帧，Worker）</div>`;
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
        const nLo = (fit.nCI[0] * 60).toFixed(2),
          nHi = (fit.nCI[1] * 60).toFixed(2);
        const kLo = (fit.kCI[0] * 60).toFixed(2),
          kHi = (fit.kCI[1] * 60).toFixed(2);
        fi.innerHTML =
          `ARW=${fit.arw.toFixed(3)} °/√h（95% ${nLo}–${nHi}）<br>` +
          `RRW=${fit.rrw.toFixed(3)} (°/s)/√h（95% ${kLo}–${kHi}）<br>` +
          `R²=${fit.r2.toFixed(3)} · R/Q=${(fit.r / fit.q).toFixed(1)}`;
      } else {
        fi.textContent = "拟合失败：数据太短或曲线异常";
      }
    }

    $("meta-time").textContent =
      `${clean.length.toLocaleString()} 帧 · ${raw.length - clean.length} 坏帧（尖峰已截断）`;
    $("meta-allan").textContent = pending ? "计算中…" : fit ? `R²=${fit.r2.toFixed(3)}` : "log-log";
    updateAllanTable(pending ? [] : pts);
    updateSRSummary();
    drawKF();
  }

  function onKFReply(e) {
    const m = e.data;
    if (m.id !== kfPending) return;
    const series = [
      { name: "原始积分", color: "#d3ccba", width: 2.6, points: m.angle },
      { name: "卡尔曼", color: "#2f6b4f", width: 1.3, points: m.kf },
    ];
    if (state.compare && m.comp && m.comp.length) {
      series.push({
        name: `对比 A (R/Q=${(state.compare.r / state.compare.q).toFixed(1)})`,
        color: "#b5651d",
        width: 1.1,
        dash: "6 4",
        points: m.comp,
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
  }

  function drawKF() {
    const clean = currentRows();
    if (!clean.length) return;
    const ch = state.channel;
    const key = `${dataVersion}|${state.fs}|${state.clean ? 1 : 0}|${ch}`;

    if (clean.length > 150000 && kfWorker) {
      if (kfRateKey !== key) {
        const rate = new Float32Array(clean.length);
        for (let i = 0; i < clean.length; i++) rate[i] = clean[i][ch];
        kfRateKey = key;
        kfWorker.postMessage({ type: "set", rate, fs: state.fs }, [rate.buffer]);
      }
      kfPending += 1;
      kfWorker.postMessage({ type: "compute", id: kfPending, r: state.r, q: state.q, compare: state.compare });
      $("meta-kf").textContent = "计算中…";
      updateSRSummary();
      syncURL();
      return;
    }

    let angle = angleCache.get(key);
    if (!angle) {
      angle = integrate(
        clean.map((r) => r[ch]),
        state.fs
      );
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
        color: "#b5651d",
        width: 1.1,
        dash: "6 4",
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
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      drawKF();
    });
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
    flash._t = setTimeout(() => {
      el.textContent = "—";
    }, 2500);
  }

  function exportCSV() {
    if (window.vibeTrack) window.vibeTrack("imu-export-csv");
    const clean = currentRows();
    if (!clean.length) return;
    const ch = state.channel;
    if (state.cols && window.IMUData) {
      const text = IMUData.csv(state.cols, state.mask, ch, state.fs, state.r, state.q);
      downloadBlob(
        new Blob([text], { type: "text/csv;charset=utf-8" }),
        `imu_lab_${ch}_R${state.r.toExponential(1)}_Q${state.q.toExponential(1)}.csv`.replace(/[^A-Za-z0-9_.+-]/g, "")
      );
      flash("CSV 已导出");
      return;
    }
    const angle = integrate(
      clean.map((r) => r[ch]),
      state.fs
    );
    const filtered = kf1d(angle, state.r, state.q, angle[0], 1);
    const lines = ["t,gx_dps,gy_dps,gz_dps,angle_deg,kf_deg"];
    clean.forEach((r, i) => {
      lines.push(
        [
          r.t.toFixed(4),
          r.gx.toFixed(6),
          r.gy.toFixed(6),
          r.gz.toFixed(6),
          (angle[i] - angle[0]).toFixed(6),
          (filtered[i] - filtered[0]).toFixed(6),
        ].join(",")
      );
    });
    downloadBlob(
      new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
      `imu_lab_${ch}_R${state.r.toExponential(1)}_Q${state.q.toExponential(1)}.csv`.replace(/[^A-Za-z0-9_.+-]/g, "")
    );
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
    const light = window.IMUChart && window.IMUChart.lightColor;
    if (light) {
      clone.querySelectorAll("[stroke], [fill]").forEach((n) => {
        ["stroke", "fill"].forEach((attr) => {
          const v = n.getAttribute(attr);
          if (v && v[0] === "#") n.setAttribute(attr, light(v));
        });
      });
    }
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
    img.onerror = () => {
      URL.revokeObjectURL(url);
      flash("PNG 导出失败");
    };
    img.src = url;
  }

  function exportAllanCSV() {
    if (window.vibeTrack) window.vibeTrack("imu-export-allan");
    const keys = AXES.map((a) => a.key);
    const series = keys.map((k) => allanFor(k));
    const n = Math.min(...series.map((s) => s.length));
    if (!n) {
      flash("Allan 尚未就绪");
      return;
    }
    const lines = ["tau_s," + keys.map((k) => "adev_" + k).join(",")];
    for (let i = 0; i < n; i++) {
      lines.push([series[0][i].tau.toFixed(6)].concat(series.map((s) => s[i].adev.toFixed(9))).join(","));
    }
    lines.push("# source=" + state.source);
    lines.push("# fs=" + state.fs);
    lines.push("# units=deg_per_s");
    if (state.fit) lines.push("# fit_method=" + state.fit.method);
    lines.push("# fit_arw=" + (state.fit ? state.fit.arw.toFixed(4) : "n/a"));
    lines.push("# fit_rrw=" + (state.fit ? state.fit.rrw.toFixed(4) : "n/a"));
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadBlob(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `imu_allan_${stamp}.csv`);
    flash("Allan CSV 已导出");
  }

  function exportReport() {
    const clean = currentRows();
    if (!clean.length) return;
    const fit = state.fit;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const blocks = [
      ["时域", "chart-time"],
      ["Allan 方差", "chart-allan"],
      ["滤波对比", "chart-kf"],
    ]
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

  function saveCalibrationProject() {
    if (!window.VibeProject) return;
    const p = window.VibeProject.makeProject({
      name: "IMU calibration " + new Date().toISOString().slice(0, 10),
      notes: "IMU calibration project",
      calibration: {
        sixFace: state.sixFace,
        sixCalib: state.sixCalib,
        gyroScale: state.gyroScale,
        tempPoints: state.tempPoints,
        tempFit: state.tempFit,
      },
    });
    p.id = "cal-" + Date.now().toString(36);
    try {
      window.VibeProject.save(p);
      window.VibeProject.download(p);
      flash("标定项目已保存并导出");
    } catch (e) {
      flash("项目过大或保存失败：" + e.message);
    }
  }

  function exportCalib() {
    const rows = currentRows().slice(0, Math.min(500, Math.round(state.fs * 5)));
    if (!rows.length) return;
    const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
    const fit = state.fit;
    const data = {
      source: state.source,
      fs: state.fs,
      calibration: {
        method: "static mean, first 5 s",
        samples: rows.length,
        bias_dps: { gx: mean("gx"), gy: mean("gy"), gz: mean("gz") },
      },
      allanFit: fit ? { arw: fit.arw, rrw: fit.rrw, r2: fit.r2 } : null,
      kalman: { R: state.r, Q: state.q },
      sixFace: state.sixCalib,
      sixFaceRaw: state.sixFace,
      gyroScale: state.gyroScale,
      tempFit: state.tempFit,
      tempPoints: state.tempPoints,
      note: "Teaching estimate; not a certified calibration.",
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "imu_calibration.json");
    flash("标定 JSON 已导出");
  }

  function exportFusion() {
    let rows = state.fusionRows;
    if (!rows) {
      const main = currentRows().filter((r) => Number.isFinite(r.ax) && Number.isFinite(r.ay) && Number.isFinite(r.az));
      if (main.length) rows = main;
    }
    if (!rows || !rows.length) {
      flash("当前没有可导出的融合数据");
      return;
    }
    const alpha = Number($("fusion-alpha").value) || 0.02;
    const dt = Math.max(1e-4, rows[1] ? rows[1].t - rows[0].t : 0.01);
    let gyroAngle = 0,
      fused = 0;
    const out = ["t,gx_dps,acc_deg,fused_deg"];
    for (const r of rows) {
      const a = (Math.atan2(r.ay, r.az) * 180) / Math.PI;
      gyroAngle += r.gx * dt;
      fused = (1 - alpha) * (fused + r.gx * dt) + alpha * a;
      out.push([r.t.toFixed(4), r.gx.toFixed(4), a.toFixed(4), fused.toFixed(4)].join(","));
    }
    downloadBlob(new Blob(["\ufeff" + out.join("\n")], { type: "text/csv;charset=utf-8" }), "imu_fusion.csv");
    flash("融合 CSV 已导出");
  }

  function downloadCalibPDF() {
    const rows = currentRows().slice(0, Math.min(500, Math.round(state.fs * 5)));
    const mean = (k) => (rows.length ? rows.reduce((s, r) => s + r[k], 0) / rows.length : NaN);
    const cal = state.sixCalib;
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f2ec";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1b1d22";
    let y = 90;
    const line = (text, size = 20, bold = false, color = "#1b1d22") => {
      ctx.font = `${bold ? "600 " : ""}${size}px "Microsoft YaHei", "Segoe UI", sans-serif`;
      ctx.fillStyle = color;
      const max = 1100;
      let cur = "";
      for (const ch of String(text)) {
        if (ctx.measureText(cur + ch).width > max) {
          ctx.fillText(cur, 70, y);
          y += size * 1.5;
          cur = "";
        }
        cur += ch;
      }
      if (cur) {
        ctx.fillText(cur, 70, y);
        y += size * 1.5;
      }
    };
    line("IMU 标定报告", 36, true);
    line(`vibe-lab · 教学报告，不是认证标定 · ${new Date().toLocaleString()}`, 16, false, "#6f6a61");
    y += 12;
    line("数据", 24, true);
    line(`来源：${state.source} · 采样率：${state.fs} Hz · 有效帧：${rows.length}`, 18);
    y += 8;
    line("陀螺零偏（前 5 s 均值）", 24, true);
    line(`gx=${mean("gx").toFixed(3)} · gy=${mean("gy").toFixed(3)} · gz=${mean("gz").toFixed(3)} °/s`, 18);
    const fit = state.fit;
    line(
      `Allan：ARW ${fit ? fit.arw.toFixed(3) : "—"} · RRW ${fit ? fit.rrw.toFixed(3) : "—"} · R² ${fit ? fit.r2.toFixed(3) : "—"}`,
      18
    );
    line(`Kalman：R=${state.r.toExponential(2)} · Q=${state.q.toExponential(2)}`, 18);
    y += 8;
    line("六面标定", 24, true);
    if (cal) {
      line(
        `质量：${cal.beforeGrade || "—"} → ${cal.grade || "—"} · |a| ${cal.quality.normMean.toFixed(3)} ± ${cal.quality.normStd.toFixed(3)} g · RMS ${cal.quality.rmsError.toFixed(3)} g`,
        18
      );
      line(`bias = [${cal.bias.x.toFixed(3)}, ${cal.bias.y.toFixed(3)}, ${cal.bias.z.toFixed(3)}] g`, 18);
      line(`scale = [${cal.scale.x.toFixed(3)}, ${cal.scale.y.toFixed(3)}, ${cal.scale.z.toFixed(3)}]`, 18);
      line("3×3 矩阵已用于交叉轴补偿；应用/撤销见页面。", 16, false, "#6f6a61");
    } else line("未完成六面标定。", 18);
    y += 8;
    line("温度漂移", 24, true);
    line(
      state.tempFit
        ? `斜率 °/s/°C：gx ${state.tempFit.gx.k.toExponential(2)} · gy ${state.tempFit.gy.k.toExponential(2)} · gz ${state.tempFit.gz.k.toExponential(2)} · 点 ${state.tempPoints.length}`
        : "未拟合。",
      18
    );
    y += 8;
    line("陀螺刻度", 24, true);
    const gs = Object.keys(state.gyroScale);
    line(gs.length ? gs.map((a) => `${a}=${state.gyroScale[a].toFixed(4)}`).join(" · ") : "未标定。", 18);
    y += 20;
    line("说明", 24, true);
    line(
      "本报告由浏览器内数据生成；PDF 为图像型 PDF，文字不可选中。标定前请确认静态、单 g 与已知角速度条件。",
      16,
      false,
      "#6f6a61"
    );
    const jpeg = dataUrlBytes(canvas.toDataURL("image/jpeg", 0.92));
    const pdf = pdfFromJpeg(jpeg, canvas.width, canvas.height);
    downloadBlob(new Blob([pdf], { type: "application/pdf" }), "imu_calibration.pdf");
    flash("PDF 已生成");
  }

  function dataUrlBytes(url) {
    const b64 = url.split(",")[1];
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function pdfFromJpeg(jpeg, iw, ih) {
    const enc = (s) => new TextEncoder().encode(s);
    const chunks = [];
    let len = 0,
      offsets = [];
    const add = (u) => {
      chunks.push(u);
      len += u.length;
    };
    add(enc("%PDF-1.4\n"));
    const obj = (n, parts) => {
      offsets[n] = len;
      add(enc(`${n} 0 obj\n`));
      parts.forEach(add);
      add(enc("endobj\n"));
    };
    obj(1, [enc("<< /Type /Catalog /Pages 2 0 R >>\n")]);
    obj(2, [enc("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n")]);
    obj(3, [
      enc(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n"
      ),
    ]);
    obj(4, [
      enc(
        `<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      ),
      jpeg,
      enc("\nendstream\n"),
    ]);
    const content = enc("q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n");
    obj(5, [enc(`<< /Length ${content.length} >>\nstream\n`), content, enc("endstream\n")]);
    const xref = len;
    let x = "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i++) x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    add(enc(x));
    add(enc(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    const out = new Uint8Array(len);
    let p = 0;
    chunks.forEach((c) => {
      out.set(c, p);
      p += c.length;
    });
    return out;
  }

  function printCalib() {
    const rows = currentRows().slice(0, Math.min(500, Math.round(state.fs * 5)));
    const mean = (k) => (rows.length ? rows.reduce((s, r) => s + r[k], 0) / rows.length : NaN);
    const fit = state.fit;
    const cal = state.sixCalib;
    const b = cal ? cal.bias : null,
      sc = cal ? cal.scale : null,
      q = cal ? cal.quality : null;
    const faces = state.sixFace || {};
    const faceRows = Object.keys(faces)
      .map(
        (k) =>
          `<tr><td>${k}</td><td>${faces[k].x.toFixed(3)}</td><td>${faces[k].y.toFixed(3)}</td><td>${faces[k].z.toFixed(3)}</td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>IMU 标定报告</title><style>
body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;max-width:900px;margin:32px auto;padding:0 20px;color:#1b1d22;background:#f4f2ec}h1{font-size:26px}h2{font-size:16px;margin-top:26px;border-bottom:1px solid #d8d3c7;padding-bottom:4px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #d8d3c7;padding:5px 6px;text-align:left}code{background:#e9e5dc;padding:1px 4px}.muted{color:#6f6a61;font-size:12px}</style></head><body>
<h1>IMU 标定报告</h1><p class="muted">vibe-lab · 教学报告，不是认证标定 · ${new Date().toLocaleString()}</p>
<h2>数据</h2><p>来源：${state.source} · 采样率：${state.fs} Hz · 有效帧：${rows.length}</p>
<h2>陀螺零偏（前 5 s 均值）</h2><p><code>gx=${mean("gx").toFixed(3)} · gy=${mean("gy").toFixed(3)} · gz=${mean("gz").toFixed(3)} °/s</code></p>
<h2>Allan / Kalman</h2><p>ARW：${fit ? fit.arw.toFixed(3) : "—"} · RRW：${fit ? fit.rrw.toFixed(3) : "—"} · R²：${fit ? fit.r2.toFixed(3) : "—"}<br>R=${state.r.toExponential(2)} · Q=${state.q.toExponential(2)}</p>
<h2>温度漂移</h2><p>${state.tempFit ? `斜率：gx ${state.tempFit.gx.k.toExponential(2)} · gy ${state.tempFit.gy.k.toExponential(2)} · gz ${state.tempFit.gz.k.toExponential(2)}` : "未拟合。"}</p>
<h2>六面标定</h2>${cal ? `<p>等级：<b>${cal.grade || "—"}</b> · |a| ${q.normMean.toFixed(3)} ± ${q.normStd.toFixed(3)} g · RMS ${q.rmsError.toFixed(3)} g</p><p>bias = [${b.x.toFixed(3)}, ${b.y.toFixed(3)}, ${b.z.toFixed(3)}] g<br>scale = [${sc.x.toFixed(3)}, ${sc.y.toFixed(3)}, ${sc.z.toFixed(3)}]</p><table><thead><tr><th>面</th><th>ax</th><th>ay</th><th>az</th></tr></thead><tbody>${faceRows}</tbody></table>` : "<p>未完成六面标定。</p>"}
<h2>互补滤波</h2>${svgMarkup($("chart-fusion"))}
<p class="muted">打印时选择“另存为 PDF”。</p></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  }

  function syncURL() {
    const p = new URLSearchParams();
    p.set("r", Math.log10(state.r).toFixed(2));
    p.set("q", Math.log10(state.q).toFixed(2));
    p.set("ch", state.channel);
    p.set("fs", String(state.fs));
    try {
      history.replaceState(null, "", location.pathname + "?" + p.toString());
    } catch (e) {
      /* file:// */
    }
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
      if (isFinite(fs) && fs > 0) {
        state.fs = fs;
        $("fs").value = fs;
      }
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
        panel.addEventListener(ev, (e) => {
          e.preventDefault();
          panel.classList.add("dragging");
        })
      );
      ["dragleave", "drop"].forEach((ev) =>
        panel.addEventListener(ev, (e) => {
          e.preventDefault();
          panel.classList.remove("dragging");
        })
      );
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
    bindSlider("logR", "r-val", (e) => {
      state.r = Math.pow(10, e);
    });
    bindSlider("logQ", "q-val", (e) => {
      state.q = Math.pow(10, e);
    });

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
      if (!rows.length) {
        flash("映射后没有有效数据");
        return;
      }
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
    $("export-calib").addEventListener("click", exportCalib);
    $("save-project").addEventListener("click", saveCalibrationProject);
    $("export-calib-pdf").addEventListener("click", printCalib);
    $("download-calib-pdf").addEventListener("click", downloadCalibPDF);
    $("export-fusion").addEventListener("click", exportFusion);
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

  function drawFusion() {
    const el = $("chart-fusion");
    if (!el) return;
    const alpha = Number($("fusion-alpha").value) || 0.02;
    $("fusion-alpha-val").textContent = alpha.toFixed(3);
    let real = state.fusionRows;
    if (!real) {
      const main = currentRows().filter((r) => Number.isFinite(r.ax) && Number.isFinite(r.ay) && Number.isFinite(r.az));
      if (main.length > 20) real = main;
    }
    let t = [],
      truth = [],
      gyroRaw = [],
      acc = [],
      fused = [],
      integrated = [];
    if (real && real.length > 20) {
      const dt = Math.max(1e-4, real[1].t - real[0].t || 0.01);
      let angle = 0,
        gyroAngle = 0;
      for (const row of real) {
        const g = row.gx;
        const a = (Math.atan2(row.ay, row.az) * 180) / Math.PI;
        gyroAngle += g * dt;
        angle = (1 - alpha) * (angle + g * dt) + alpha * a;
        t.push(row.t);
        gyroRaw.push(gyroAngle);
        acc.push(a);
        fused.push(angle);
        integrated.push(gyroAngle);
      }
      $("fusion-source").textContent = state.fusionRows
        ? T("当前：真实融合 CSV · gx + ay/az 倾角", "Current: real fusion CSV · gx + ay/az tilt")
        : T("当前：主数据 · gx + ay/az 倾角", "Current: main data · gx + ay/az tilt");
    } else {
      const rnd = mulberry32(7);
      const dt = 0.02,
        n = 1500;
      let angle = 0,
        gyroAngle = 0;
      for (let i = 0; i < n; i++) {
        const x = i * dt;
        const th = 22 * Math.sin(0.28 * x) + 7 * Math.sin(1.25 * x);
        const dth = 22 * 0.28 * Math.cos(0.28 * x) + 7 * 1.25 * Math.cos(1.25 * x);
        const g = dth + 0.8 + gauss(rnd) * 0.45;
        const a = th + gauss(rnd) * 1.8;
        gyroAngle += g * dt;
        angle = (1 - alpha) * (angle + g * dt) + alpha * a;
        t.push(x);
        truth.push(th);
        gyroRaw.push(gyroAngle);
        acc.push(a);
        fused.push(angle);
        integrated.push(gyroAngle);
      }
      $("fusion-source").textContent = T("当前：合成演示数据", "Current: synthetic demo data");
    }
    const w = 800,
      h = 240,
      m = { l: 48, r: 12, t: 14, b: 26 };
    const all = truth.concat(integrated, fused, acc);
    const lo = Math.min(...all),
      hi = Math.max(...all);
    const pad = (hi - lo || 1) * 0.12;
    const yMin = lo - pad,
      yMax = hi + pad;
    const sx = (x) => m.l + (x / (t[t.length - 1] || 1)) * (w - m.l - m.r);
    const sy = (v) => m.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (h - m.t - m.b);
    const path = (arr) => arr.map((v, i) => (i ? "L" : "M") + sx(t[i]).toFixed(1) + "," + sy(v).toFixed(1)).join(" ");
    let grid = "";
    for (let k = 0; k <= 3; k++) {
      const v = yMin + ((yMax - yMin) * k) / 3;
      grid +=
        '<line x1="' +
        m.l +
        '" y1="' +
        sy(v).toFixed(1) +
        '" x2="' +
        (w - m.r) +
        '" y2="' +
        sy(v).toFixed(1) +
        '" style="stroke:var(--grid)"/><text x="' +
        (m.l - 6) +
        '" y="' +
        (sy(v) + 3).toFixed(1) +
        '" text-anchor="end" style="fill:var(--muted);font:9px var(--mono)">' +
        v.toFixed(0) +
        "</text>";
    }
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="互补滤波姿态估计">
      ${grid}
      ${truth.length ? `<path d="${path(truth)}" fill="none" style="stroke:var(--line);stroke-width:1;opacity:.8"/>` : ""}
      <path d="${path(integrated)}" fill="none" style="stroke:var(--chart-2);stroke-width:1;opacity:.65"/>
      <path d="${path(acc)}" fill="none" style="stroke:var(--chart-3);stroke-width:.9;opacity:.5"/>
      <path d="${path(fused)}" fill="none" style="stroke:var(--chart-1);stroke-width:1.8"/>
      <text x="${m.l}" y="${m.t + 10}" style="fill:var(--muted);font:9px var(--mono)">${truth.length ? "truth" : "acc"} / gyro integration / complementary</text>
    </svg>`;
  }

  function initCalib() {
    const btn = $("calib");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const rows = currentRows().slice(0, Math.min(500, Math.round(state.fs * 5)));
      if (!rows.length) return;
      const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
      $("calib-info").textContent =
        `gx=${mean("gx").toFixed(3)} · gy=${mean("gy").toFixed(3)} · gz=${mean("gz").toFixed(3)} °/s（前 ${rows.length} 帧）`;
    });
  }

  function saveCalibLocal() {
    try {
      localStorage.setItem(
        CALIB_KEY,
        JSON.stringify({
          sixFace: state.sixFace,
          sixCalib: state.sixCalib,
          gyroScale: state.gyroScale,
          tempPoints: state.tempPoints,
          tempFit: state.tempFit,
        })
      );
    } catch (e) {}
  }

  function loadCalibLocal() {
    try {
      const d = JSON.parse(localStorage.getItem(CALIB_KEY) || "null");
      if (!d) return;
      state.sixFace = d.sixFace || {};
      state.sixCalib = d.sixCalib || null;
      state.gyroScale = d.gyroScale || {};
      state.tempPoints = d.tempPoints || [];
      state.tempExcluded = new Set(d.tempExcluded || []);
      state.tempFit = d.tempFit || null;
      const labels = { px: "+X", nx: "−X", py: "+Y", ny: "−Y", pz: "+Z", nz: "−Z" };
      Object.keys(state.sixFace).forEach((k) => {
        document.querySelectorAll("#six-grid button").forEach((b) => {
          if (b.textContent === labels[k]) b.classList.add("done");
        });
      });
      if (Object.keys(state.gyroScale).length)
        $("gyro-info").textContent = `已加载：${Object.entries(state.gyroScale)
          .map(([a, v]) => `${a}=${Number(v).toFixed(4)}`)
          .join(" · ")}`;
      if (state.sixCalib) {
        $("six-apply").disabled = false;
        const b = state.sixCalib.bias,
          sc = state.sixCalib.scale,
          q = state.sixCalib.quality;
        if (b && sc && q)
          $("six-result").textContent =
            `[已加载] [${state.sixCalib.grade || "—"}] bias = [${b.x.toFixed(3)}, ${b.y.toFixed(3)}, ${b.z.toFixed(3)}] · |a| ${q.normMean.toFixed(3)} g · RMS ${q.rmsError.toFixed(3)} g`;
      }
    } catch (e) {}
  }

  function initSixFace() {
    const grid = $("six-grid");
    if (!grid) return;
    const faces = [
      ["px", "+X"],
      ["nx", "−X"],
      ["py", "+Y"],
      ["ny", "−Y"],
      ["pz", "+Z"],
      ["nz", "−Z"],
    ];
    grid.innerHTML = "";
    faces.forEach(([key, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", () => {
        const rows = currentRows()
          .filter((r) => Number.isFinite(r.ax) && Number.isFinite(r.ay) && Number.isFinite(r.az))
          .slice(0, Math.min(500, Math.round(state.fs * 2)));
        if (!rows.length) {
          $("six-result").textContent = "当前数据没有 ax/ay/az，先加载带加速度的 CSV。";
          return;
        }
        const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
        state.sixFace[key] = { x: mean("ax"), y: mean("ay"), z: mean("az") };
        b.classList.add("done");
        $("six-result").textContent = `已采集 ${label}：${rows.length} 帧`;
      });
      grid.appendChild(b);
    });
    $("six-calc").addEventListener("click", () => {
      try {
        state.sixCalib = IMUData.sixFace(state.sixFace);
        state.sixCalib.quality = IMUData.sixQuality(state.sixFace, state.sixCalib);
        state.sixCalib.grade = IMUData.sixQualityGrade(state.sixCalib.quality);
        state.sixCalib.before = IMUData.sixQuality(state.sixFace, {
          bias: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        });
        state.sixCalib.beforeGrade = IMUData.sixQualityGrade(state.sixCalib.before);
        $("six-apply").disabled = false;
        const b = state.sixCalib.bias,
          sc = state.sixCalib.scale,
          q = state.sixCalib.quality;
        $("six-result").textContent =
          `[${state.sixCalib.beforeGrade} → ${state.sixCalib.grade}] 最差面 ${q.perFace[0].face} ${q.perFace[0].error.toFixed(3)}g · bias = [${b.x.toFixed(3)}, ${b.y.toFixed(3)}, ${b.z.toFixed(3)}] g · scale = [${sc.x.toFixed(3)}, ${sc.y.toFixed(3)}, ${sc.z.toFixed(3)}] · |a| ${q.normMean.toFixed(3)}±${q.normStd.toFixed(3)} g · RMS ${q.rmsError.toFixed(3)} g`;
        saveCalibLocal();
        flash("六面标定完成并已保存到本机");
      } catch (e) {
        $("six-result").textContent = "还缺面：" + e.message;
      }
    });
    $("six-apply").addEventListener("click", () => {
      if (!state.sixCalib) return;
      if (state.accelBackup) {
        state.rows.forEach((r, i) => {
          const b = state.accelBackup[i];
          if (b) {
            r.ax = b.ax;
            r.ay = b.ay;
            r.az = b.az;
          }
        });
        state.accelBackup = null;
        $("six-apply").textContent = "应用标定";
        $("six-result").textContent = "已撤销六面标定";
      } else {
        state.accelBackup = state.rows.map((r) => ({ ax: r.ax, ay: r.ay, az: r.az }));
        state.rows.forEach((r) => {
          if (Number.isFinite(r.ax) && Number.isFinite(r.ay) && Number.isFinite(r.az)) {
            const v = IMUData.correctSix(state.sixCalib, r.ax, r.ay, r.az);
            r.ax = v[0];
            r.ay = v[1];
            r.az = v[2];
          }
        });
        $("six-apply").textContent = "撤销标定";
        $("six-result").textContent = "已应用六面标定（3×3 矩阵）";
      }
      prepare();
      draw();
      drawFusion();
      saveCalibLocal();
    });
    $("six-export").addEventListener("click", () => {
      const data = {
        faces: state.sixFace,
        result: state.sixCalib,
        gyroScale: state.gyroScale,
        note: "six-face static calibration, teaching use",
      };
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "imu_six_face.json");
      flash("六面 JSON 已导出");
    });

    $("six-batch").addEventListener("change", async (ev) => {
      const files = Array.from(ev.target.files || []);
      if (!files.length) return;
      const info = $("six-batch-info");
      info.textContent = `读取 ${files.length} 个文件…`;
      const labels = { px: "+X", nx: "−X", py: "+Y", ny: "−Y", pz: "+Z", nz: "−Z" };
      const found = [];
      for (const file of files) {
        try {
          const text = await file.text();
          const m = IMUData.accelMean(text);
          if (!m) {
            found.push(`${file.name}: 缺少 ax/ay/az`);
            continue;
          }
          const vals = [Math.abs(m.ax), Math.abs(m.ay), Math.abs(m.az)].sort((a, b) => b - a);
          if (vals[0] < 0.5 || vals[1] / vals[0] > 0.6) {
            found.push(`${file.name}: 方向不明确，跳过`);
            continue;
          }
          const key = IMUData.detectFace(m);
          if (state.sixFace[key]) {
            found.push(`${file.name}: ${labels[key]} 与已有方向冲突，跳过`);
            continue;
          }
          state.sixFace[key] = { x: m.ax, y: m.ay, z: m.az };
          found.push(`${file.name} → ${labels[key]}`);
          grid.querySelectorAll("button").forEach((b) => {
            if (b.textContent === labels[key]) b.classList.add("done");
          });
        } catch (e) {
          found.push(`${file.name}: 读取失败`);
        }
      }
      info.textContent = found.join("；");
      if (Object.keys(state.sixFace).length >= 6) $("six-calc").click();
    });

    $("six-reset").addEventListener("click", () => {
      state.sixFace = {};
      state.sixCalib = null;
      grid.querySelectorAll("button").forEach((b) => b.classList.remove("done"));
      $("six-result").textContent = "";
      try {
        localStorage.removeItem(CALIB_KEY);
      } catch (e) {}
    });
    loadCalibLocal();
  }

  function initGyroScale() {
    const capture = $("gyro-capture");
    if (!capture) return;
    $("gyro-axis").addEventListener("change", () => {
      $("gyro-three-fields").hidden = $("gyro-axis").value !== "all";
    });
    capture.addEventListener("click", () => {
      const rows = currentRows().slice(0, Math.min(500, Math.round(state.fs * 2)));
      const axis = $("gyro-axis").value;
      if (!rows.length) return;
      const mean = (a) => rows.reduce((s, r) => s + r[a], 0) / rows.length;
      try {
        if (axis === "all") {
          const gains = [];
          for (const a of ["gx", "gy", "gz"]) {
            const known = Number($(`gyro-known-${a}`).value);
            if (!(known > 0)) continue;
            const f = IMUData.gyroScale(mean(a), known);
            state.gyroScale[a] = f;
            gains.push(`${a}=${f.toFixed(4)}`);
          }
          if (!gains.length) throw new Error("至少输入一个已知角速度");
          $("gyro-info").textContent = `三轴：${gains.join(" · ")}`;
        } else {
          const known = Number($("gyro-known").value);
          const f = IMUData.gyroScale(mean(axis), known);
          state.gyroScale[axis] = f;
          $("gyro-info").textContent =
            `${axis.toUpperCase()} 实测 ${mean(axis).toFixed(3)} °/s / 已知 ${known.toFixed(1)} °/s → scale ${f.toFixed(4)}`;
        }
        saveCalibLocal();
      } catch (e) {
        $("gyro-info").textContent = e.message;
      }
    });
    $("gyro-apply").addEventListener("click", () => {
      if ($("gyro-apply").textContent === "撤销刻度" && state.gyroBackup) {
        state.rows.forEach((r, i) => {
          const b = state.gyroBackup[i];
          if (b) {
            r.gx = b.gx;
            r.gy = b.gy;
            r.gz = b.gz;
          }
        });
        state.gyroBackup = null;
        $("gyro-apply").textContent = "应用刻度";
        $("gyro-info").textContent = "已撤销陀螺刻度";
      } else {
        const axes = Object.keys(state.gyroScale);
        if (!axes.length) {
          $("gyro-info").textContent = "先采集至少一个轴。";
          return;
        }
        state.gyroBackup = state.rows.map((r) => ({ gx: r.gx, gy: r.gy, gz: r.gz }));
        state.rows.forEach((r) =>
          axes.forEach((a) => {
            if (state.gyroScale[a]) r[a] /= state.gyroScale[a];
          })
        );
        $("gyro-apply").textContent = "撤销刻度";
        $("gyro-info").textContent = `已应用：${axes.map((a) => `${a}=${state.gyroScale[a].toFixed(4)}`).join(" · ")}`;
      }
      prepare();
      draw();
      saveCalibLocal();
    });
  }

  function renderTempPoints() {
    const box = $("temp-points");
    if (!box) return;
    if (!state.tempPoints) state.tempPoints = [];
    if (!state.tempExcluded) state.tempExcluded = new Set();
    box.innerHTML = "";
    state.tempPoints
      .map((p, i) => ({ p, i }))
      .sort((a, b) => a.p.T - b.p.T)
      .forEach(({ p, i }) => {
        const row = document.createElement("label");
        row.className = "temp-point" + (state.tempExcluded.has(i) ? " excluded" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !state.tempExcluded.has(i);
        cb.addEventListener("change", () => {
          if (cb.checked) state.tempExcluded.delete(i);
          else state.tempExcluded.add(i);
          row.classList.toggle("excluded", !cb.checked);
          saveCalibLocal();
          $("temp-info").textContent = "已修改参与拟合的点，请重新拟合。";
        });
        row.appendChild(cb);
        row.appendChild(
          document.createTextNode(
            `T=${p.T.toFixed(1)}°C · gx=${p.gx.toFixed(3)} gy=${p.gy.toFixed(3)} gz=${p.gz.toFixed(3)}`
          )
        );
        box.appendChild(row);
      });
  }

  function initTempCal() {
    const cap = $("temp-capture");
    if (!cap) return;
    cap.addEventListener("click", () => {
      const rows = currentRows().slice(0, Math.min(500, Math.round(state.fs * 2)));
      if (!rows.length) return;
      const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
      const tempRows = rows.filter((r) => Number.isFinite(r.temp));
      const T = tempRows.length
        ? tempRows.reduce((s, r) => s + r.temp, 0) / tempRows.length
        : Number($("temp-now").value);
      if (!Number.isFinite(T)) return;
      const p = { T, gx: mean("gx"), gy: mean("gy"), gz: mean("gz") };
      const i = state.tempPoints.findIndex((x) => Math.abs(x.T - T) < 1e-6);
      if (i >= 0) state.tempPoints[i] = p;
      else state.tempPoints.push(p);
      renderTempPoints();
      $("temp-info").textContent = `已采集 ${T.toFixed(1)}°C，共 ${state.tempPoints.length} 个点。`;
      saveCalibLocal();
    });
    $("temp-batch").addEventListener("change", async (ev) => {
      const files = Array.from(ev.target.files || []);
      if (!files.length) return;
      const notes = [];
      for (const file of files) {
        try {
          const p = IMUData.tempPoint(await file.text());
          if (!p) {
            notes.push(`${file.name}: 缺少 gx/gy/gz/temp`);
            continue;
          }
          const i = state.tempPoints.findIndex((x) => Math.abs(x.T - p.T) < 1e-6);
          const point = { T: p.T, gx: p.gx, gy: p.gy, gz: p.gz };
          if (i >= 0) state.tempPoints[i] = point;
          else state.tempPoints.push(point);
          notes.push(`${file.name}: T=${p.T.toFixed(1)}°C`);
        } catch (e) {
          notes.push(`${file.name}: 读取失败`);
        }
      }
      renderTempPoints();
      $("temp-info").textContent = notes.join("；");
      saveCalibLocal();
    });
    $("temp-segment").addEventListener("click", () => {
      const segs = IMUData.tempSegments(currentRows(), {
        threshold: 0.6,
        minSamples: Math.max(5, Math.round(state.fs * 2)),
      });
      if (!segs.length) {
        $("temp-info").textContent = "没有检测到温度平台（需要 temp 列）。";
        return;
      }
      segs.forEach((p) => {
        const i = state.tempPoints.findIndex((x) => Math.abs(x.T - p.T) < 1e-6);
        const point = { T: p.T, gx: p.gx, gy: p.gy, gz: p.gz };
        if (i >= 0) state.tempPoints[i] = point;
        else state.tempPoints.push(point);
      });
      renderTempPoints();
      $("temp-info").textContent = `自动切出 ${segs.length} 个温度平台，共 ${state.tempPoints.length} 个点。`;
      saveCalibLocal();
    });
    $("temp-fit").addEventListener("click", () => {
      const usedPoints = state.tempPoints.filter((_, i) => !state.tempExcluded.has(i));
      if (usedPoints.length < 2) {
        $("temp-info").textContent = "至少需要两个未剔除的温度点。";
        return;
      }
      try {
        state.tempFit = IMUData.robustTempBias(usedPoints, usedPoints[0].T);
        state.tempFit.outliers.forEach((p) => {
          const idx = state.tempPoints.indexOf(p);
          if (idx >= 0) state.tempExcluded.add(idx);
        });
        renderTempPoints();
        $("temp-info").textContent =
          `斜率 °/s/°C：gx ${state.tempFit.gx.k.toExponential(2)} · gy ${state.tempFit.gy.k.toExponential(2)} · gz ${state.tempFit.gz.k.toExponential(2)}`;
        saveCalibLocal();
      } catch (e) {
        $("temp-info").textContent = e.message;
      }
    });
    $("temp-apply").addEventListener("click", () => {
      if (!state.tempFit) {
        $("temp-info").textContent = "先拟合温度模型。";
        return;
      }
      if (state.tempBackup) {
        state.rows.forEach((r, i) => {
          const b = state.tempBackup[i];
          if (b) {
            r.gx = b.gx;
            r.gy = b.gy;
            r.gz = b.gz;
          }
        });
        state.tempBackup = null;
        $("temp-apply").textContent = "应用温补";
        $("temp-info").textContent = "已撤销温补";
      } else {
        const T = Number($("temp-now").value);
        const bias = IMUData.tempBiasAt(state.tempFit, T);
        state.tempBackup = state.rows.map((r) => ({ gx: r.gx, gy: r.gy, gz: r.gz }));
        state.rows.forEach((r) => {
          r.gx -= bias.gx;
          r.gy -= bias.gy;
          r.gz -= bias.gz;
        });
        $("temp-apply").textContent = "撤销温补";
        $("temp-info").textContent =
          `已应用 ${T.toFixed(1)}°C 温补：gx ${bias.gx.toFixed(3)} · gy ${bias.gy.toFixed(3)} · gz ${bias.gz.toFixed(3)} °/s`;
      }
      prepare();
      draw();
      saveCalibLocal();
    });
    $("combined-apply").addEventListener("click", () => {
      if (!state.sixCalib || !state.tempFit) {
        $("temp-info").textContent = "需要先完成六面标定和温度拟合。";
        return;
      }
      if (state.combinedBackup) {
        state.rows.forEach((r, i) => {
          const b = state.combinedBackup[i];
          if (b) {
            r.gx = b.gx;
            r.gy = b.gy;
            r.gz = b.gz;
            r.ax = b.ax;
            r.ay = b.ay;
            r.az = b.az;
          }
        });
        state.combinedBackup = null;
        $("combined-apply").textContent = "联合应用";
        $("temp-info").textContent = "已撤销联合补偿";
      } else {
        const T0 = Number($("temp-now").value);
        state.combinedBackup = state.rows.map((r) => ({ gx: r.gx, gy: r.gy, gz: r.gz, ax: r.ax, ay: r.ay, az: r.az }));
        state.rows.forEach((r) => {
          if (Number.isFinite(r.ax) && Number.isFinite(r.ay) && Number.isFinite(r.az)) {
            const v = IMUData.correctSix(state.sixCalib, r.ax, r.ay, r.az);
            r.ax = v[0];
            r.ay = v[1];
            r.az = v[2];
          }
          const t = Number.isFinite(r.temp) ? r.temp : T0;
          const b = IMUData.tempBiasAt(state.tempFit, t);
          r.gx -= b.gx;
          r.gy -= b.gy;
          r.gz -= b.gz;
        });
        $("combined-apply").textContent = "撤销联合";
        $("temp-info").textContent = "已按六面矩阵 + 温度模型联合补偿";
      }
      prepare();
      draw();
      drawFusion();
      saveCalibLocal();
    });

    $("temp-clear").addEventListener("click", () => {
      if (state.tempBackup) {
        state.rows.forEach((r, i) => {
          const b = state.tempBackup[i];
          if (b) {
            r.gx = b.gx;
            r.gy = b.gy;
            r.gz = b.gz;
          }
        });
        state.tempBackup = null;
        prepare();
        draw();
      }
      state.tempPoints = [];
      state.tempFit = null;
      renderTempPoints();
      $("temp-info").textContent = "至少需要两个温度点。";
      saveCalibLocal();
    });
    renderTempPoints();
  }

  function initFusion() {
    const a = $("fusion-alpha");
    if (!a) return;
    a.addEventListener("input", drawFusion);
    $("fusion-file").addEventListener("change", (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const lines = String(reader.result)
          .split(/\r?\n/)
          .filter((l) => l.trim());
        const head = (lines[0] || "").split(",").map((x) => x.trim().toLowerCase());
        const ix = (names) => head.findIndex((h) => names.includes(h));
        const iT = ix(["t", "time", "timestamp"]),
          iG = ix(["gx", "gx_dps", "gyro_x"]);
        const iAy = ix(["ay", "ay_g", "accel_y"]),
          iAz = ix(["az", "az_g", "accel_z"]);
        if (iT < 0 || iG < 0 || iAy < 0 || iAz < 0) {
          flash("融合 CSV 需要 t,gx,ay,az 列");
          return;
        }
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const c = lines[i].split(",");
          const t = Number(c[iT]),
            gx = Number(c[iG]),
            ay = Number(c[iAy]),
            az = Number(c[iAz]);
          if ([t, gx, ay, az].every(isFinite)) rows.push({ t, gx, ay, az });
        }
        state.fusionRows = rows;
        drawFusion();
        flash(`已加载 ${rows.length} 行融合数据`);
      };
      reader.readAsText(file);
    });
    drawFusion();
  }

  function sendModelToLab() {
    if (!window.VibeProject) {
      flash("项目模块未加载");
      return;
    }
    const rows = currentRows();
    if (!rows.length) {
      flash("没有数据");
      return;
    }
    const t = [],
      u = [],
      y = [];
    let angle = 0;
    for (const r of rows) {
      t.push(r.t);
      u.push(r[state.channel]);
      angle += r[state.channel] / state.fs;
      y.push(angle);
    }
    try {
      window.VibeProject.handoff({
        kind: "dataset",
        source: "IMU " + state.channel,
        dataset: { t, u, y, meta: { units: { u: "°/s", y: "deg" }, source: "imu" } },
      });
      location.href = location.pathname.includes("/imu-lab/") ? "../model-lab/static/index.html" : "../model/";
    } catch (e) {
      flash("数据过大，无法送到 Model Lab");
    }
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
      try {
        parseWorker = new Worker("data-worker.js");
        parseWorker.onerror = () => {
          parseWorker = null;
        };
      } catch (e) {
        parseWorker = null;
      }
      try {
        kfWorker = new Worker("kf-worker.js");
        kfWorker.onmessage = onKFReply;
        kfWorker.onerror = () => {
          kfWorker = null;
          kfRateKey = "";
          drawKF();
        };
      } catch (e) {
        kfWorker = null;
      }
    }
    loadURL();
    state.rows = synth();
    bind();
    prepare();
    draw();
    initFusion();
    initCalib();
    initSixFace();
    initGyroScale();
    initTempCal();
    if ($("send-model")) $("send-model").addEventListener("click", sendModelToLab);
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", draw);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
