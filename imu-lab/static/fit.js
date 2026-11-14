/* Allan 拟合：加权最小二乘（σ² 线性化）+ R² + 回归置信区间（浏览器/Node 通用） */
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
   * 以 σ² 为因变量做普通最小二乘（等价于对 σ² 加权）；失败时回退中位数法。
   * @returns {N,K,arw,rrw,r,q,r2,nCI,kCI,shortMax,longMin} 或 null
   */
  function fitAllan(pts, dt) {
    if (!pts || pts.length < 6) return null;
    const tmin = pts[0].tau, tmax = pts[pts.length - 1].tau;

    let S11 = 0, S12 = 0, S22 = 0, T1 = 0, T2 = 0;
    for (const p of pts) {
      const x1 = 1 / p.tau;
      const x2 = p.tau / 3;
      const y = p.adev * p.adev;
      S11 += x1 * x1;
      S12 += x1 * x2;
      S22 += x2 * x2;
      T1 += x1 * y;
      T2 += x2 * y;
    }
    const det = S11 * S22 - S12 * S12;

    let N = NaN, K = NaN, varN2 = NaN, varK2 = NaN;
    if (Math.abs(det) > 1e-30) {
      const A = (T1 * S22 - T2 * S12) / det; // N²
      const B = (T2 * S11 - T1 * S12) / det; // K²
      if (A > 0 && B > 0) {
        N = Math.sqrt(A);
        K = Math.sqrt(B);
        // 回归残差方差 → 参数协方差
        let ssResY = 0;
        for (const p of pts) {
          const pred = A / p.tau + (B * p.tau) / 3;
          const r = p.adev * p.adev - pred;
          ssResY += r * r;
        }
        const s2 = ssResY / Math.max(1, pts.length - 2);
        varN2 = (s2 * S22) / det;
        varK2 = (s2 * S11) / det;
      }
    }

    // 回退：短/长段中位数
    if (!isFinite(N) || !isFinite(K) || N <= 0 || K <= 0) {
      const shortMax0 = Math.min(1.0, tmax / 3);
      const longMin0 = Math.max(2 * tmin, tmax / 4);
      const short = pts.filter((p) => p.tau <= shortMax0);
      const long = pts.filter((p) => p.tau >= longMin0);
      if (short.length < 3 || long.length < 2) return null;
      N = median(short.map((p) => p.adev * Math.sqrt(p.tau)));
      K = median(long.map((p) => p.adev / Math.sqrt(p.tau / 3)));
      if (!isFinite(N) || !isFinite(K) || N <= 0 || K <= 0) return null;
      varN2 = NaN;
      varK2 = NaN;
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
    if (isFinite(varN2) && varN2 > 0) {
      const nLo = Math.sqrt(Math.max(0, N * N - 1.96 * Math.sqrt(varN2)));
      const nHi = Math.sqrt(Math.max(0, N * N + 1.96 * Math.sqrt(varN2)));
      const kLo2 = Math.max(0, K * K - 1.96 * Math.sqrt(varK2));
      const kHi2 = Math.max(0, K * K + 1.96 * Math.sqrt(varK2));
      nCI = [nLo, nHi];
      kCI = [Math.sqrt(kLo2), Math.sqrt(kHi2)];
    } else {
      const ns = [...Ns].sort((a, b) => a - b);
      const ks = [...Ks].sort((a, b) => a - b);
      nCI = [quantile(ns, 0.025), quantile(ns, 0.975)];
      kCI = [quantile(ks, 0.025), quantile(ks, 0.975)];
    }

    const shortMax = Math.min(1.0, tmax / 3);
    const longMin = Math.max(2 * tmin, tmax / 4);

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
      method: isFinite(varN2) ? "wls" : "median",
    };
  }

  const api = { fitAllan, median, quantile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IMUFit = api;
})(typeof window !== "undefined" ? window : globalThis);
