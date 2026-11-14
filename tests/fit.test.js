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
