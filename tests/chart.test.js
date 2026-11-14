const test = require("node:test");
const assert = require("node:assert/strict");
require("../imu-lab/static/chart.js");
const chart = globalThis.IMUChart;

test("dark-mode series colors map back to light colors for export", () => {
  assert.equal(chart.lightColor("#7fb3e0"), "#1f4e79");
  assert.equal(chart.lightColor("#7fc9a3"), "#2f6b4f");
  assert.equal(chart.lightColor("#9a9488"), "#b9b3a5");
  assert.equal(chart.lightColor("#123456"), "#123456");
});

test("chart color mapping is case-insensitive", () => {
  assert.equal(chart.lightColor("#7FB3E0"), "#1f4e79");
});
