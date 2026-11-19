const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const D = require(path.join(__dirname, "..", "model-lab/static/core/data.js"));
const Q = require(path.join(__dirname, "..", "model-lab/static/core/quality.js"));
const I = require(path.join(__dirname, "..", "model-lab/static/core/identify.js"));
const P = require(path.join(__dirname, "..", "model-lab/static/core/plants.js"));

function near(actual, expected, rel = 0.1) {
  assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * rel, `${actual} !~ ${expected} (${rel})`);
}

test("Model Lab CSV parses headers, separators and headerless rows", () => {
  const a = D.parseCSV("t,u,y\n0,0,1\n0.1,1,2\n0.2,1,3\n");
  assert.deepEqual(a.t, [0, 0.1, 0.2]);
  assert.deepEqual(a.u, [0, 1, 1]);
  const b = D.parseCSV("0;0;1\n1;2;3\n2;2;4\n");
  assert.deepEqual(b.y, [1, 3, 4]);
  assert.throws(() => D.parseCSV("a,b\n1,2"), /columns/);
});

test("quality blocks flat input and non-monotonic time", () => {
  const flat = Q.analyze({ t: [0, 1, 2, 3, 4, 5], u: [1, 1, 1, 1, 1, 1], y: [0, 1, 2, 3, 4, 5] });
  assert.equal(flat.grade, "F");
  assert.ok(flat.blockers.some((c) => c.id === "excitation"));
  const badTime = Q.analyze({ t: [0, 1, 0.9, 3, 4, 5], u: [0, 1, 1, 1, 1, 1], y: [0, 1, 2, 3, 4, 5] });
  assert.equal(badTime.grade, "F");
  assert.ok(badTime.blockers.some((c) => c.id === "time"));
});

test("quality accepts a clean virtual step", () => {
  const d = P.virtualStep({ plant: "thermal", amp: 2, noise: 0.02, seed: 7 });
  const q = Q.analyze(d);
  assert.ok(q.grade === "A" || q.grade === "B", q.grade);
  assert.equal(q.blockers.length, 0);
});

test("FOPDT recovers thermal gain, time constant and delay", () => {
  const d = P.virtualStep({ plant: "thermal", amp: 2, noise: 0, seed: 1 });
  const f = I.fitFOPDT(d.t, d.u, d.y);
  near(f.K, 1.8, 0.05);
  near(f.tau, 42, 0.1);
  near(f.L, 3, 0.25);
  assert.ok(f.fit > 90, `fit ${f.fit}`);
  assert.match(I.toMatlab(f), /tf\(/);
});

test("SOPDT recovers spring damping and natural frequency", () => {
  const d = P.virtualStep({ plant: "spring", amp: 1, noise: 0.001, seed: 2 });
  const f = I.fitSOPDT(d.t, d.u, d.y);
  near(f.K, 1, 0.05);
  near(f.zeta, 0.25, 0.12);
  near(f.wn, 6, 0.12);
  assert.ok(f.fit > 90, `fit ${f.fit}`);
});

test("FOPDT rejects a zero-amplitude input", () => {
  assert.throws(() => I.fitFOPDT([0, 1, 2, 3], [0, 0, 0, 0], [0, 0, 0, 0]), /No input step|zero/);
});
