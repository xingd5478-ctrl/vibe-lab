/* Allan 拟合：Huber IRLS 稳健加权最小二乘（σ² 线性化）+ R² + 回归置信区间（浏览器/Node 通用） */
(function (root) {
  "use strict";

  function median(arr) {
    const a = [...arr].sort((x, y) => x - y);
    if (!a.length) return NaN;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  /**
   * 拟合 σ² = A·(1/τ) + K²·(τ/3)，A=N²。
   * Huber IRLS 加权最小二乘，对离群 τ 段稳健；失败回退中位数法。
   * @returns {N,K,arw,rrw,r,q,r2,nCI,kCI,shortMax,longMin,method} 或 null
   */
  function fitAllan(pts, dt) {
    if (!pts || pts.length < 6) return null;
    const n = pts.length;
    const x1 = (p) => 1 / p.tau;
    const x2 = (p) => p.tau / 3;
    const yv = (p) => p.adev * p.adev;

    // Huber IRLS
    let A = NaN, B = NaN;
    let varA = NaN, varB = NaN;
    let robust = false;
    let w = new Array(n).fill(1);
    let S11 = 0, S12 = 0, S22 = 0, T1 = 0, T2 = 0, sw = 0;
    for (let iter = 0; iter < 25; iter++) {
      S11 = 0; S12 = 0; S22 = 0; T1 = 0; T2 = 0; sw = 0;
      for (let i = 0; i < n; i++) {
        const p = pts[i], wi = w[i];
        const a = x1(p), b = x2(p), y = yv(p);
        S11 += wi * a * a; S12 += wi * a * b; S22 += wi * b * b;
        T1 += wi * a * y; T2 += wi * b * y; sw += wi;
      }
      const det = S11 * S22 - S12 * S12;
      if (Math.abs(det) < 1e-30) break;
      A = (T1 * S22 - T2 * S12) / det;
      B = (T2 * S11 - T1 * S12) / det;

      const r = pts.map((p, i) => yv(p) - (A * x1(p) + B * x2(p)));
      const sorted = [...r].sort((a, b) => a - b);
      const med = sorted[n >> 1];
      const dev = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
      const s = 1.4826 * dev[n >> 1];
      if (!isFinite(s) || s <= 0) break;
      let maxChange = 0;
      for (let i = 0; i < n; i++) {
        const z = Math.abs(r[i]) / s;
        const wn = z <= 1.345 ? 1 : 1.345 / z;
        maxChange = Math.max(maxChange, Math.abs(wn - w[i]));
        w[i] = wn;
      }
      robust = true;
      if (maxChange < 1e-6) break;
    }

    let N = NaN, K = NaN;
    if (isFinite(A) && isFinite(B) && A > 0 && B > 0 && sw > 2) {
      N = Math.sqrt(A);
      K = Math.sqrt(B);
      // 残差尺度（鲁棒 MAD）→ 参数协方差
      const r = pts.map((p, i) => yv(p) - (A * x1(p) + B * x2(p)));
      const med = median(r);
      const dev = r.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
      const s2 = Math.pow(1.4826 * (dev[n >> 1] || 0), 2);
      if (s2 > 0) {
        const det = S11 * S22 - S12 * S12;
        varA = (s2 * S22) / det;
        varB = (s2 * S11) / det;
      } else {
        varA = NaN; varB = NaN;
      }
    }

    // 回退：短/长段中位数
    const tmin = pts[0].tau, tmax = pts[pts.length - 1].tau;
    if (!isFinite(N) || !isFinite(K) || N <= 0 || K <= 0) {
      const shortMax0 = Math.min(1.0, tmax / 3);
      const longMin0 = Math.max(2 * tmin, tmax / 4);
      const short = pts.filter((p) => p.tau <= shortMax0);
      const long = pts.filter((p) => p.tau >= longMin0);
      if (short.length < 3 || long.length < 2) return null;
      N = median(short.map((p) => p.adev * Math.sqrt(p.tau)));
      K = median(long.map((p) => p.adev / Math.sqrt(p.tau / 3)));
      if (!isFinite(N) || !isFinite(K) || N <= 0 || K <= 0) return null;
      varA = NaN; varB = NaN;
      robust = false;
    }

    const logs = pts.map((p) => Math.log(p.adev));
    const pred = pts.map((p) => Math.log(Math.sqrt((N * N) / p.tau + (K * K * p.tau) / 3)));
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < logs.length; i++) {
      ssTot += Math.pow(logs[i] - mean, 2);
      ssRes += Math.pow(logs[i] - pred[i], 2);
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;

    // 95% 置信区间：有回归方差时用参数法，否则用分位数
    let nCI, kCI;
    const Ns = pts.map((p) => p.adev * Math.sqrt(p.tau));
    const Ks = pts.map((p) => p.adev / Math.sqrt(p.tau / 3));
    if (isFinite(varA) && varA > 0 && isFinite(varB) && varB > 0) {
      nCI = [
        Math.sqrt(Math.max(0, N * N - 1.96 * Math.sqrt(varA))),
        Math.sqrt(Math.max(0, N * N + 1.96 * Math.sqrt(varA))),
      ];
      kCI = [
        Math.sqrt(Math.max(0, K * K - 1.96 * Math.sqrt(varB))),
        Math.sqrt(Math.max(0, K * K + 1.96 * Math.sqrt(varB))),
      ];
    } else {
      const ns = [...Ns].sort((a, b) => a - b);
      const ks = [...Ks].sort((a, b) => a - b);
      nCI = [quantile(ns, 0.025), quantile(ns, 0.975)];
      kCI = [quantile(ks, 0.025), quantile(ks, 0.975)];
    }

    const shortMax = Math.min(1.0, tmax / 3);
    const longMin = Math.max(2 * tmin, tmax / 4);
    const method = robust ? (w.some((wi) => wi < 0.99) ? "irls" : "wls") : "median";

    return {
      N, K,
      arw: N * 60,
      rrw: K * 60,
      r: N * N * dt,
      q: K * K * dt,
      r2,
      nCI, kCI,
      shortMax, longMin,
      nShort: pts.filter((p) => p.tau <= shortMax).length,
      nLong: pts.filter((p) => p.tau >= longMin).length,
      method,
    };
  }

  const api = { fitAllan, median, quantile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IMUFit = api;
})(typeof window !== "undefined" ? window : globalThis);
