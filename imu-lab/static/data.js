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
    temp: ["temp", "temperature", "temp_c", "t_c", "degc"],
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
      temp: pick(ALIASES.temp),
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
      az = new Float32Array(n).fill(NaN),
      temp = new Float32Array(n).fill(NaN);
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
      if (idx.temp >= 0) temp[k] = Number(c[idx.temp]);
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
      temp: temp.subarray(0, k),
      hasTemp: idx.temp >= 0,
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
      temp: new Float32Array(n).fill(NaN),
      hasTemp: rows.some((r) => Number.isFinite(r.temp)),
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

  function accelMean(text) {
    const lines = String(text)
      .split(/\r?\n/)
      .filter((l) => l.trim().length);
    if (lines.length < 2) return null;
    const norm = (x) =>
      x
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
    const head = lines[0].split(",").map(norm);
    const pick = (names) => {
      for (const n of names) {
        const i = head.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const ix = pick(["ax", "ax_g", "accel_x"]),
      iy = pick(["ay", "ay_g", "accel_y"]),
      iz = pick(["az", "az_g", "accel_z"]);
    if (ix < 0 || iy < 0 || iz < 0) return null;
    let n = 0,
      sx = 0,
      sy = 0,
      sz = 0;
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      const x = Number(c[ix]),
        y = Number(c[iy]),
        z = Number(c[iz]);
      if (![x, y, z].every(Number.isFinite)) continue;
      sx += x;
      sy += y;
      sz += z;
      n++;
    }
    return n ? { ax: sx / n, ay: sy / n, az: sz / n, n } : null;
  }

  function detectFace(v) {
    const axes = [
      ["x", v.ax],
      ["y", v.ay],
      ["z", v.az],
    ];
    axes.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    return (axes[0][1] >= 0 ? "p" : "n") + axes[0][0];
  }

  function solve4(M, b) {
    const A = M.map((r, i) => r.concat([b[i]]));
    for (let i = 0; i < 4; i++) {
      let p = i;
      for (let k = i + 1; k < 4; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
      [A[i], A[p]] = [A[p], A[i]];
      const d = A[i][i] || 1e-12;
      for (let j = i; j < 5; j++) A[i][j] /= d;
      for (let k = 0; k < 4; k++) {
        if (k === i) continue;
        const f = A[k][i];
        for (let j = i; j < 5; j++) A[k][j] -= f * A[i][j];
      }
    }
    return A.map((r) => r[4]);
  }

  function invert3(M) {
    const a = M[0][0],
      b = M[0][1],
      c = M[0][2];
    const d = M[1][0],
      e = M[1][1],
      f = M[1][2];
    const g = M[2][0],
      h = M[2][1],
      i = M[2][2];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-12) throw new Error("six-face: singular matrix");
    return [
      [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
      [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
      [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
    ];
  }

  function correctSix(calib, x, y, z) {
    const bx = x - calib.bias.x,
      by = y - calib.bias.y,
      bz = z - calib.bias.z;
    if (calib.matrix) {
      const M = calib.matrix;
      return [
        M[0][0] * bx + M[0][1] * by + M[0][2] * bz,
        M[1][0] * bx + M[1][1] * by + M[1][2] * bz,
        M[2][0] * bx + M[2][1] * by + M[2][2] * bz,
      ];
    }
    return [bx / calib.scale.x, by / calib.scale.y, bz / calib.scale.z];
  }

  function sixQuality(faces, calib) {
    const ideal = { px: [1, 0, 0], nx: [-1, 0, 0], py: [0, 1, 0], ny: [0, -1, 0], pz: [0, 0, 1], nz: [0, 0, -1] };
    const norms = [],
      errs = [];
    for (const k of Object.keys(ideal)) {
      if (!faces[k]) continue;
      const f = faces[k];
      const v = correctSix(calib, f.x, f.y, f.z);
      const norm = Math.hypot(v[0], v[1], v[2]);
      norms.push(norm);
      const e = ideal[k].map((x, i) => v[i] - x);
      errs.push(Math.hypot(e[0], e[1], e[2]));
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    const nm = mean(norms);
    const nstd = Math.sqrt(mean(norms.map((x) => (x - nm) * (x - nm))));
    return {
      normMean: nm,
      normStd: nstd,
      normMin: Math.min(...norms),
      normMax: Math.max(...norms),
      rmsError: Math.sqrt(mean(errs.map((x) => x * x))),
      count: norms.length,
    };
  }

  function sixQualityGrade(q) {
    if (!q || !q.count) return "F";
    const m = Math.abs(q.normMean - 1);
    if (m <= 0.03 && q.normStd <= 0.02 && q.rmsError <= 0.03) return "A";
    if (m <= 0.08 && q.normStd <= 0.05 && q.rmsError <= 0.08) return "B";
    return "F";
  }

  function fitTempBias(points, t0) {
    if (!points || points.length < 2) throw new Error("temp bias: need at least 2 points");
    const T0 = Number(t0 != null ? t0 : points.reduce((s, p) => s + p.T, 0) / points.length);
    const fitAxis = (key) => {
      let sx = 0,
        sy = 0,
        sxx = 0,
        sxy = 0;
      for (const p of points) {
        const x = p.T - T0;
        sx += x;
        sy += p[key];
        sxx += x * x;
        sxy += x * p[key];
      }
      const n = points.length;
      const den = n * sxx - sx * sx;
      if (Math.abs(den) < 1e-12) throw new Error("temp bias: temperature points are identical");
      const k = (n * sxy - sx * sy) / den;
      const b0 = (sy - k * sx) / n;
      let sse = 0,
        sst = 0;
      const my = sy / n;
      for (const p of points) {
        const pred = b0 + k * (p.T - T0);
        sse += (p[key] - pred) ** 2;
        sst += (p[key] - my) ** 2;
      }
      const xbar = sx / n,
        sxxC = sxx - n * xbar * xbar;
      return {
        b0,
        k,
        r2: sst > 0 ? 1 - sse / sst : 1,
        rmse: Math.sqrt(sse / Math.max(1, n - 2)),
        seK: sxxC > 0 ? Math.sqrt(sse / Math.max(1, n - 2) / sxxC) : NaN,
      };
    };
    return { T0, gx: fitAxis("gx"), gy: fitAxis("gy"), gz: fitAxis("gz") };
  }

  function tempBiasAt(fit, T) {
    const x = Number(T) - fit.T0;
    return { gx: fit.gx.b0 + fit.gx.k * x, gy: fit.gy.b0 + fit.gy.k * x, gz: fit.gz.b0 + fit.gz.k * x };
  }

  function gyroScale(measured, known) {
    if (!Number.isFinite(measured) || !Number.isFinite(known) || Math.abs(known) < 1e-9)
      throw new Error("gyro scale: invalid rate");
    const f = measured / known;
    if (!Number.isFinite(f) || Math.abs(f) < 1e-6) throw new Error("gyro scale: invalid factor");
    return f;
  }

  function tempSegments(rows, opts) {
    const threshold = (opts && opts.threshold) || 0.5;
    const minSamples = (opts && opts.minSamples) || 10;
    const out = [];
    let start = 0;
    const push = (a, b) => {
      const seg = rows
        .slice(a, b)
        .filter(
          (r) => Number.isFinite(r.temp) && Number.isFinite(r.gx) && Number.isFinite(r.gy) && Number.isFinite(r.gz)
        );
      if (seg.length < minSamples) return;
      const mean = (k) => seg.reduce((s, r) => s + r[k], 0) / seg.length;
      const g = ["gx", "gy", "gz"].map((k) => {
        const m = mean(k);
        const sd = Math.sqrt(seg.reduce((s, r) => s + (r[k] - m) ** 2, 0) / seg.length);
        return { m, sd };
      });
      out.push({
        T: mean("temp"),
        gx: g[0].m,
        gy: g[1].m,
        gz: g[2].m,
        n: seg.length,
        std: Math.max(g[0].sd, g[1].sd, g[2].sd),
      });
    };
    for (let i = 1; i < rows.length; i++) {
      if (Math.abs(rows[i].temp - rows[i - 1].temp) > threshold) {
        push(start, i);
        start = i;
      }
    }
    push(start, rows.length);
    return out;
  }

  function robustTempBias(points, t0) {
    let fit = fitTempBias(points, t0);
    const residual = (p) =>
      Math.max(
        Math.abs(p.gx - (fit.gx.b0 + fit.gx.k * (p.T - fit.T0))),
        Math.abs(p.gy - (fit.gy.b0 + fit.gy.k * (p.T - fit.T0))),
        Math.abs(p.gz - (fit.gz.b0 + fit.gz.k * (p.T - fit.T0)))
      );
    const res = points.map(residual);
    const mean = res.reduce((s, x) => s + x, 0) / res.length;
    const sd = Math.sqrt(res.reduce((s, x) => s + (x - mean) ** 2, 0) / res.length);
    const keep = points.filter((p, i) => res[i] <= mean + 2.5 * sd || points.length <= 3);
    const outliers = points.filter((p, i) => !keep.includes(p));
    if (keep.length >= 2 && outliers.length) fit = fitTempBias(keep, fit.T0);
    return { ...fit, used: keep.length, outliers };
  }

  function tempPoint(text) {
    const lines = String(text)
      .split(/\r?\n/)
      .filter((l) => l.trim().length);
    if (lines.length < 2) return null;
    const norm = (x) =>
      x
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
    const head = lines[0].split(",").map(norm);
    const pick = (names) => {
      for (const n of names) {
        const i = head.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const gx = pick(ALIASES.gx),
      gy = pick(ALIASES.gy),
      gz = pick(ALIASES.gz),
      tp = pick(ALIASES.temp);
    if (gx < 0 || gy < 0 || gz < 0 || tp < 0) return null;
    let n = 0,
      sx = 0,
      sy = 0,
      sz = 0,
      st = 0;
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      const a = Number(c[gx]),
        b = Number(c[gy]),
        d = Number(c[gz]),
        T = Number(c[tp]);
      if (![a, b, d, T].every(Number.isFinite)) continue;
      sx += a;
      sy += b;
      sz += d;
      st += T;
      n++;
    }
    return n ? { gx: sx / n, gy: sy / n, gz: sz / n, T: st / n, n } : null;
  }

  function sixFace(faces) {
    const need = ["px", "nx", "py", "ny", "pz", "nz"];
    for (const k of need) if (!faces[k]) throw new Error("six-face: missing " + k);
    const ideal = { px: [1, 0, 0], nx: [-1, 0, 0], py: [0, 1, 0], ny: [0, -1, 0], pz: [0, 0, 1], nz: [0, 0, -1] };
    const bias = {},
      matrix = [];
    for (const comp of ["x", "y", "z"]) {
      const M = Array.from({ length: 4 }, () => new Array(4).fill(0));
      const v = new Array(4).fill(0);
      for (const k of need) {
        const t = ideal[k],
          val = faces[k][comp];
        const row = [1, t[0], t[1], t[2]];
        for (let i = 0; i < 4; i++) {
          v[i] += row[i] * val;
          for (let j = 0; j < 4; j++) M[i][j] += row[i] * row[j];
        }
      }
      const c = solve4(M, v);
      bias[comp] = c[0];
      matrix.push(c.slice(1));
    }
    for (const comp of ["x", "y", "z"]) if (!Number.isFinite(bias[comp])) throw new Error("six-face: invalid " + comp);
    const inv = invert3(matrix);
    const scale = { x: 1 / matrix[0][0], y: 1 / matrix[1][1], z: 1 / matrix[2][2] };
    return { bias, scale, matrix: inv, rawMatrix: matrix, g: 1 };
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

  const api = {
    AXES,
    parseText,
    sixFace,
    parseWithMapping,
    fromRows,
    toRows,
    cleanMask,
    stats,
    allan,
    kf,
    csv,
    validate,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IMUData = api;
})(typeof window !== "undefined" ? window : globalThis);
