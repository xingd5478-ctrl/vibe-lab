const test = require("node:test");
const assert = require("node:assert/strict");
const { fitAllan } = require("../imu-lab/static/fit.js");

function synthAllan(N, K, taus) {
  return taus.map((tau) => ({ tau, adev: Math.sqrt((N * N) / tau + (K * K * tau) / 3) }));
}

const taus = [];
for (let i = 0; i < 40; i++) taus.push(0.1 * Math.pow(1000 / 0.1, i / 39));

test("recovers ARW/RRW from a two-term Allan curve", () => {
  const N = 0.035, K = 0.0012, dt = 0.01;
  const fit = fitAllan(synthAllan(N, K, taus), dt);
  assert.ok(fit);
  assert.ok(Math.abs(fit.arw - N * 60) / (N * 60) < 0.02);
  assert.ok(Math.abs(fit.rrw - K * 60) / (K * 60) < 0.05);
  assert.ok(fit.r2 > 0.99);
  assert.ok(fit.nCI[0] <= fit.N && fit.N <= fit.nCI[1]);
});

test("returns null for too few points", () => {
  assert.equal(fitAllan([{ tau: 0.1, adev: 0.1 }], 0.01), null);
});

test("IRLS fit is robust to outlier tau bins", () => {
  const N = 0.035, K = 0.0012, dt = 0.01;
  const pts = synthAllan(N, K, taus);
  pts[5].adev *= 6;
  pts[30].adev *= 5;
  const fit = fitAllan(pts, dt);
  assert.ok(fit);
  assert.ok(Math.abs(fit.arw - N * 60) / (N * 60) < 0.05, `ARW=${fit.arw}`);
  assert.ok(Math.abs(fit.rrw - K * 60) / (K * 60) < 0.25, `RRW=${fit.rrw}`);
  assert.ok(fit.method === "irls" || fit.method === "wls", fit.method);
});

test("falls back to median method when OLS is degenerate", () => {
  // 单段数据（只有短 τ），短段中位数仍可用
  const short = [];
  for (let i = 0; i < 12; i++) short.push({ tau: 0.1 * Math.pow(2, i), adev: 0.02 / Math.sqrt(0.1 * Math.pow(2, i)) });
  const fit = fitAllan(short, 0.01);
  assert.ok(fit);
  assert.ok(Math.abs(fit.arw - 1.2) / 1.2 < 0.1, `ARW=${fit.arw}`);
});
