/* Allan 方差与坏帧清洗（浏览器/Node 通用） */
(function (root) {
  "use strict";

  function allanDeviation(x, dt, taus) {
    const n = x.length;
    if (!n || n < 10) return [];
    if (!taus) {
      const t0 = Math.max(dt * 10, dt);
      const t1 = Math.max(t0 * 1.01, (n * dt) / 10);
      const m = 40;
      taus = [];
      for (let i = 0; i < m; i++) taus.push(t0 * Math.pow(t1 / t0, i / (m - 1)));
    }
    const cs = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + x[i];
    const out = [];
    for (const tau of taus) {
      const m = Math.max(1, Math.round(tau / dt));
      if (m * 2 >= n) break;
      let sum = 0,
        prev = null,
        k = 0;
      for (let i = 0; i + m <= n; i += m) {
        const mean = (cs[i + m] - cs[i]) / m;
        if (prev !== null) {
          const d = mean - prev;
          sum += d * d;
          k++;
        }
        prev = mean;
      }
      if (k > 0) out.push({ tau, adev: Math.sqrt((0.5 * sum) / k) });
    }
    return out;
  }

  function cleanFrames(rows, maxAbs) {
    maxAbs = maxAbs || 5;
    return rows.filter(
      (r) =>
        (r.crc === undefined || r.crc === 1 || r.crc === true) &&
        Math.abs(r.gx) <= maxAbs &&
        Math.abs(r.gy) <= maxAbs &&
        Math.abs(r.gz) <= maxAbs
    );
  }

  const api = { allanDeviation, cleanFrames };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IMUAllan = api;
})(typeof window !== "undefined" ? window : globalThis);
