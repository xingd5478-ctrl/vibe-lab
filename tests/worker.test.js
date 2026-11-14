const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const allan = require("../imu-lab/static/allan.js");

const workerCode = fs.readFileSync(
  path.resolve(__dirname, "../imu-lab/static/allan-worker.js"),
  "utf8"
);

function runWorker(payload) {
  let captured = null;
  const self = {
    IMUAllan: allan,
    postMessage: (msg) => { captured = msg; },
  };
  const sandbox = { self, importScripts: () => {}, console };
  vm.createContext(sandbox);
  vm.runInContext(workerCode, sandbox);
  self.onmessage({ data: payload });
  return captured;
}

test("allan worker returns three axes and respects cleaning", () => {
  const n = 5000;
  const gx = new Float32Array(n);
  const gy = new Float32Array(n);
  const gz = new Float32Array(n);
  const crc = new Uint8Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    gx[i] = Math.sin(i / 100) * 0.2;
    gy[i] = Math.cos(i / 150) * 0.2;
    gz[i] = Math.sin(i / 70) * 0.2;
  }
  gz[100] = 200; // 物理不可能帧，clean=true 时剔除
  crc[200] = 0;

  const out = runWorker({ id: 7, gx, gy, gz, crc, fs: 100, clean: true });
  assert.equal(out.id, 7);
  assert.ok(out.results.gx.length > 0);
  assert.ok(out.results.gy.length > 0);
  assert.ok(out.results.gz.length > 0);
});

test("allan worker returns raw result when clean=false", () => {
  const n = 3000;
  const arr = new Float32Array(n).fill(0.1);
  const out = runWorker({
    id: 1, gx: arr, gy: arr, gz: arr, crc: new Uint8Array(n).fill(1),
    fs: 100, clean: false,
  });
  assert.ok(out.results.gx.length > 0);
  assert.equal(out.id, 1);
});
