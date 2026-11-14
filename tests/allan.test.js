const test = require("node:test");
const assert = require("node:assert/strict");
const { allanDeviation, cleanFrames } = require("../imu-lab/static/allan.js");

function synth(n, sigma, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out = [];
  for (let i = 0; i < n; i++) out.push((rnd() * 2 - 1) * sigma);
  return out;
}

test("Allan deviation is positive and decreases for white noise", () => {
  const x = synth(10000, 0.3, 7);
  const pts = allanDeviation(x, 0.01);
  assert.ok(pts.length > 10);
  assert.ok(pts.every((p) => p.adev > 0 && p.tau > 0));
  assert.ok(pts[0].adev > pts[pts.length - 1].adev);
});

test("constant input has near-zero Allan deviation", () => {
  const x = new Array(2000).fill(1.23);
  const pts = allanDeviation(x, 0.01);
  assert.ok(pts.length > 0);
  assert.ok(pts.every((p) => p.adev < 1e-12));
});

test("cleanFrames removes CRC failures and physical spikes", () => {
  const rows = [
    { gx: 0.1, gy: 0.1, gz: 0.1, crc: 1 },
    { gx: 0.1, gy: 0.1, gz: 0.1, crc: 0 },
    { gx: 200, gy: 0.1, gz: 0.1, crc: 1 },
    { gx: 0.1, gy: 0.1, gz: 0.1 },
  ];
  const kept = cleanFrames(rows, 5);
  assert.equal(kept.length, 2);
});
