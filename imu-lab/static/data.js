/* 列式数据层：解析、清洗掩码、统计、Allan、KF、CSV 导出（浏览器/Node 通用） */
(function (root) {
  "use strict";

  const AXES = ["gx", "gy", "gz"];
  const ALIASES = {
    t: ["t", "time", "timestamp", "sec", "seconds"],
    gx: ["gx_dps", "gx", "gyro_x", "gyrox", "gx_deg_s"],
    gy: ["gy_dps", "gy", "gyro_y", "gyroy", "gy_deg_s"],
    gz: ["gz_dps", "gz", "gyro_z", "gyroz", "gz_deg_s"],
    ax: ["ax", "ax_g", "accel_x"],
    ay: ["ay", "ay_g", "accel_y"],
    az: ["az", "az_g", "accel_z"],
    crc: ["crc_ok", "crc", "crcok"],
  };

  function headerIndex(line) {
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
    const idx = {
      t: pick(ALIASES.t),
      gx: pick(ALIASES.gx),
      gy: pick(ALIASES.gy),
      gz: pick(ALIASES.gz),
      ax: pick(ALIASES.ax),
      ay: pick(ALIASES.ay),
      az: pick(ALIASES.az),
      crc: pick(ALIASES.crc),
    };
    const raw = line.split(",").map((s) => s.trim());
    const looksHeader = raw.some((v) => v !== "" && !isFinite(Number(v)));
    if (looksHeader && (idx.gx < 0 || idx.gy < 0 || idx.gz < 0)) return null;
    let start = 1;
    if (idx.gx < 0 || idx.gy < 0 || idx.gz < 0) {
      idx.gx = 1;
      idx.gy = 2;
      idx.gz = 3;
      idx.crc = 4;
      idx.t = idx.t >= 0 ? idx.t : 0;
      start = 0;
    }
    return { idx, start };
  }

  function parseText(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return null;
    const h = headerIndex(lines[0]);
    if (!h) return null;
    return parseLines(lines, h.idx, h.start);
  }

  function parseWithMapping(text, map) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) return null;
    return parseLines(
      lines,
      {
        t: -1,
        gx: map.gx,
        gy: map.gy,
        gz: map.gz,
        ax: map.ax != null ? map.ax : -1,
        ay: map.ay != null ? map.ay : -1,
        az: map.az != null ? map.az : -1,
        crc: -1,
      },
      1
    );
  }

  function parseLines(lines, idx, start) {
    const n = Math.max(0, lines.length - start);
    const t = new Float64Array(n);
    const gx = new Float32Array(n),
      gy = new Float32Array(n),
      gz = new Float32Array(n);
    const ax = new Float32Array(n).fill(NaN),
      ay = new Float32Array(n).fill(NaN),
      az = new Float32Array(n).fill(NaN);
    const crc = new Uint8Array(n);
    let k = 0;
    for (let i = start; i < lines.length; i++) {
      const c = lines[i].split(",");
      const a = Number(c[idx.gx]),
        b = Number(c[idx.gy]),
        d = Number(c[idx.gz]);
      if (!isFinite(a) || !isFinite(b) || !isFinite(d)) continue;
      gx[k] = a;
      gy[k] = b;
      gz[k] = d;
      if (idx.ax >= 0) ax[k] = Number(c[idx.ax]);
      if (idx.ay >= 0) ay[k] = Number(c[idx.ay]);
      if (idx.az >= 0) az[k] = Number(c[idx.az]);
      t[k] = idx.t >= 0 ? Number(c[idx.t]) : NaN;
      crc[k] = idx.crc >= 0 ? Number(c[idx.crc]) : 1;
      k++;
    }
    return {
      t: t.subarray(0, k),
      gx: gx.subarray(0, k),
      gy: gy.subarray(0, k),
      gz: gz.subarray(0, k),
      ax: ax.subarray(0, k),
      ay: ay.subarray(0, k),
      az: az.subarray(0, k),
      hasAccel: idx.ax >= 0 && idx.ay >= 0 && idx.az >= 0,
      crc: crc.subarray(0, k),
      n: k,
    };
  }

  function fromRows(rows) {
    const n = rows.length;
    const cols = {
      t: new Float64Array(n),
      gx: new Float32Array(n),
      gy: new Float32Array(n),
      gz: new Float32Array(n),
      ax: new Float32Array(n).fill(NaN),
      ay: new Float32Array(n).fill(NaN),
      az: new Float32Array(n).fill(NaN),
      hasAccel: rows.some((r) => Number.isFinite(r.ax) && Number.isFinite(r.ay) && Number.isFinite(r.az)),
      crc: new Uint8Array(n),
      n,
    };
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      cols.t[i] = r.t;
      cols.gx[i] = r.gx;
      cols.gy[i] = r.gy;
      cols.gz[i] = r.gz;
      if (cols.hasAccel) {
        cols.ax[i] = r.ax;
        cols.ay[i] = r.ay;
        cols.az[i] = r.az;
      }
      cols.crc[i] = r.crc === 1 ? 1 : 0;
    }
    return cols;
  }

  function toRows(cols) {
    const rows = new Array(cols.n);
    for (let i = 0; i < cols.n; i++) {
      rows[i] = { t: cols.t[i], gx: cols.gx[i], gy: cols.gy[i], gz: cols.gz[i], crc: cols.crc[i] };
      if (cols.hasAccel) {
        rows[i].ax = cols.ax[i];
        rows[i].ay = cols.ay[i];
        rows[i].az = cols.az[i];
      }
    }
    return rows;
  }

  function cleanMask(cols, maxAbs = 5) {
    const m = new Uint8Array(cols.n);
    for (let i = 0; i < cols.n; i++) {
      m[i] =
        cols.crc[i] === 1 &&
        Math.abs(cols.gx[i]) <= maxAbs &&
        Math.abs(cols.gy[i]) <= maxAbs &&
        Math.abs(cols.gz[i]) <= maxAbs
          ? 1
          : 0;
    }
    return m;
  }

  function stats(cols, mask) {
    const means = {};
    for (const k of AXES) {
      let sum = 0,
        cnt = 0;
      for (let i = 0; i < cols.n; i++)
        if (mask[i]) {
          sum += cols[k][i];
          cnt++;
        }
      means[k] = cnt ? sum / cnt : 0;
    }
    return {
      frames: cols.n,
      bad: cols.n - mask.reduce((a, b) => a + b, 0),
      duration: cols.n > 1 ? cols.t[cols.n - 1] - cols.t[0] : 0,
      means,
    };
  }

  function allan(cols, axis, fs, mask, compute) {
    const x = cols[axis];
    const arr = [];
    for (let i = 0; i < cols.n; i++) if (!mask || mask[i]) arr.push(x[i]);
    return (compute || root.IMUAllan.allanDeviation)(arr, 1 / fs);
  }

  function kf(cols, axis, fs, mask, r, q) {
    const x = cols[axis];
    const rate = [];
    for (let i = 0; i < cols.n; i++) if (!mask || mask[i]) rate.push(x[i]);
    const angle = root.IMUKF.integrate(rate, fs);
    const filtered = root.IMUKF.kf1d(angle, r, q, angle[0], 1);
    return { angle, filtered };
  }

  function csv(cols, mask, ch, fs, r, q) {
    const { angle, filtered } = kf(cols, ch, fs, mask, r, q);
    const lines = ["t,gx_dps,gy_dps,gz_dps,angle_deg,kf_deg"];
    let j = 0;
    for (let i = 0; i < cols.n; i++) {
      if (mask && !mask[i]) continue;
      lines.push(
        [
          cols.t[i].toFixed(4),
          cols.gx[i].toFixed(6),
          cols.gy[i].toFixed(6),
          cols.gz[i].toFixed(6),
          (angle[j] - angle[0]).toFixed(6),
          (filtered[j] - filtered[0]).toFixed(6),
        ].join(",")
      );
      j++;
    }
    return "\ufeff" + lines.join("\n");
  }

  /* 单位/坐标系经验校验：返回警告列表（不阻断使用） */
  function validate(rows, fs) {
    const warns = [];
    if (!(fs > 0) || fs > 1e6) warns.push("采样率异常，请检查采样率设置");
    const n = Math.min(rows.length, 3000);
    if (n > 5) {
      const mags = { gx: [], gy: [], gz: [] };
      for (let i = 0; i < n; i++) {
        const r = rows[i];
        mags.gx.push(Math.abs(r.gx));
        mags.gy.push(Math.abs(r.gy));
        mags.gz.push(Math.abs(r.gz));
      }
      const med = (a) => {
        a.sort((x, y) => x - y);
        return a[a.length >> 1];
      };
      for (const k of AXES) {
        if (med(mags[k]) > 500) {
          warns.push(`轴 ${k.toUpperCase()} 量级异常（|值| 中位数 > 500），请确认单位是否为 °/s`);
          break;
        }
      }
      let same = true;
      for (let i = 0; i < n; i++) {
        const r = rows[i];
        if (r.gx !== r.gy || r.gx !== r.gz) {
          same = false;
          break;
        }
      }
      if (same) warns.push("三轴数值完全相同，疑似同一通道复制");
      const dts = [];
      for (let i = 1; i < n; i++) {
        const d = rows[i].t - rows[i - 1].t;
        if (isFinite(d) && d > 0) dts.push(d);
      }
      if (dts.length > 10) {
        const mdt = med(dts);
        if (mdt > 5) warns.push("时间列步长疑似不是秒（中位步长 > 5），请检查时间单位");
      }
    }
    return warns;
  }

  const api = { AXES, parseText, parseWithMapping, fromRows, toRows, cleanMask, stats, allan, kf, csv, validate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IMUData = api;
})(typeof window !== "undefined" ? window : globalThis);
