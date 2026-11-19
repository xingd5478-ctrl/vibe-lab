/* Model validation: one report for every identified model. UMD. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ModelValidation = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function mean(a) {
    const v = a.filter(Number.isFinite);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN;
  }

  function std(a) {
    const m = mean(a);
    const v = a.filter(Number.isFinite);
    return v.length ? Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / v.length) : NaN;
  }

  function corr(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 3) return 0;
    const ma = mean(a.slice(0, n));
    const mb = mean(b.slice(0, n));
    let num = 0,
      da = 0,
      db = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i] - ma,
        y = b[i] - mb;
      num += x * y;
      da += x * x;
      db += y * y;
    }
    return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
  }

  function roots(coeffs) {
    const a = coeffs.slice();
    while (a.length > 1 && Math.abs(a[0]) < 1e-14) a.shift();
    const n = a.length - 1;
    if (n < 1) return [];
    const c = a.map((v) => v / a[0]);
    let z = [];
    for (let i = 0; i < n; i++) z.push({ re: Math.cos((2 * Math.PI * i) / n), im: Math.sin((2 * Math.PI * i) / n) });
    const evalPoly = (x) => {
      let re = 0,
        im = 0;
      for (let i = 0; i < c.length; i++) {
        const nr = re * x.re - im * x.im + c[i];
        const ni = re * x.im + im * x.re;
        re = nr;
        im = ni;
      }
      return { re, im };
    };
    for (let iter = 0; iter < 120; iter++) {
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        let den = { re: 1, im: 0 };
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dr = z[i].re - z[j].re,
            di = z[i].im - z[j].im;
          const nr = den.re * dr - den.im * di;
          const ni = den.re * di + den.im * dr;
          den = { re: nr, im: ni };
        }
        const f = evalPoly(z[i]);
        const d = den.re * den.re + den.im * den.im || 1e-18;
        z[i] = { re: z[i].re - (f.re * den.re + f.im * den.im) / d, im: z[i].im + (f.re * den.im - f.im * den.re) / d };
        maxd = Math.max(maxd, Math.hypot(f.re, f.im));
      }
      if (maxd < 1e-10) break;
    }
    return z;
  }

  function stable(fit) {
    if (["FOPDT"].includes(fit.model)) return fit.tau > 0;
    if (["SOPDT"].includes(fit.model)) return fit.wn > 0 && fit.zeta > 0;
    if (fit.model === "ETFE" || fit.model === "FIR" || fit.model === "MIMO-ARX") return null;
    if (fit.coefA && fit.coefA.length) {
      const rr = roots([1].concat(fit.coefA));
      return rr.every((x) => Math.hypot(x.re, x.im) < 1 - 1e-9);
    }
    return null;
  }

  function validate(fit, data, quality) {
    if (!fit || !data || !fit.yhat) return null;
    if (fit.model === "ETFE" || fit.model === "MIMO-ARX") return null;
    const y = data.y;
    const n = y.length;
    const start = fit.start || 0;
    const res = [];
    for (let i = start; i < n; i++) res.push(y[i] - fit.yhat[i]);
    const m = mean(res),
      sd = std(res);
    const ac1 = corr(res.slice(1), res.slice(0, -1));
    let maxCross = 0;
    for (let lag = -5; lag <= 5; lag++) {
      const a = [],
        b = [];
      for (let i = start; i < n; i++) {
        const j = i + lag;
        if (j >= start && j < n) {
          a.push(res[i - start]);
          b.push(data.u[j]);
        }
      }
      if (a.length > 5) maxCross = Math.max(maxCross, Math.abs(corr(a, b)));
    }
    const checks = [];
    const add = (id, level, message, value) => checks.push({ id, level, message, value });
    const ft = fit.fitTrain != null ? fit.fitTrain : fit.fit;
    const fv = fit.fitVal;
    add("simulation", ft >= 80 ? "ok" : ft >= 50 ? "warn" : "fail", `simulation FIT ${ft.toFixed(1)}%`, ft);
    if (fv != null) {
      add("validation", fv >= 80 ? "ok" : fv >= 50 ? "warn" : "fail", `validation FIT ${fv.toFixed(1)}%`, fv);
      const gap = ft - fv;
      add("gap", gap <= 15 ? "ok" : gap <= 30 ? "warn" : "fail", `train/validation gap ${gap.toFixed(1)} points`, gap);
    }
    add("bias", Math.abs(m) <= Math.max(0.02, 0.1 * (sd || 1)) ? "ok" : "warn", `residual mean ${m.toPrecision(3)}`, m);
    add(
      "whiteness",
      Math.abs(ac1) <= 0.35 ? "ok" : Math.abs(ac1) <= 0.6 ? "warn" : "fail",
      `residual lag-1 correlation ${ac1.toFixed(2)}`,
      ac1
    );
    add("cross", maxCross <= 0.3 ? "ok" : "warn", `max residual/input correlation ${maxCross.toFixed(2)}`, maxCross);
    const st = stable(fit);
    if (st != null) add("stability", st ? "ok" : "fail", st ? "model is stable" : "model is unstable", st);
    const fails = checks.filter((c) => c.level === "fail").length;
    const warns = checks.filter((c) => c.level === "warn").length;
    const grade = fails ? "F" : warns > 1 ? "C" : warns ? "B" : "A";
    return { grade, checks, residualMean: m, residualStd: sd, ac1, maxCross, stability: st };
  }

  return { validate, roots };
});
