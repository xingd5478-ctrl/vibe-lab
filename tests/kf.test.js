const test = require("node:test");
const assert = require("node:assert/strict");
const { rqFromAllan, kf1d, integrate } = require("../imu-lab/static/kf.js");

test("rqFromAllan matches the engineering mapping", () => {
  const { r, q, ratio } = rqFromAllan(0.287, 0.031, 100);
  assert.ok(Math.abs(r - Math.pow(0.287 / 60, 2) * 0.01) < 1e-18);
  assert.ok(Math.abs(q - Math.pow(0.031 / 60, 2) * 0.01) < 1e-20);
  assert.ok(ratio > 80 && ratio < 90);
});

test("kf converges to a constant input", () => {
  const z = new Array(500).fill(1.5);
  const x = kf1d(z, 1e-4, 1e-8, 0, 1);
  assert.ok(Math.abs(x[x.length - 1] - 1.5) < 1e-6);
});

test("integrate converts rate to angle", () => {
  const rate = new Array(100).fill(10); // 10 dps for 1 s
  const angle = integrate(rate, 100);
  assert.ok(Math.abs(angle[angle.length - 1] - 10) < 1e-9);
});
