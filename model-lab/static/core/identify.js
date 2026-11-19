/* Model Lab identification core: FOPDT / SOPDT step models.
   Pure functions, UMD, no DOM. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"));
  else root.ModelIdentify = factory(root.ModelData);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";

  function stepShape(x) {
    if (x <= 0) return 0;
    return 1 - Math.exp(-x);
  }

  function secondOrderShape(x, zeta, wn) {
    if (x <= 0) return 0;
    if (Math.abs(zeta - 1) < 1e-4) return 1 - Math.exp(-wn * x) * (1 + wn * x);
    if (zeta < 1) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * wn * x) * (Math.cos(wd * x) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * x));
    }
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -wn * (zeta - s);
    const r2 = -wn * (zeta + s);
    return 1 - (r2 * Math.exp(r1 * x) - r1 * Math.exp(r2 * x)) / (r2 - r1);
  }

  function firstOrderValue(t, p) {
    const x = t - p.stepTime - p.L;
    return p.y0 + p.K * p.du * stepShape(x / p.tau);
  }

  function secondOrderValue(t, p) {
    const x = t - p.stepTime - p.L;
    return p.y0 + p.K * p.du * secondOrderShape(x, p.zeta, p.wn);
  }

  function sse(t, y, fn, p) {
    let s = 0;
    for (let i = 0; i < t.length; i++) {
      const e = y[i] - fn(t[i], p);
      s += e * e;
    }
    return s;
  }

  function fitStats(y, yhat, k) {
    let num = 0;
    let den = 0;
    const mean = D.mean(y);
    for (let i = 0; i < y.length; i++) {
      const e = y[i] - yhat[i];
      num += e * e;
      den += (y[i] - mean) * (y[i] - mean);
    }
    const rmse = Math.sqrt(num / Math.max(1, y.length));
    const fit = den > 0 ? 100 * (1 - Math.sqrt(num / den)) : 0;
    const ks = Math.max(1, Math.min(20, k || 3));
    const n = y.length;
    const aic = n * Math.log(num / n + 1e-12) + 2 * ks;
    return { fit, rmse, aic: Number.isFinite(aic) ? aic : null };
  }

  function baseline(t, u, y) {
    const i = D.stepIndex(u);
    if (i < 1) throw new Error("No input step found.");
    const pre = Math.max(1, Math.floor(i * 0.25));
    const y0 = D.median(y.slice(Math.max(0, i - pre), i));
    const u0 = D.median(u.slice(Math.max(0, i - pre), i));
    const u1 = D.median(u.slice(i));
    const du = u1 - u0;
    if (!Number.isFinite(du) || Math.abs(du) < 1e-9) throw new Error("Input step amplitude is zero.");
    const tail = Math.max(3, Math.floor(y.length * 0.15));
    const yEnd = D.median(y.slice(-tail));
    return { i, y0, u0, u1, du, yEnd, stepTime: t[i] };
  }

  function initialDelay(t, y, b) {
    const noise = (() => {
      const d = D.diff(y.slice(0, b.i));
      return Math.abs(D.median(d)) * 1.4826 || 1e-9;
    })();
    const threshold = Math.max(noise * 3, Math.abs(b.yEnd - b.y0) * 0.02);
    for (let i = b.i; i < y.length; i++) {
      if (Math.abs(y[i] - b.y0) > threshold) return Math.max(0, t[i] - b.stepTime);
    }
    return 0;
  }

  function crossingTime(t, y, b, fraction) {
    const target = b.y0 + fraction * (b.yEnd - b.y0);
    for (let i = b.i; i < y.length; i++) {
      if ((b.yEnd >= b.y0 && y[i] >= target) || (b.yEnd < b.y0 && y[i] <= target)) return t[i] - b.stepTime;
    }
    return (t[t.length - 1] - b.stepTime) * 0.63;
  }

  function fitFOPDT(t, u, y) {
    const b = baseline(t, u, y);
    const L0 = initialDelay(t, y, b);
    const tau0 = Math.max(1e-6, crossingTime(t, y, b, 0.632) - L0);
    const span = Math.max(1e-6, t[t.length - 1] - b.stepTime);
    let best = null;
    const taus = [];
    for (let k = -8; k <= 8; k++) taus.push(tau0 * Math.pow(1.25, k));
    const delays = [0, 0.25, 0.5, 0.75, 1, 1.5, 2].map((f) => Math.min(span * 0.3, L0 * f));
    for (const tau of taus) {
      for (const L of delays) {
        const p = { y0: b.y0, K: 1, du: b.du, tau, L, stepTime: b.stepTime };
        let num = 0;
        let den = 0;
        for (let i = 0; i < t.length; i++) {
          const base = b.du * stepShape((t[i] - b.stepTime - L) / tau);
          num += (y[i] - b.y0) * base;
          den += base * base;
        }
        p.K = den > 0 ? num / den : (b.yEnd - b.y0) / b.du;
        const e = sse(t, y, firstOrderValue, p);
        if (!best || e < best.sse) best = { sse: e, p };
      }
    }
    // local refinement around the best grid point
    let p = { ...best.p };
    for (let iter = 0; iter < 2; iter++) {
      for (const f of [0.7, 0.85, 1, 1.15, 1.3]) {
        const q = { ...p, tau: p.tau * f };
        const e = sse(t, y, firstOrderValue, q);
        if (e < best.sse) best = { sse: e, p: q };
      }
      p = { ...best.p };
    }
    const yhat = t.map((x) => firstOrderValue(x, best.p));
    const stats = fitStats(y, yhat, 3);
    return { ...best.p, ...stats, model: "FOPDT", yhat, stepIndex: b.i };
  }

  function initialSecondOrder(t, y, b) {
    let peak = -Infinity;
    let peakAt = b.stepTime;
    for (let i = b.i; i < y.length; i++) {
      if (y[i] > peak) {
        peak = y[i];
        peakAt = t[i];
      }
    }
    const delta = peak - b.y0;
    const finalDelta = b.yEnd - b.y0;
    const mp = finalDelta !== 0 ? Math.max(0, (delta - finalDelta) / Math.abs(finalDelta)) : 0;
    const zeta =
      mp > 0 ? Math.max(0.05, -Math.log(mp) / Math.sqrt(Math.PI * Math.PI + Math.log(mp) * Math.log(mp))) : 1;
    const tp = Math.max(1e-6, peakAt - b.stepTime);
    const wn =
      zeta < 1 ? Math.PI / (tp * Math.sqrt(1 - zeta * zeta)) : 1 / Math.max(1e-6, crossingTime(t, y, b, 0.632));
    return { zeta, wn };
  }

  function fitSOPDT(t, u, y) {
    const b = baseline(t, u, y);
    const L0 = initialDelay(t, y, b);
    const init = initialSecondOrder(t, y, b);
    const span = Math.max(1e-6, t[t.length - 1] - b.stepTime);
    let best = null;
    const zetas = [];
    for (let z = 0.15; z <= 2.5; z += 0.1) zetas.push(z);
    const wn0 = Math.max(1e-4, init.wn);
    const wns = [];
    for (let k = -10; k <= 10; k++) wns.push(wn0 * Math.pow(1.3, k));
    const delays = [0, 0.5, 1, 1.5].map((f) => Math.min(span * 0.2, L0 * f));
    for (const zeta of zetas) {
      for (const wn of wns) {
        for (const L of delays) {
          const p = { y0: b.y0, K: 1, du: b.du, zeta, wn, L, stepTime: b.stepTime };
          let num = 0;
          let den = 0;
          for (let i = 0; i < t.length; i++) {
            const base = b.du * secondOrderShape(t[i] - b.stepTime - L, zeta, wn);
            num += (y[i] - b.y0) * base;
            den += base * base;
          }
          p.K = den > 0 ? num / den : (b.yEnd - b.y0) / b.du;
          const e = sse(t, y, secondOrderValue, p);
          if (!best || e < best.sse) best = { sse: e, p };
        }
      }
    }
    const yhat = t.map((x) => secondOrderValue(x, best.p));
    const stats = fitStats(y, yhat, 4);
    return { ...best.p, ...stats, model: "SOPDT", yhat, stepIndex: b.i };
  }

  function metrics(y, yhat) {
    return fitStats(y, yhat, 3);
  }

  function toMatlab(p) {
    if (p.model === "SOPDT") {
      return [
        `K = ${p.K.toPrecision(6)};`,
        `wn = ${p.wn.toPrecision(6)};`,
        `zeta = ${p.zeta.toPrecision(6)};`,
        `L = ${p.L.toPrecision(6)};`,
        "G = tf(K * wn^2, [1, 2*zeta*wn, wn^2], 'InputDelay', L);",
      ].join("\n");
    }
    return [
      `K = ${p.K.toPrecision(6)};`,
      `tau = ${p.tau.toPrecision(6)};`,
      `L = ${p.L.toPrecision(6)};`,
      "G = tf(K, [tau 1], 'InputDelay', L);",
    ].join("\n");
  }

  function simulate(p, t) {
    return t.map((x) => (p.model === "SOPDT" ? secondOrderValue(x, p) : firstOrderValue(x, p)));
  }

  return {
    fitFOPDT,
    fitSOPDT,
    simulate,
    metrics,
    toMatlab,
    firstOrderValue,
    secondOrderValue,
  };
});
