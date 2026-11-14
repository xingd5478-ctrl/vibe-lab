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

test("signal demo applies gain elementwise", () => {
  const a = S.signalDemo(2, 0.5, false);
  const b = S.signalDemo(0.5, 0.5, false);
  for (let i = 0; i < a.t.length; i += 50) {
    assert.ok(Math.abs(a.y[i] - 2 * a.u[i]) < 1e-9);
    assert.ok(Math.abs(b.y[i] - 0.5 * b.u[i]) < 1e-9);
  }
});

test("PID with integral removes steady-state error", () => {
  const noI = S.pidDemo(1.5, 0, 0.05);
  const withI = S.pidDemo(1.5, 1.5, 0.05);
  const essP = Math.abs(1 - noI.y[noI.y.length - 1]);
  const essPI = Math.abs(1 - withI.y[withI.y.length - 1]);
  assert.ok(essPI < 0.02, `ess=${essPI}`);
  assert.ok(essPI < essP, `PI ${essPI} should beat P ${essP}`);
});

test("Kalman reduces measurement noise RMSE", () => {
  const r = S.kalmanDemo(0.1, 0.005);
  assert.ok(r.rmseKf < r.rmseMeas * 0.7, `kf=${r.rmseKf} meas=${r.rmseMeas}`);
});

test("Bode phase at wn is -90 and resonance grows as zeta drops", () => {
  const low = S.bodeDemo(5, 0.3);
  assert.ok(Math.abs(low.phaseAtWn + 90) < 3, `phase=${low.phaseAtWn}`);
  assert.ok(low.peak > 3, `peak=${low.peak}`);
  const high = S.bodeDemo(5, 0.7);
  assert.ok(high.peak < low.peak, "higher damping should reduce resonance");
});

test("MPC respects input bound and tracks reference", () => {
  const r = S.mpcDemo(8, 1, 0.1, 0.3);
  assert.ok(Math.abs(r.x[r.x.length - 1] - 1) < 0.05, `final=${r.x[r.x.length - 1]}`);
  for (const u of r.u) assert.ok(Math.abs(u) <= 0.3 + 1e-9, `u=${u}`);
});

test("root locus: low gain stable, high gain unstable", () => {
  const ok = S.rootLocusDemo(1);
  const bad = S.rootLocusDemo(50);
  assert.equal(ok.stable, true);
  assert.equal(bad.stable, false);
  assert.ok(bad.maxRe > 0);
  assert.ok(ok.branches.length === 3);
});

test("fuzzy P has steady error that shrinks with scale", () => {
  const a = S.fuzzyDemo(4), b = S.fuzzyDemo(10);
  const ea = Math.abs(1 - a.y[a.y.length - 1]);
  const eb = Math.abs(1 - b.y[b.y.length - 1]);
  assert.ok(ea < 0.25, `ea=${ea}`);
  assert.ok(eb < ea, `larger scale should reduce error (${eb} < ${ea})`);
});

test("MSD settles to F/k and reports wn/zeta", () => {
  const r = S.msdDemo(5, 1);
  assert.ok(Math.abs(r.x[r.x.length - 1] - 0.2) < 0.02, `x=${r.x[r.x.length - 1]}`);
  assert.ok(Math.abs(r.wn - Math.sqrt(5)) < 1e-9);
  assert.ok(Math.abs(r.zeta - 1 / (2 * Math.sqrt(5))) < 1e-9);
});

test("two-link arm inverse kinematics reaches target", () => {
  const a = S.armDemo(1.2, 0.6);
  assert.equal(a.reachable, true);
  assert.ok(Math.hypot(a.ex - 1.2, a.ey - 0.6) < 1e-9);
  assert.equal(S.armDemo(2, 0).reachable, false);
});

test("sampling alias folds above Nyquist", () => {
  const ok = S.dspDemo(5, 40);
  assert.equal(ok.aliased, false);
  assert.ok(Math.abs(ok.alias - 5) < 1e-9);
  const bad = S.dspDemo(30, 40);
  assert.equal(bad.aliased, true);
  assert.ok(Math.abs(bad.alias - 10) < 1e-9, `alias=${bad.alias}`);
});

test("IMU complementary filter beats raw accelerometer", () => {
  const r = S.imuFusionDemo(0.95, true);
  assert.ok(r.rmseComp < r.rmseAcc, `comp=${r.rmseComp} acc=${r.rmseAcc}`);
});

test("Bus selector returns the requested signal", () => {
  const r = S.busDemo(2);
  assert.equal(r.sel, 2);
  assert.equal(r.sigs[r.sel].length, r.t.length);
  assert.ok(Math.abs(r.sigs[2][r.t.length - 1] - 1) < 0.01);
});

test("state machine latches fault and resets", () => {
  assert.equal(S.nextState(0, 1), 1); // start
  assert.equal(S.nextState(1, 0), 0); // stop
  assert.equal(S.nextState(1, 2), 2); // fault
  assert.equal(S.nextState(2, 1), 2); // start ignored while fault
  assert.equal(S.nextState(2, 3), 0); // reset
});

test("variant mode selects different controllers", () => {
  const open = S.variantDemo(0), pid = S.variantDemo(1), pd = S.variantDemo(2);
  assert.equal(open.label, "开环");
  assert.equal(pid.label, "PID");
  assert.equal(pd.label, "状态反馈 (PD)");
  assert.ok(open.y[open.y.length - 1] > 0);
  assert.ok(Math.abs(pid.y[pid.y.length - 1] - 1) < 0.02);
});
