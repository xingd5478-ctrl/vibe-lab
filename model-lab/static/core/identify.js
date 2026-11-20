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

  function fitFOPDT(t, u, y, opts) {
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const tF = t.slice(0, trainEnd),
      uF = u.slice(0, trainEnd),
      yF = y.slice(0, trainEnd);
    const b = baseline(tF, uF, yF);
    const L0 = initialDelay(tF, yF, b);
    const tau0 = Math.max(1e-6, crossingTime(tF, yF, b, 0.632) - L0);
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
        for (let i = 0; i < tF.length; i++) {
          const base = b.du * stepShape((tF[i] - b.stepTime - L) / tau);
          num += (yF[i] - b.y0) * base;
          den += base * base;
        }
        p.K = den > 0 ? num / den : (b.yEnd - b.y0) / b.du;
        const e = sse(tF, yF, firstOrderValue, p);
        if (!best || e < best.sse) best = { sse: e, p };
      }
    }
    // local refinement around the best grid point
    let p = { ...best.p };
    for (let iter = 0; iter < 2; iter++) {
      for (const f of [0.7, 0.85, 1, 1.15, 1.3]) {
        const q = { ...p, tau: p.tau * f };
        const e = sse(tF, yF, firstOrderValue, q);
        if (e < best.sse) best = { sse: e, p: q };
      }
      p = { ...best.p };
    }
    const yhat = t.map((x) => firstOrderValue(x, best.p));
    const stats = fitStats(y, yhat, 3);
    const fitTrain = fitStats(yF, yhat.slice(0, trainEnd), 3);
    const fitVal = trainEnd < t.length ? fitStats(y.slice(trainEnd), yhat.slice(trainEnd), 3) : null;
    return {
      ...best.p,
      ...stats,
      fitTrain: fitTrain.fit,
      fitVal: fitVal ? fitVal.fit : null,
      trainEnd,
      model: "FOPDT",
      yhat,
      stepIndex: b.i,
    };
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

  function fitSOPDT(t, u, y, opts) {
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const tF = t.slice(0, trainEnd),
      uF = u.slice(0, trainEnd),
      yF = y.slice(0, trainEnd);
    const b = baseline(tF, uF, yF);
    const L0 = initialDelay(tF, yF, b);
    const init = initialSecondOrder(tF, yF, b);
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
          for (let i = 0; i < tF.length; i++) {
            const base = b.du * secondOrderShape(tF[i] - b.stepTime - L, zeta, wn);
            num += (yF[i] - b.y0) * base;
            den += base * base;
          }
          p.K = den > 0 ? num / den : (b.yEnd - b.y0) / b.du;
          const e = sse(tF, yF, secondOrderValue, p);
          if (!best || e < best.sse) best = { sse: e, p };
        }
      }
    }
    const yhat = t.map((x) => secondOrderValue(x, best.p));
    const stats = fitStats(y, yhat, 4);
    const fitTrain = fitStats(yF, yhat.slice(0, trainEnd), 4);
    const fitVal = trainEnd < t.length ? fitStats(y.slice(trainEnd), yhat.slice(trainEnd), 4) : null;
    return {
      ...best.p,
      ...stats,
      fitTrain: fitTrain.fit,
      fitVal: fitVal ? fitVal.fit : null,
      trainEnd,
      model: "SOPDT",
      yhat,
      stepIndex: b.i,
    };
  }

  function ridgeSolve(A, b, lambda) {
    const p = A[0].length;
    const M = Array.from({ length: p }, () => new Array(p).fill(0));
    const v = new Array(p).fill(0);
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < p; j++) {
        v[j] += A[i][j] * b[i];
        for (let k = 0; k < p; k++) M[j][k] += A[i][j] * A[i][k];
      }
    }
    let scale = 0;
    for (let i = 0; i < p; i++) scale += M[i][i];
    const ridge = (lambda || 1e-8) * Math.max(1, scale / p);
    for (let i = 0; i < p; i++) M[i][i] += ridge;
    for (let i = 0; i < p; i++) {
      let pivot = i;
      for (let k = i + 1; k < p; k++) if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
      [M[i], M[pivot]] = [M[pivot], M[i]];
      [v[i], v[pivot]] = [v[pivot], v[i]];
      const d = M[i][i] || 1e-12;
      for (let j = i; j < p; j++) M[i][j] /= d;
      v[i] /= d;
      for (let k = 0; k < p; k++) {
        if (k === i) continue;
        const f = M[k][i];
        for (let j = i; j < p; j++) M[k][j] -= f * M[i][j];
        v[k] -= f * v[i];
      }
    }
    return v;
  }

  function solveLinear(M, b) {
    const n = M.length;
    const A = M.map((row, i) => row.concat([b[i]]));
    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[pivot][i])) pivot = k;
      [A[i], A[pivot]] = [A[pivot], A[i]];
      const d = A[i][i] || 1e-12;
      for (let j = i; j <= n; j++) A[i][j] /= d;
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const f = A[k][i];
        for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j];
      }
    }
    return A.map((row) => row[n]);
  }

  function fitIVARX(t, u, y, r, opts) {
    if (!r || r.length !== y.length) throw new Error("IV-ARX needs a setpoint/reference column r.");
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const na = Math.max(1, Math.min(6, (opts && opts.na) || 2));
    const nb = Math.max(1, Math.min(6, (opts && opts.nb) || 2));
    const nk = Math.max(0, Math.min(5, opts && opts.nk != null ? opts.nk : 1));
    const start = Math.max(na, nk + nb - 1);
    if (start >= trainEnd - 2) throw new Error("Not enough samples for IV-ARX.");
    const A = [],
      B = [],
      Z = [];
    for (let k = start; k < trainEnd; k++) {
      const row = [];
      for (let i = 1; i <= na; i++) row.push(-y[k - i]);
      for (let i = 0; i < nb; i++) row.push(u[k - nk - i]);
      A.push(row);
      B.push(y[k]);
      const zrow = [];
      for (let i = 0; i < row.length; i++) zrow.push(r[k - i] || 0);
      Z.push(zrow);
    }
    const p = A[0].length;
    const M = Array.from({ length: p }, () => new Array(p).fill(0));
    const v = new Array(p).fill(0);
    for (let k = 0; k < A.length; k++) {
      for (let i = 0; i < p; i++) {
        v[i] += Z[k][i] * B[k];
        for (let j = 0; j < p; j++) M[i][j] += Z[k][i] * A[k][j];
      }
    }
    for (let i = 0; i < p; i++) M[i][i] += 1e-6;
    const theta = solveLinear(M, v);
    const coefA = theta.slice(0, na);
    const coefB = theta.slice(na);
    const predict = (begin, end) => {
      const out = y.slice();
      for (let k = begin; k < end; k++) {
        let val = 0;
        for (let i = 1; i <= na; i++) val -= coefA[i - 1] * out[k - i];
        for (let i = 0; i < nb; i++) val += coefB[i] * u[k - nk - i];
        out[k] = val;
      }
      return out;
    };
    const trainHat = predict(start, trainEnd);
    const valHat = trainEnd < t.length ? predict(trainEnd, t.length) : y.slice();
    const yhat = y.map((val, i) => (i < trainEnd ? trainHat[i] : valHat[i]));
    for (let i = 0; i < start; i++) yhat[i] = y[i];
    const ft = fitStats(y.slice(start, trainEnd), yhat.slice(start, trainEnd), 2 + na + nb);
    const fv = trainEnd < t.length ? fitStats(y.slice(trainEnd), yhat.slice(trainEnd), 2 + na + nb) : null;
    let direct = null;
    try {
      direct = fitARX(t, u, y, { trainEnd, na, nb, nk });
    } catch (e) {}
    return {
      model: "IV-ARX",
      na,
      nb,
      nk,
      coefA,
      coefB,
      yhat,
      fit: fitStats(y, yhat, 2 + na + nb).fit,
      fitTrain: ft.fit,
      fitVal: fv ? fv.fit : null,
      fitDirect: direct ? direct.fitTrain : null,
      trainEnd,
      start,
    };
  }

  function fit2SLS(t, u, y, r, opts) {
    if (!r || r.length !== y.length) throw new Error("2SLS needs a setpoint/reference column r.");
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const na = Math.max(1, Math.min(6, (opts && opts.na) || 2));
    const nb = Math.max(1, Math.min(6, (opts && opts.nb) || 2));
    const nk = Math.max(0, Math.min(5, opts && opts.nk != null ? opts.nk : 1));
    const start = Math.max(na, nk + nb - 1);
    if (start >= trainEnd - 2) throw new Error("Not enough samples for 2SLS.");
    const K = Math.max(4, na + nb + 2);
    const Z = [],
      U = [];
    for (let k = start; k < trainEnd; k++) {
      const z = [1];
      for (let i = 0; i < K; i++) z.push(r[k - i] || 0);
      Z.push(z);
      U.push(u[k]);
    }
    const pz = Z[0].length;
    const M = Array.from({ length: pz }, () => new Array(pz).fill(0));
    const v = new Array(pz).fill(0);
    for (let i = 0; i < Z.length; i++) {
      for (let a = 0; a < pz; a++) {
        v[a] += Z[i][a] * U[i];
        for (let b = 0; b < pz; b++) M[a][b] += Z[i][a] * Z[i][b];
      }
    }
    for (let i = 0; i < pz; i++) M[i][i] += 1e-6;
    const theta = solveLinear(M, v);
    const uhat = u.slice();
    for (let k = start; k < trainEnd; k++) {
      let val = theta[0];
      for (let i = 0; i < K; i++) val += theta[i + 1] * (r[k - i] || 0);
      uhat[k] = val;
    }
    const fit = fitARX(t, uhat, y, { trainEnd, na, nb, nk });
    let direct = null;
    try {
      direct = fitARX(t, u, y, { trainEnd, na, nb, nk });
    } catch (e) {}
    return { ...fit, model: "2SLS-ARX", uhat, fitDirect: direct ? direct.fitTrain : null };
  }

  function fitHammerstein(t, u, y, opts) {
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const na = Math.max(1, Math.min(4, (opts && opts.na) || 1));
    const nb = Math.max(1, Math.min(4, (opts && opts.nb) || 1));
    const nk = Math.max(0, Math.min(3, opts && opts.nk != null ? opts.nk : 1));
    let best = null;
    let scan = 0;
    for (let c2 = -1; c2 <= 1.0001; c2 += 0.04) {
      if (opts && opts.shouldAbort && opts.shouldAbort()) throw new Error("ABORTED");
      scan++;
      if (opts && opts.onProgress) opts.onProgress(scan / 51);
      const v = u.map((x) => x + c2 * x * x);
      let f;
      try {
        f = fitARX(t, v, y, { trainEnd, na, nb, nk });
      } catch (e) {
        continue;
      }
      if (!best || f.fitTrain > best.fitTrain) best = { ...f, c2 };
    }
    if (!best) throw new Error("Hammerstein initialization failed.");
    best.model = "Hammerstein";
    return best;
  }

  function nelderMead(fn, x0, opts) {
    const n = x0.length;
    const maxIter = (opts && opts.maxIter) || 220;
    const step = (opts && opts.step) || 0.1;
    let simplex = [x0.slice()];
    for (let i = 0; i < n; i++) {
      const x = x0.slice();
      x[i] += (Math.abs(x[i]) || 1) * step;
      simplex.push(x);
    }
    const score = (x) => {
      try {
        const v = fn(x);
        return Number.isFinite(v) ? v : 1e12;
      } catch (e) {
        return 1e12;
      }
    };
    let vals = simplex.map(score);
    for (let iter = 0; iter < maxIter; iter++) {
      if (opts && opts.shouldAbort && opts.shouldAbort()) throw new Error("ABORTED");
      if (opts && opts.onProgress && (iter % 5 === 0 || iter === maxIter - 1)) opts.onProgress((iter + 1) / maxIter);
      const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
      simplex = order.map((i) => simplex[i]);
      vals = order.map((i) => vals[i]);
      if (Math.abs(vals[n] - vals[0]) < 1e-9) break;
      const centroid = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
      const reflect = centroid.map((c, j) => c + (c - simplex[n][j]));
      const fr = score(reflect);
      if (fr < vals[0]) {
        const expand = centroid.map((c, j) => c + 2 * (c - simplex[n][j]));
        const fe = score(expand);
        if (fe < fr) {
          simplex[n] = expand;
          vals[n] = fe;
        } else {
          simplex[n] = reflect;
          vals[n] = fr;
        }
      } else if (fr < vals[n - 1]) {
        simplex[n] = reflect;
        vals[n] = fr;
      } else {
        const contract = centroid.map((c, j) => c + 0.5 * (simplex[n][j] - c));
        const fc = score(contract);
        if (fc < vals[n]) {
          simplex[n] = contract;
          vals[n] = fc;
        } else {
          for (let i = 1; i <= n; i++) {
            simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
            vals[i] = score(simplex[i]);
          }
        }
      }
    }
    const best = vals.indexOf(Math.min(...vals));
    return simplex[best];
  }

  function fitFIR(t, u, y, opts) {
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const nh = Math.max(2, Math.min(60, (opts && opts.nh) || 20));
    const start = nh;
    if (start >= trainEnd - 2) throw new Error("Not enough samples for FIR.");
    const A = [],
      B = [];
    for (let k = start; k < trainEnd; k++) {
      const row = [1];
      for (let i = 0; i < nh; i++) row.push(u[k - i]);
      A.push(row);
      B.push(y[k]);
    }
    const theta = qrSolve(A, B);
    const predict = (begin, end) => {
      const out = y.slice();
      for (let k = begin; k < end; k++) {
        let v = theta[0];
        for (let i = 0; i < nh; i++) v += theta[i + 1] * u[k - i];
        out[k] = v;
      }
      return out;
    };
    const yhat = predict(start, t.length);
    for (let i = 0; i < start; i++) yhat[i] = y[i];
    const ft = fitStats(y.slice(start, trainEnd), yhat.slice(start, trainEnd), nh + 1);
    const fv = trainEnd < t.length ? fitStats(y.slice(trainEnd), yhat.slice(trainEnd), nh + 1) : null;
    return {
      model: "FIR",
      nh,
      h: theta.slice(1),
      bias: theta[0],
      yhat,
      fit: fitStats(y, yhat, nh + 1).fit,
      fitTrain: ft.fit,
      fitVal: fv ? fv.fit : null,
      trainEnd,
      start,
    };
  }

  function fitOE(t, u, y, opts) {
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const na = Math.max(1, Math.min(4, (opts && opts.na) || 2));
    const nb = Math.max(1, Math.min(4, (opts && opts.nb) || 2));
    const nk = Math.max(0, Math.min(3, opts && opts.nk != null ? opts.nk : 1));
    const start = Math.max(na, nk + nb - 1);
    const initARX = fitARX(t, u, y, { trainEnd, na, nb, nk });
    const x0 = initARX.coefA.concat(initARX.coefB);
    const simulate = (theta, end, begin) => {
      const out = y.slice();
      for (let k = begin; k < end; k++) {
        let v = 0;
        for (let i = 1; i <= na; i++) v -= theta[i - 1] * out[k - i];
        for (let i = 0; i < nb; i++) v += theta[na + i] * u[k - nk - i];
        out[k] = v;
      }
      return out;
    };
    const objective = (theta) => {
      const out = simulate(theta, trainEnd, start);
      let e = 0;
      for (let k = start; k < trainEnd; k++) {
        const d = y[k] - out[k];
        e += d * d;
      }
      return e;
    };
    const theta = nelderMead(objective, x0, { maxIter: 180, step: 0.08, onProgress: opts && opts.onProgress });
    const yhat = simulate(theta, t.length, start);
    const ft = fitStats(y.slice(start, trainEnd), yhat.slice(start, trainEnd), na + nb);
    const fv = trainEnd < t.length ? fitStats(y.slice(trainEnd), yhat.slice(trainEnd), na + nb) : null;
    return {
      model: "OE",
      na,
      nb,
      nk,
      coefA: theta.slice(0, na),
      coefB: theta.slice(na),
      yhat,
      fit: fitStats(y, yhat, na + nb).fit,
      fitTrain: ft.fit,
      fitVal: fv ? fv.fit : null,
      trainEnd,
      start,
    };
  }

  function fitARMAX(t, u, y, opts) {
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const na = Math.max(1, Math.min(4, (opts && opts.na) || 1));
    const nb = Math.max(1, Math.min(4, (opts && opts.nb) || 1));
    const nc = Math.max(1, Math.min(4, (opts && opts.nc) || 1));
    const nk = Math.max(0, Math.min(3, opts && opts.nk != null ? opts.nk : 1));
    const start = Math.max(na, nc, nk + nb - 1);
    const x0 = new Array(na + nb + nc).fill(0);
    const predictSeq = (theta, end) => {
      const out = y.slice(),
        err = new Array(y.length).fill(0);
      for (let k = start; k < end; k++) {
        let v = 0;
        for (let i = 1; i <= na; i++) v -= theta[i - 1] * y[k - i];
        for (let i = 0; i < nb; i++) v += theta[na + i] * u[k - nk - i];
        for (let i = 1; i <= nc; i++) v += theta[na + nb + i - 1] * err[k - i];
        out[k] = v;
        err[k] = y[k] - v;
      }
      return out;
    };
    const objective = (theta) => {
      const out = predictSeq(theta, trainEnd);
      let e = 0;
      for (let k = start; k < trainEnd; k++) {
        const d = y[k] - out[k];
        e += d * d;
      }
      return e;
    };
    const theta = nelderMead(objective, x0, { maxIter: 220, step: 0.15, onProgress: opts && opts.onProgress });
    const yhat = predictSeq(theta, t.length);
    const ft = fitStats(y.slice(start, trainEnd), yhat.slice(start, trainEnd), na + nb + nc);
    const fv = trainEnd < t.length ? fitStats(y.slice(trainEnd), yhat.slice(trainEnd), na + nb + nc) : null;
    return {
      model: "ARMAX",
      na,
      nb,
      nc,
      nk,
      coefA: theta.slice(0, na),
      coefB: theta.slice(na, na + nb),
      coefC: theta.slice(na + nb),
      yhat,
      fit: fitStats(y, yhat, na + nb + nc).fit,
      fitTrain: ft.fit,
      fitVal: fv ? fv.fit : null,
      trainEnd,
      start,
    };
  }

  function fitWiener(t, u, y, opts) {
    const base = fitARX(t, u, y, opts);
    const x = base.yhat.slice(base.start, base.trainEnd);
    const yy = y.slice(base.start, base.trainEnd);
    const A = x.map((v) => [1, v, v * v]);
    const c = qrSolve(A, yy);
    const yhat = base.yhat.map((v) => c[0] + c[1] * v + c[2] * v * v);
    const ft = fitStats(y.slice(base.start, base.trainEnd), yhat.slice(base.start, base.trainEnd), 4);
    const fv = base.trainEnd < t.length ? fitStats(y.slice(base.trainEnd), yhat.slice(base.trainEnd), 4) : null;
    return {
      ...base,
      model: "Wiener",
      c0: c[0],
      c1: c[1],
      c2: c[2],
      yhat,
      fit: fitStats(y, yhat, 4).fit,
      fitTrain: ft.fit,
      fitVal: fv ? fv.fit : null,
    };
  }

  function fitSS(t, u, y, opts) {
    const base = fitARX(t, u, y, opts);
    const na = base.na,
      nb = base.nb,
      nk = base.nk;
    const n = Math.max(na, nk + nb);
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < na; i++) A[0][i] = -base.coefA[i];
    for (let i = 1; i < n; i++) A[i][i - 1] = 1;
    const B = new Array(n).fill(0);
    B[0] = 1;
    const C = new Array(n).fill(0);
    for (let i = 0; i < nb; i++) if (nk + i < n) C[nk + i] = base.coefB[i];
    const D = 0;
    return { ...base, model: "SS", A, B, C, D, n };
  }

  function fitMIMOARX(t, U, Y, opts) {
    const n = t.length;
    const m = U.length;
    const p = Y.length;
    const trainEnd = opts && opts.trainEnd ? Math.min(n, Math.max(8, opts.trainEnd)) : n;
    const na = Math.max(1, Math.min(4, (opts && opts.na) || 2));
    const nb = Math.max(1, Math.min(4, (opts && opts.nb) || 2));
    const nk = Math.max(0, Math.min(4, opts && opts.nk != null ? opts.nk : 1));
    const start = Math.max(na, nk + nb - 1);
    if (start >= trainEnd - 2) throw new Error("Not enough samples for MIMO ARX.");
    const coefA = [],
      coefB = [];
    for (let out = 0; out < p; out++) {
      if (opts && opts.shouldAbort && opts.shouldAbort()) throw new Error("ABORTED");
      if (opts && opts.onProgress) opts.onProgress((out + 1) / p);
      const A = [],
        B = [];
      for (let k = start; k < trainEnd; k++) {
        const row = [];
        for (let j = 0; j < p; j++) for (let i = 1; i <= na; i++) row.push(-Y[j][k - i]);
        for (let j = 0; j < m; j++) for (let i = 0; i < nb; i++) row.push(U[j][k - nk - i]);
        A.push(row);
        B.push(Y[out][k]);
      }
      const theta = ridgeSolve(A, B, 1e-6);
      coefA.push(theta.slice(0, p * na));
      coefB.push(theta.slice(p * na));
    }
    const simulate = (begin, end) => {
      const out = Y.map((row) => row.slice());
      for (let k = begin; k < end; k++) {
        for (let o = 0; o < p; o++) {
          let v = 0;
          for (let j = 0; j < p; j++) for (let i = 1; i <= na; i++) v -= coefA[o][j * na + i - 1] * out[j][k - i];
          for (let j = 0; j < m; j++) for (let i = 0; i < nb; i++) v += coefB[o][j * nb + i] * U[j][k - nk - i];
          out[o][k] = v;
        }
      }
      return out;
    };
    const trainHat = simulate(start, trainEnd);
    const valHat = trainEnd < n ? simulate(trainEnd, n) : Y.map((r) => r.slice());
    const yhat = Y.map((row, o) => row.map((v, i) => (i < trainEnd ? trainHat[o][i] : valHat[o][i])));
    const fitOut = [];
    const fitTrainOut = [];
    const fitValOut = [];
    for (let o = 0; o < p; o++) {
      fitOut.push(fitStats(Y[o], yhat[o], 2 + p * na + m * nb).fit);
      fitTrainOut.push(fitStats(Y[o].slice(start, trainEnd), yhat[o].slice(start, trainEnd), 2 + p * na + m * nb).fit);
      fitValOut.push(
        trainEnd < n ? fitStats(Y[o].slice(trainEnd), yhat[o].slice(trainEnd), 2 + p * na + m * nb).fit : null
      );
    }
    const avg = (a) =>
      a.filter((x) => x != null).reduce((x, y) => x + y, 0) / Math.max(1, a.filter((x) => x != null).length);
    return {
      model: "MIMO-ARX",
      na,
      nb,
      nk,
      m,
      p,
      coefA,
      coefB,
      yhat,
      fit: avg(fitOut),
      fitTrain: avg(fitTrainOut),
      fitVal: avg(fitValOut),
      fitOut,
      fitTrainOut,
      fitValOut,
      start,
      trainEnd,
    };
  }

  function qrSolve(A, b) {
    const m = A.length;
    const n = A[0].length;
    const q = [];
    const r = Array.from({ length: n }, () => new Array(n).fill(0));
    const y = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      const v = new Array(m);
      for (let i = 0; i < m; i++) v[i] = A[i][j];
      for (let k = 0; k < j; k++) {
        let dot = 0;
        for (let i = 0; i < m; i++) dot += q[k][i] * v[i];
        r[k][j] = dot;
        for (let i = 0; i < m; i++) v[i] -= dot * q[k][i];
      }
      let norm = 0;
      for (let i = 0; i < m; i++) norm += v[i] * v[i];
      norm = Math.sqrt(norm) || 1e-12;
      r[j][j] = norm;
      q.push(v.map((x) => x / norm));
      let dot = 0;
      for (let i = 0; i < m; i++) dot += q[j][i] * b[i];
      y[j] = dot;
    }
    const theta = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let v = y[i];
      for (let j = i + 1; j < n; j++) v -= r[i][j] * theta[j];
      theta[i] = v / r[i][i];
    }
    return theta;
  }

  function fitARX(t, u, y, opts) {
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const na = Math.max(1, Math.min(6, (opts && opts.na) || 2));
    const nb = Math.max(1, Math.min(6, (opts && opts.nb) || 2));
    const nk = Math.max(0, Math.min(5, opts && opts.nk != null ? opts.nk : 1));
    const start = Math.max(na, nk + nb - 1);
    if (start >= trainEnd - 2) throw new Error("Not enough samples for ARX orders.");
    const A = [];
    const B = [];
    for (let k = start; k < trainEnd; k++) {
      const row = [];
      for (let i = 1; i <= na; i++) row.push(-y[k - i]);
      for (let i = 0; i < nb; i++) row.push(u[k - nk - i]);
      A.push(row);
      B.push(y[k]);
    }
    const theta = qrSolve(A, B);
    const coefA = theta.slice(0, na);
    const coefB = theta.slice(na);
    const predictFrom = (begin, end) => {
      const out = y.slice();
      for (let k = begin; k < end; k++) {
        let v = 0;
        for (let i = 1; i <= na; i++) v -= coefA[i - 1] * out[k - i];
        for (let i = 0; i < nb; i++) v += coefB[i] * u[k - nk - i];
        out[k] = v;
      }
      return out;
    };
    const trainHat = predictFrom(start, trainEnd);
    const valHat = trainEnd < t.length ? predictFrom(trainEnd, t.length) : y.slice();
    const yhat = y.map((v, i) => (i < trainEnd ? trainHat[i] : valHat[i]));
    for (let i = 0; i < start; i++) yhat[i] = y[i];
    const stats = fitStats(y, yhat, 2 + na + nb);
    const ft = fitStats(y.slice(start, trainEnd), yhat.slice(start, trainEnd), 2 + na + nb);
    const fv = trainEnd < t.length ? fitStats(y.slice(trainEnd), yhat.slice(trainEnd), 2 + na + nb) : null;
    return {
      model: "ARX",
      na,
      nb,
      nk,
      coefA,
      coefB,
      yhat,
      fit: stats.fit,
      fitTrain: ft.fit,
      fitVal: fv ? fv.fit : null,
      trainEnd,
      start,
    };
  }

  function nextPow2(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  function fft(re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = ((inverse ? 2 : -2) * Math.PI) / len;
      const wr = Math.cos(ang),
        wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1,
          ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const ur = re[i + j],
            ui = im[i + j];
          const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
          const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
          re[i + j] = ur + vr;
          im[i + j] = ui + vi;
          re[i + j + len / 2] = ur - vr;
          im[i + j + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  }

  function fitETFE(t, u, y, opts) {
    const n = t.length;
    if (n < 64) throw new Error("ETFE needs at least 64 samples.");
    const dt = [];
    for (let i = 1; i < n; i++) dt.push(t[i] - t[i - 1]);
    const dtMed = D.median(dt);
    const jitter = (D.quantile(dt, 0.9) - D.quantile(dt, 0.1)) / (dtMed || 1);
    if (!(dtMed > 0) || jitter > 0.3) throw new Error("ETFE needs a uniform sample interval.");
    const fs = 1 / dtMed;
    let segLen = 256;
    while (segLen > 64 && segLen > n / 3) segLen /= 2;
    const nSeg = Math.floor(n / segLen);
    if (nSeg < 2) throw new Error("ETFE needs at least two segments; record longer data.");
    const bins = segLen / 2;
    const Suu = new Array(bins).fill(0);
    const Syy = new Array(bins).fill(0);
    const SyuR = new Array(bins).fill(0);
    const SyuI = new Array(bins).fill(0);
    for (let s = 0; s < nSeg; s++) {
      const off = s * segLen;
      const reU = new Array(segLen),
        imU = new Array(segLen).fill(0);
      const reY = new Array(segLen),
        imY = new Array(segLen).fill(0);
      let mu = 0,
        my = 0;
      for (let i = 0; i < segLen; i++) {
        mu += u[off + i];
        my += y[off + i];
      }
      mu /= segLen;
      my /= segLen;
      for (let i = 0; i < segLen; i++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (segLen - 1));
        reU[i] = (u[off + i] - mu) * w;
        reY[i] = (y[off + i] - my) * w;
      }
      fft(reU, imU, false);
      fft(reY, imY, false);
      for (let k = 1; k < bins; k++) {
        const ur = reU[k],
          ui = imU[k],
          yr = reY[k],
          yi = imY[k];
        Suu[k] += ur * ur + ui * ui;
        Syy[k] += yr * yr + yi * yi;
        SyuR[k] += yr * ur + yi * ui;
        SyuI[k] += yi * ur - yr * ui;
      }
    }
    const freq = [],
      mag = [],
      phase = [],
      coh = [];
    for (let k = 1; k < bins; k++) {
      const den = Suu[k] || 1e-18;
      const hr = SyuR[k] / den;
      const hi = SyuI[k] / den;
      const c = Suu[k] * Syy[k] > 0 ? (SyuR[k] * SyuR[k] + SyuI[k] * SyuI[k]) / (Suu[k] * Syy[k]) : 0;
      freq.push((k * fs) / segLen);
      mag.push(Math.hypot(hr, hi));
      phase.push(Math.atan2(hi, hr));
      coh.push(Math.max(0, Math.min(1, c)));
    }
    const good = coh.filter((c) => c > 0.5);
    const medianCoh = D.median(good.length ? good : coh);
    return {
      model: "ETFE",
      freq,
      mag,
      phase,
      coherence: coh,
      medianCoherence: medianCoh,
      fit: good.length ? 100 * medianCoh : 0,
      fitTrain: good.length ? 100 * medianCoh : 0,
      fitVal: null,
      trainEnd: n,
      segments: nSeg,
      segLen,
      fs,
    };
  }

  function metrics(y, yhat) {
    return fitStats(y, yhat, 3);
  }

  function percentile(values, p) {
    const a = values
      .filter(Number.isFinite)
      .slice()
      .sort((x, y) => x - y);
    if (!a.length) return NaN;
    const pos = (a.length - 1) * p;
    const lo = Math.floor(pos),
      hi = Math.ceil(pos);
    return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (pos - lo);
  }

  function bootstrap(t, u, y, model, opts) {
    if (model === "ETFE") throw new Error("Uncertainty is not available for ETFE yet.");
    const B = Math.max(4, Math.min(30, (opts && opts.B) || 12));
    const trainEnd = opts && opts.trainEnd ? Math.min(t.length, Math.max(8, opts.trainEnd)) : t.length;
    const fit =
      model === "ARX"
        ? fitARX(t, u, y, { ...opts, trainEnd })
        : model === "SOPDT"
          ? fitSOPDT(t, u, y, { trainEnd })
          : fitFOPDT(t, u, y, { trainEnd });
    const residual = [];
    for (let i = 0; i < trainEnd; i++) residual.push(y[i] - fit.yhat[i]);
    let seed = 1234567;
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const samples = [];
    for (let b = 0; b < B; b++) {
      const yb = y.slice();
      for (let i = 0; i < trainEnd; i++) yb[i] = fit.yhat[i] + residual[Math.floor(rand() * residual.length)];
      try {
        const fb =
          model === "ARX"
            ? fitARX(t, u, yb, { ...opts, trainEnd, na: fit.na, nb: fit.nb, nk: fit.nk })
            : model === "SOPDT"
              ? fitSOPDT(t, u, yb, { trainEnd })
              : fitFOPDT(t, u, yb, { trainEnd });
        samples.push(fb);
      } catch (e) {}
    }
    const pick = (key) => samples.map((s) => s[key]).filter(Number.isFinite);
    const interval = (key) => {
      const a = pick(key);
      return [percentile(a, 0.025), percentile(a, 0.975)];
    };
    const intervals =
      model === "ARX"
        ? {
            a1: [
              percentile(
                samples.map((s) => s.coefA[0]),
                0.025
              ),
              percentile(
                samples.map((s) => s.coefA[0]),
                0.975
              ),
            ],
            b1: [
              percentile(
                samples.map((s) => s.coefB[0]),
                0.025
              ),
              percentile(
                samples.map((s) => s.coefB[0]),
                0.975
              ),
            ],
          }
        : model === "SOPDT"
          ? { K: interval("K"), wn: interval("wn"), zeta: interval("zeta"), L: interval("L") }
          : { K: interval("K"), tau: interval("tau"), L: interval("L") };
    return { model, B: samples.length, intervals, samples };
  }

  function toMatlab(p) {
    if (p.model === "SS") {
      const mat = (M) => "[" + M.map((r) => r.map((x) => Number(x).toPrecision(6)).join(", ")).join("; ") + "]";
      return [
        `A = ${mat(p.A)};`,
        `B = [${p.B.map((x) => Number(x).toPrecision(6)).join("; ")}];`,
        `C = [${p.C.map((x) => Number(x).toPrecision(6)).join(", ")}];`,
        `D = ${p.D};`,
        "sys = ss(A,B,C,D,1);",
      ].join("\n");
    }
    if (p.model === "FIR") {
      return [
        `h = [${p.h.map((x) => x.toPrecision(6)).join(", ")}];`,
        `bias = ${p.bias.toPrecision(6)};`,
        "impulse(h);",
      ].join("\n");
    }
    if (p.model === "OE") {
      return [
        `a = [1, ${p.coefA.map((x) => x.toPrecision(6)).join(", ")}];`,
        `b = [${Array(p.nk)
          .fill(0)
          .concat(p.coefB)
          .map((x) => Number(x).toPrecision(6))
          .join(", ")}];`,
        "G = tf(b, a, 1);",
      ].join("\n");
    }
    if (p.model === "ARMAX") {
      return [
        `a = [1, ${p.coefA.map((x) => x.toPrecision(6)).join(", ")}];`,
        `b = [${Array(p.nk)
          .fill(0)
          .concat(p.coefB)
          .map((x) => Number(x).toPrecision(6))
          .join(", ")}];`,
        `c = [1, ${p.coefC.map((x) => x.toPrecision(6)).join(", ")}];`,
        'G = tf(b, a, 1, "Variable", "z^-1");',
      ].join("\n");
    }
    if (p.model === "Wiener") {
      return [
        "% Wiener: ARX linear part + static output polynomial",
        `c = [${p.c0.toPrecision(6)}, ${p.c1.toPrecision(6)}, ${p.c2.toPrecision(6)}];`,
        `a = [1, ${p.coefA.map((x) => x.toPrecision(6)).join(", ")}];`,
        `b = [${Array(p.nk)
          .fill(0)
          .concat(p.coefB)
          .map((x) => Number(x).toPrecision(6))
          .join(", ")}];`,
      ].join("\n");
    }
    if (p.model === "Hammerstein") {
      return [
        "% Hammerstein ARX: v = u + c2*u^2, then ARX(v -> y)",
        `c2 = ${p.c2.toPrecision(6)};`,
        `a = [1, ${p.coefA.map((x) => x.toPrecision(6)).join(", ")}];`,
        `b = [${Array(p.nk)
          .fill(0)
          .concat(p.coefB)
          .map((x) => Number(x).toPrecision(6))
          .join(", ")}];`,
      ].join("\n");
    }
    if (p.model === "2SLS-ARX" || p.model === "IV-ARX") {
      return [
        "% IV-ARX (closed-loop, setpoint instrument)",
        `a = [1, ${p.coefA.map((x) => x.toPrecision(6)).join(", ")}];`,
        `b = [${Array(p.nk)
          .fill(0)
          .concat(p.coefB)
          .map((x) => Number(x).toPrecision(6))
          .join(", ")}];`,
        'G = tf(b, a, 1, "Variable", "z^-1");',
      ].join("\n");
    }
    if (p.model === "MIMO-ARX") {
      const lines = ["% MIMO ARX: y_o(k) = A_o(z^-1) y(k) + B_o(z^-1) u(k), Ts = 1 sample"];
      for (let o = 0; o < p.p; o++) {
        lines.push(`A${o + 1} = [1, ${p.coefA[o].map((x) => x.toPrecision(6)).join(", ")}];`);
        lines.push(`B${o + 1} = [${p.coefB[o].map((x) => x.toPrecision(6)).join(", ")}];`);
      }
      return lines.join("\n");
    }
    if (p.model === "ETFE") {
      return [
        `f = [${p.freq.map((x) => x.toPrecision(6)).join(", ")}];`,
        `H = [${p.mag.map((x, i) => `${x.toPrecision(6)}*exp(1j*${p.phase[i].toPrecision(6)})`).join(", ")}];`,
        "figure; subplot(2,1,1); semilogx(f, 20*log10(abs(H))); grid on;",
        "subplot(2,1,2); semilogx(f, unwrap(angle(H))*180/pi); grid on;",
      ].join("\n");
    }
    if (p.model === "ARX") {
      return [
        `a = [1, ${p.coefA.map((x) => x.toPrecision(6)).join(", ")}];`,
        `b = [${Array(p.nk)
          .fill(0)
          .concat(p.coefB)
          .map((x) => Number(x).toPrecision(6))
          .join(", ")}];`,
        `G = tf(b, a, 1, "Variable", "z^-1");`,
      ].join("\n");
    }
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
    fitARX,
    fitMIMOARX,
    fitETFE,
    fitIVARX,
    fit2SLS,
    fitHammerstein,
    fitFIR,
    fitOE,
    fitARMAX,
    fitWiener,
    fitSS,
    bootstrap,
    simulate,
    metrics,
    toMatlab,
    firstOrderValue,
    secondOrderValue,
  };
});
