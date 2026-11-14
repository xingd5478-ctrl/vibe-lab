const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const data = require("../imu-lab/static/data.js");
const kf = require("../imu-lab/static/kf.js");

function runWorkerFile(file, deps) {
  let captured = null;
  const self = {
    ...deps,
    postMessage: (msg) => { captured = msg; },
  };
  const sandbox = { self, importScripts: () => {}, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, file), "utf8"), sandbox);
  return { self, get: () => captured };
}

test("data worker parses csv text and returns typed arrays", () => {
  const w = runWorkerFile("../imu-lab/static/data-worker.js", { IMUData: data });
  w.self.onmessage({
    data: {
      id: 3,
      text: "t,gx_dps,gy_dps,gz_dps,crc_ok\n0,0.1,0.2,0.3,1\n0.01,0.11,0.22,0.33,1\n0.02,9,9,9,0\n",
    },
  });
  const m = w.get();
  assert.equal(m.id, 3);
  assert.equal(m.ok, true);
  assert.equal(m.n, 3);
  assert.ok(Math.abs(m.gx[0] - 0.1) < 1e-6);
  assert.equal(m.crc[2], 0);
});

test("data worker reports unknown header", () => {
  const w = runWorkerFile("../imu-lab/static/data-worker.js", { IMUData: data });
  w.self.onmessage({ data: { id: 4, text: "foo,bar,baz\n1,2,3\n" } });
  assert.equal(w.get().ok, false);
});

test("kf worker filters and decimates", () => {
  const n = 5000;
  const rate = new Float32Array(n);
  for (let i = 0; i < n; i++) rate[i] = Math.sin(i / 30) * 0.1;
  const w = runWorkerFile("../imu-lab/static/kf-worker.js", { IMUKF: kf });
  w.self.onmessage({ data: { type: "set", rate, fs: 100 } });
  w.self.onmessage({ data: { type: "compute", id: 9, r: 1e-4, q: 1e-8, compare: { r: 1e-2, q: 1e-8 } } });
  const m = w.get();
  assert.equal(m.id, 9);
  assert.ok(m.angle.length > 10 && m.angle.length <= 1500);
  assert.equal(m.angle.length, m.kf.length);
  assert.ok(m.comp.length > 0);
  assert.equal(m.angle[0][1], 0);
});
