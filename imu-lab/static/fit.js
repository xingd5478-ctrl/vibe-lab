/* Allan 拟合：ARW/RRW + R² + 分位数区间（浏览器/Node 通用） */
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
   * 从 Allan 点拟合 ARW/RRW。
   * σ(τ) = sqrt(N²/τ + K²τ/3)，短 τ 段估计 N，长 τ 段估计 K。
   * @returns {N,K,arw,rrw,r,q,r2,nCI,kCI,shortMax,longMin} 或 null
   */
  function fitAllan(pts, dt) {
    if (!pts || pts.length < 6) return null;
    const tmin = pts[0].tau, tmax = pts[pts.length - 1].tau;
    const shortMax = Math.min(1.0, tmax / 3);
    const longMin = Math.max(2 * tmin, tmax / 4);
    const short = pts.filter((p) => p.tau <= shortMax);
    const long = pts.filter((p) => p.tau >= longMin);
    if (short.length < 3 || long.length < 2) return null;

    const Ns = short.map((p) => p.adev * Math.sqrt(p.tau));
    const Ks = long.map((p) => p.adev / Math.sqrt(p.tau / 3));
    const N = median(Ns), K = median(Ks);
    if (!isFinite(N) || !isFinite(K) || N <= 0 || K <= 0) return null;

    // 双项模型在 log 空间的 R²
    const logs = pts.map((p) => Math.log(p.adev));
    const pred = pts.map((p) => Math.log(Math.sqrt((N * N) / p.tau + (K * K * p.tau) / 3)));
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < logs.length; i++) {
      ssTot += Math.pow(logs[i] - mean, 2);
      ssRes += Math.pow(logs[i] - pred[i], 2);
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;

    const nSorted = [...Ns].sort((a, b) => a - b);
    const kSorted = [...Ks].sort((a, b) => a - b);
    const nCI = [quantile(nSorted, 0.025), quantile(nSorted, 0.975)];
    const kCI = [quantile(kSorted, 0.025), quantile(kSorted, 0.975)];

    return {
      N, K,
      arw: N * 60,
      rrw: K * 60,
      r: N * N * dt,
      q: K * K * dt,
      r2,
      nCI, kCI,
      shortMax, longMin,
      nShort: short.length,
      nLong: long.length,
    };
  }

  const api = { fitAllan, median, quantile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IMUFit = api;
})(typeof window !== "undefined" ? window : globalThis);
