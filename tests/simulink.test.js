const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../simulink/control.js");

function valueAt(t, y, sec) {
  let i = 0;
  while (i < t.length - 1 && t[i] < sec) i++;
  return y[i];
}

test("first order reaches 63.2% at tau and settles at K", () => {
  const tau = 0.8, K = 1.5;
  const r = S.firstOrder(tau, K, 6);
  const y63 = valueAt(r.t, r.y, 0.5 + tau);
  assert.ok(Math.abs(y63 - 0.632 * K) < 0.02 * K, `y63=${y63}`);
  assert.ok(Math.abs(r.y[r.y.length - 1] - K) < 0.01 * K);
});

test("second order overshoot matches the analytical estimate", () => {
  const wn = 5, zeta = 0.3;
  const r = S.secondOrder(wn, zeta, 8);
  const m = S.metrics(r.t, r.y, 1);
  const expect = Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) * 100;
  assert.ok(Math.abs(m.overshoot - expect) < 0.08 * expect, `overshoot=${m.overshoot} expect=${expect}`);
  assert.ok(Math.abs(r.y[r.y.length - 1] - 1) < 0.02);
});

test("state feedback places poles and tracks reference", () => {
  const wn = 4, zeta = 0.7;
  const r = S.stateFeedback(wn, zeta, 8);
  assert.ok(Math.abs(r.k[0] - wn * wn) < 1e-9);
  assert.ok(Math.abs(r.k[1] - 2 * zeta * wn) < 1e-9);
  assert.ok(Math.abs(r.y[r.y.length - 1] - 1) < 0.02);
  assert.ok(Math.abs(r.poles.re + zeta * wn) < 1e-9);
});

test("Luenberger observer converges and noise raises error", () => {
  const clean = S.observer(4, 0.8, 12, 0.9, false);
  const noisy = S.observer(4, 0.8, 12, 0.9, true);
  const eClean = clean.err[clean.err.length - 1];
  const eNoisy = noisy.err[noisy.err.length - 1];
  assert.ok(eClean < 0.01, `clean=${eClean}`);
  assert.ok(eNoisy > eClean, `noisy=${eNoisy} clean=${eClean}`);
  assert.ok(clean.L[1] > 0);
});

test("SMC tracks with boundary layer and reports chattering", () => {
  const r = S.smc(4, 8, 0.2);
  const e = Math.abs(r.y[r.y.length - 1] - 1);
  assert.ok(e < 0.1, `steady error=${e}`);
  assert.ok(isFinite(r.chattering) && r.chattering >= 0);
  const sharp = S.smc(4, 8, 0.01);
  assert.ok(sharp.chattering > r.chattering, "smaller boundary layer should chatter more");
});
