/* R/Q 映射与一维卡尔曼滤波（浏览器/Node 通用） */
(function (root) {
  "use strict";

  function rqFromAllan(arw, rrw, fs) {
    fs = fs || 100;
    const dt = 1 / fs;
    const r = Math.pow(arw / 60, 2) * dt;
    const q = Math.pow(rrw / 60, 2) * dt;
    return { r, q, ratio: q > 0 ? r / q : Infinity };
  }

  function kf1d(z, r, q, x0, p0) {
    const n = z.length;
    const xs = new Float64Array(n);
    let x = x0 === undefined ? (n ? z[0] : 0) : x0;
    let p = p0 === undefined ? 1 : p0;
    for (let i = 0; i < n; i++) {
      p += q;
      const k = p / (p + r);
      x += k * (z[i] - x);
      p *= 1 - k;
      xs[i] = x;
    }
    return xs;
  }

  function integrate(rate, fs) {
    fs = fs || 100;
    const out = new Float64Array(rate.length);
    let s = 0;
    for (let i = 0; i < rate.length; i++) {
      s += rate[i];
      out[i] = s / fs;
    }
    return out;
  }

  const api = { rqFromAllan, kf1d, integrate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IMUKF = api;
})(typeof window !== "undefined" ? window : globalThis);
