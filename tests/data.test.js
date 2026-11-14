const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../imu-lab/static/data.js");
require("../imu-lab/static/allan.js");
require("../imu-lab/static/kf.js");

test("parseText handles aliases and crc", () => {
  const text = "time,gyro_x,gyro_y,gyro_z,crc\n0,0.1,0.2,0.3,1\n0.01,0.1,0.2,0.3,0\n";
  const cols = data.parseText(text);
  assert.equal(cols.n, 2);
  assert.ok(Math.abs(cols.gx[0] - 0.1) < 1e-6);
  assert.equal(cols.crc[1], 0);
});

test("cleanMask drops bad crc and spikes", () => {
  const cols = data.parseText("t,gx,gy,gz,crc\n0,1,1,1,1\n0.01,200,1,1,1\n0.02,1,1,1,0\n");
  const mask = data.cleanMask(cols, 5);
  assert.deepEqual(Array.from(mask), [1, 0, 0]);
  const s = data.stats(cols, mask);
  assert.equal(s.bad, 2);
});

test("allan and kf run on columnar data", () => {
  const rows = [];
  for (let i = 0; i < 5000; i++) rows.push({ t: i / 100, gx: Math.sin(i / 50) * 0.1, gy: 0, gz: 0, crc: 1 });
  const cols = data.fromRows(rows);
  const mask = data.cleanMask(cols);
  const pts = data.allan(cols, "gx", 100, mask);
  assert.ok(pts.length > 5);
  const { angle, filtered } = data.kf(cols, "gx", 100, mask, 1e-4, 1e-8);
  assert.equal(angle.length, filtered.length);
});

test("csv export has expected header and rows", () => {
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push({ t: i / 100, gx: 0.1, gy: 0.2, gz: 0.3, crc: 1 });
  const cols = data.fromRows(rows);
  const mask = data.cleanMask(cols);
  const text = data.csv(cols, mask, "gz", 100, 1e-4, 1e-8);
  const lines = text.replace(/^\ufeff/, "").trim().split("\n");
  assert.equal(lines[0], "t,gx_dps,gy_dps,gz_dps,angle_deg,kf_deg");
  assert.equal(lines.length, 101);
});

test("validate flags unit magnitude and duplicate axes", () => {
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push({ t: i / 100, gx: 1000, gy: 1000, gz: 1000, crc: 1 });
  const w = data.validate(rows, 100);
  assert.ok(w.some((s) => s.includes("量级")));
  assert.ok(w.some((s) => s.includes("三轴")));
});

test("validate flags non-second timestamps", () => {
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push({ t: i * 10, gx: 0.1, gy: 0.2, gz: 0.3, crc: 1 });
  const w = data.validate(rows, 100);
  assert.ok(w.some((s) => s.includes("时间列")));
});
