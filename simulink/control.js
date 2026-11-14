/* Simulink 教程交互复现：同一数学的纯 JS 仿真内核（可单测） */
(function (root) {
  "use strict";

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(r) {
    let u = 0, v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function metrics(t, y, ref) {
    const target = ref === undefined ? 1 : ref;
    let peak = -Infinity, tPeak = 0;
    for (let i = 0; i < y.length; i++) if (y[i] > peak) { peak = y[i]; tPeak = t[i]; }
    const overshoot = peak > target ? ((peak - target) / target) * 100 : 0;
    let settle = t[t.length - 1];
    for (let i = y.length - 1; i >= 0; i--) {
      if (Math.abs(y[i] - target) > 0.02 * Math.abs(target)) {
        settle = t[Math.min(i + 1, y.length - 1)]; break;
      }
    }
    return { overshoot, tPeak, settle, ess: Math.abs(target - y[y.length - 1]) };
  }

  function firstOrder(tau, K, T) {
    const dt = 0.002, n = Math.round((T || 6) / dt);
    const t = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n);
    let x = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      u[i] = t[i] >= 0.5 ? K : 0;
      x += (u[i] - x) * (dt / Math.max(tau, 1e-4));
      y[i] = x;
    }
    return { t, y, u };
  }

  function secondOrder(wn, zeta, T) {
    const dt = 0.002, n = Math.round((T || 6) / dt);
    const t = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n);
    let x = 0, v = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      u[i] = t[i] >= 0.5 ? 1 : 0;
      const acc = wn * wn * (u[i] - x) - 2 * zeta * wn * v;
      v += acc * dt;
      x += v * dt;
      y[i] = x;
    }
    return { t, y, u };
  }

  function stateFeedback(wn, zeta, T) {
    const dt = 0.002, n = Math.round((T || 6) / dt);
    const k1 = wn * wn, k2 = 2 * zeta * wn;
    const t = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n);
    let x1 = 0, x2 = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const r = t[i] >= 0.5 ? 1 : 0;
      u[i] = k1 * (r - x1) - k2 * x2;
      x2 += u[i] * dt;
      x1 += x2 * dt;
      y[i] = x1;
    }
    return { t, y, u, k: [k1, k2], poles: poles(wn, zeta) };
  }

  function observer(wn, zeta, wo, zetao, noise) {
    const dt = 0.002, T = 6, n = Math.round(T / dt);
    const k1 = wn * wn, k2 = 2 * zeta * wn;
    const l1 = 2 * zetao * wo, l2 = wo * wo;
    const t = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n);
    const est = new Float64Array(n), err = new Float64Array(n);
    const r = rng(7);
    let x1 = 0, x2 = 0, h1 = 0, h2 = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const ref = t[i] >= 0.5 ? 1 : 0;
      const meas = x1 + (noise ? gauss(r) * 0.01 : 0);
      u[i] = k1 * (ref - h1) - k2 * h2;
      x2 += u[i] * dt;
      x1 += x2 * dt;
      h1 += (h2 + l1 * (meas - h1)) * dt;
      h2 += (u[i] + l2 * (meas - h1)) * dt;
      y[i] = x1;
      est[i] = h1;
      err[i] = Math.abs(x1 - h1);
    }
    return { t, y, est, err, u, L: [l1, l2], poles: poles(wo, zetao) };
  }

  function smc(lambda, k, phi) {
    const dt = 0.001, T = 6, n = Math.round(T / dt);
    const t = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n);
    const s = new Float64Array(n);
    let x1 = 0, x2 = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const r = t[i] >= 0.5 ? 1 : 0;
      const e = x1 - r;
      s[i] = x2 + lambda * e;
      const sat = Math.max(-1, Math.min(1, s[i] / Math.max(phi, 1e-6)));
      u[i] = -k * sat;
      x2 += u[i] * dt;
      x1 += x2 * dt;
      y[i] = x1;
    }
    let chat = 0, cnt = 0, last = 0;
    for (let i = n - Math.round(1 / dt); i < n; i++) {
      if (cnt > 0) chat += Math.abs(u[i] - last);
      last = u[i]; cnt++;
    }
    return { t, y, u, s, chattering: cnt ? chat / cnt : 0 };
  }

  function poles(wn, zeta) {
    const im = wn * Math.sqrt(Math.max(0, 1 - zeta * zeta));
    return { re: -zeta * wn, im };
  }

  function signalDemo(K, freq, noise) {
    const dt = 0.001, T = 4, n = Math.round(T / dt);
    const t = new Float64Array(n), u = new Float64Array(n), y = new Float64Array(n);
    const r = rng(11);
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      u[i] = Math.sin(2 * Math.PI * freq * t[i]) + (noise ? gauss(r) * 0.15 : 0);
      y[i] = K * u[i];
    }
    return { t, u, y };
  }

  function pidDemo(kp, ki, kd) {
    const wn = 4, zeta = 0.4, dt = 0.002, T = 8, n = Math.round(T / dt);
    const t = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n);
    let x = 0, v = 0, I = 0, pe = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const ref = t[i] >= 0.5 ? 1 : 0;
      const e = ref - x;
      I = Math.max(-10, Math.min(10, I + e * dt));
      const de = (e - pe) / dt;
      pe = e;
      u[i] = Math.max(-20, Math.min(20, kp * e + ki * I + kd * de));
      const acc = wn * wn * (u[i] - x) - 2 * zeta * wn * v;
      v += acc * dt;
      x += v * dt;
      y[i] = x;
    }
    return { t, y, u };
  }

  function kalmanDemo(R, Q) {
    const dt = 0.05, T = 10, n = Math.round(T / dt);
    const t = new Float64Array(n), z = new Float64Array(n), x = new Float64Array(n);
    const r = rng(23);
    let est = 0, P = 1;
    let sm = 0, sk = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const truth = 1;
      z[i] = truth + gauss(r) * 0.15;
      P += Q;
      const K = P / (P + R);
      est += K * (z[i] - est);
      P *= 1 - K;
      x[i] = est;
      sm += Math.pow(z[i] - truth, 2);
      sk += Math.pow(x[i] - truth, 2);
    }
    return { t, z, x, rmseMeas: Math.sqrt(sm / n), rmseKf: Math.sqrt(sk / n) };
  }

  function bodeDemo(wn, zeta) {
    const w = [], mag = [], phase = [];
    for (let e = -1; e <= 2.001; e += 0.02) {
      const wi = Math.pow(10, e);
      const re = wn * wn - wi * wi;
      const im = 2 * zeta * wn * wi;
      w.push(wi);
      mag.push(20 * Math.log10((wn * wn) / Math.hypot(re, im)));
      phase.push((Math.atan2(-im, re) * 180) / Math.PI);
    }
    let peak = -Infinity;
    for (const m of mag) if (m > peak) peak = m;
    let bw = w[w.length - 1];
    for (let i = 0; i < mag.length; i++) {
      if (mag[i] <= -3) { bw = w[i]; break; }
    }
    const iw = w.findIndex((v) => v >= wn);
    return { w, mag, phase, peak, bw, phaseAtWn: phase[iw < 0 ? phase.length - 1 : iw] };
  }

  /* ---------- MPC：一阶对象，滚动优化 + 输入约束 ---------- */
  function mpcDemo(N, Q, R, uMax) {
    const Ts = 0.1, T = 8, n = Math.round(T / Ts);
    const a = 0.9, b = 0.5;
    const t = new Float64Array(n), xa = new Float64Array(n), ua = new Float64Array(n);
    let x = 0;
    let us = new Array(N).fill(0);
    const refAt = (step) => (step * Ts >= 1 ? 1 : 0);

    function predictCost(x0, u, ref, start) {
      let xx = x0, cost = 0;
      for (let j = 0; j < N; j++) {
        xx = a * xx + b * u[j];
        const r = refAt(start + j + 1);
        cost += Q * (xx - r) * (xx - r) + R * u[j] * u[j];
      }
      return cost;
    }

    for (let k = 0; k < n; k++) {
      const ref = refAt(k);
      let base = predictCost(x, us, ref, k);
      for (let it = 0; it < 18; it++) {
        const grad = new Array(N).fill(0);
        const eps = 1e-4;
        for (let j = 0; j < N; j++) {
          const old = us[j];
          us[j] = old + eps;
          grad[j] = (predictCost(x, us, ref, k) - base) / eps;
          us[j] = old;
        }
        const step = 0.08 / (1 + Q);
        for (let j = 0; j < N; j++) {
          us[j] = Math.max(-uMax, Math.min(uMax, us[j] - step * grad[j]));
        }
        base = predictCost(x, us, ref, k);
      }
      const u = us[0];
      t[k] = k * Ts;
      ua[k] = u;
      x = a * x + b * u;
      xa[k] = x;
      us = us.slice(1).concat(0);
    }
    return { t, x: xa, u: ua };
  }

  /* ---------- 根轨迹：1 + K·G(s)，G=1/(s(s+1)(s+2)) ---------- */
  function rootsOf(K) {
    // s^3 + 3s^2 + 2s + K
    let z = [
      { re: 0.3, im: 0.9 },
      { re: 0.3, im: -0.9 },
      { re: -2.0, im: 0 },
    ];
    const cadd = (p, q) => ({ re: p.re + q.re, im: p.im + q.im });
    const csub = (p, q) => ({ re: p.re - q.re, im: p.im - q.im });
    const cmul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
    const cdiv = (p, q) => {
      const d = q.re * q.re + q.im * q.im;
      return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d };
    };
    const poly = (s) => {
      const s2 = cmul(s, s), s3 = cmul(s2, s);
      return {
        re: s3.re + 3 * s2.re + 2 * s.re + K,
        im: s3.im + 3 * s2.im + 2 * s.im,
      };
    };
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < 3; i++) {
        let den = { re: 1, im: 0 };
        for (let j = 0; j < 3; j++) if (j !== i) den = cmul(den, csub(z[i], z[j]));
        const dz = cdiv(poly(z[i]), den);
        z[i] = csub(z[i], dz);
      }
    }
    return z;
  }

  function rootLocusDemo(K) {
    const Ks = [];
    for (let e = -2; e <= 2.0001; e += 0.05) Ks.push(Math.pow(10, e));
    const branches = [[], [], []];
    let prev = null;
    for (const kk of Ks) {
      let roots = rootsOf(kk);
      if (prev) {
        const used = new Set();
        const ordered = [];
        for (const p of prev) {
          let best = -1, bd = Infinity;
          roots.forEach((r, i) => {
            if (used.has(i)) return;
            const d = (r.re - p.re) ** 2 + (r.im - p.im) ** 2;
            if (d < bd) { bd = d; best = i; }
          });
          used.add(best);
          ordered.push(roots[best]);
        }
        roots = ordered;
      } else {
        roots = [...roots].sort((p, q) => p.re - q.re || p.im - q.im);
      }
      roots.forEach((r, i) => branches[i].push([r.re, r.im]));
      prev = roots;
    }
    const cur = rootsOf(K);
    const maxRe = Math.max(...cur.map((p) => p.re));
    const dom = cur.reduce((m, p) => (p.re > m.re ? p : m), cur[0]);
    const mag = Math.hypot(dom.re, dom.im) || 1;
    return {
      branches,
      current: cur,
      stable: maxRe < 0,
      maxRe,
      damping: -dom.re / mag,
    };
  }

  /* ---------- 一维模糊控制：N/Z/P 隶属度 + 加权平均 ---------- */
  function fuzzyDemo(scale) {
    const wn = 4, zeta = 0.5, dt = 0.002, T = 8, n = Math.round(T / dt);
    const t = new Float64Array(n), y = new Float64Array(n), u = new Float64Array(n);
    const tri = (x, a, b, c) => Math.max(0, Math.min((x - a) / (b - a), (c - x) / (c - b)));
    let x = 0, v = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const ref = t[i] >= 0.5 ? 1 : 0;
      const e = Math.max(-1.5, Math.min(1.5, ref - x));
      const wN = tri(e, -1.5, -1, 0), wZ = tri(e, -1, 0, 1), wP = tri(e, 0, 1, 1.5);
      const sum = wN + wZ + wP || 1;
      const out = (wP - wN) / sum;
      u[i] = Math.max(-10, Math.min(10, scale * out));
      const acc = wn * wn * (u[i] - x) - 2 * zeta * wn * v;
      v += acc * dt;
      x += v * dt;
      y[i] = x;
    }
    return { t, y, u };
  }

  /* ---------- 质量-弹簧-阻尼（m=1） ---------- */
  function msdDemo(k, c) {
    const dt = 0.002, T = 8, n = Math.round(T / dt);
    const t = new Float64Array(n), x = new Float64Array(n), f = new Float64Array(n);
    let pos = 0, vel = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      f[i] = t[i] >= 0.5 ? 1 : 0;
      const acc = f[i] - c * vel - k * pos;
      vel += acc * dt;
      pos += vel * dt;
      x[i] = pos;
    }
    return {
      t, x, f,
      wn: Math.sqrt(k),
      zeta: c / (2 * Math.sqrt(k)),
    };
  }

  /* ---------- 2 连杆正/逆运动学 ---------- */
  function armDemo(tx, ty) {
    const l1 = 1, l2 = 0.8;
    const d = (tx * tx + ty * ty - l1 * l1 - l2 * l2) / (2 * l1 * l2);
    const reachable = d >= -1 && d <= 1;
    let th1 = Math.atan2(ty, tx), th2 = 0;
    if (reachable) {
      th2 = Math.acos(Math.max(-1, Math.min(1, d)));
      th1 = Math.atan2(ty, tx) - Math.atan2(l2 * Math.sin(th2), l1 + l2 * Math.cos(th2));
    }
    const ex = l1 * Math.cos(th1) + l2 * Math.cos(th1 + th2);
    const ey = l1 * Math.sin(th1) + l2 * Math.sin(th1 + th2);
    return { l1, l2, th1, th2, ex, ey, reachable, maxReach: l1 + l2 };
  }

  /* ---------- 采样定理 / 混叠 ---------- */
  function dspDemo(f, fs) {
    const dtc = 0.001, T = 1, n = Math.round(T / dtc);
    const t = new Float64Array(n), y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      t[i] = i * dtc;
      y[i] = Math.sin(2 * Math.PI * f * t[i]);
    }
    const m = Math.max(2, Math.floor(T * fs) + 1);
    const ts = new Float64Array(m), z = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      ts[i] = i / fs;
      z[i] = Math.sin(2 * Math.PI * f * ts[i]);
    }
    let alias = Math.abs(f - Math.round(f / fs) * fs);
    if (alias > fs / 2) alias = fs - alias;
    return { t, y, ts, z, alias, nyquist: fs / 2, aliased: f > fs / 2 };
  }

  /* ---------- IMU 融合：互补滤波 vs 加速度计 ---------- */
  function imuFusionDemo(alpha, noiseOn) {
    const dt = 0.01, T = 20, n = Math.round(T / dt);
    const t = new Float64Array(n), truth = new Float64Array(n);
    const acc = new Float64Array(n), comp = new Float64Array(n);
    const r = rng(31);
    let est = 0, sa = 0, sc = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      truth[i] = 0.6 * Math.sin(0.35 * t[i]);
      const rate = 0.6 * 0.35 * Math.cos(0.35 * t[i]) + 0.01;
      acc[i] = truth[i] + (noiseOn ? gauss(r) * 0.18 : 0);
      const gyro = rate + (noiseOn ? gauss(r) * 0.05 : 0);
      est = alpha * (est + gyro * dt) + (1 - alpha) * acc[i];
      comp[i] = est;
      sa += Math.pow(acc[i] - truth[i], 2);
      sc += Math.pow(comp[i] - truth[i], 2);
    }
    return {
      t, truth, acc, comp,
      rmseAcc: Math.sqrt(sa / n),
      rmseComp: Math.sqrt(sc / n),
    };
  }

  /* ---------- Bus：多路信号打包后按索引选择 ---------- */
  function busDemo(sel) {
    const dt = 0.002, T = 4, n = Math.round(T / dt);
    const t = new Float64Array(n);
    const sigs = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    for (let i = 0; i < n; i++) {
      const tt = i * dt;
      t[i] = tt;
      sigs[0][i] = Math.sin(2 * Math.PI * 0.5 * tt);
      sigs[1][i] = Math.cos(2 * Math.PI * 0.5 * tt);
      sigs[2][i] = tt / T;
      sigs[3][i] = tt % 1 < 0.5 ? 1 : -1;
    }
    return { t, sigs, sel: Math.max(0, Math.min(3, Math.round(sel))) };
  }

  const api = { firstOrder, secondOrder, stateFeedback, observer, smc, signalDemo, pidDemo, kalmanDemo, bodeDemo, mpcDemo, rootLocusDemo, fuzzyDemo, msdDemo, armDemo, dspDemo, imuFusionDemo, busDemo, metrics, poles };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SimControl = api;
})(typeof window !== "undefined" ? window : globalThis);
