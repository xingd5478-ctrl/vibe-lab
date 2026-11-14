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

  const api = { firstOrder, secondOrder, stateFeedback, observer, smc, signalDemo, pidDemo, metrics, poles };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SimControl = api;
})(typeof window !== "undefined" ? window : globalThis);
