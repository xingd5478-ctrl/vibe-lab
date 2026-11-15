const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "matlab-probes.json"), "utf8"));
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("MATLAB probe dataset covers all 43 lessons without blocks", () => {
  assert.equal(data.model_count, 43);
  assert.equal(data.ok_count, 43);
  assert.equal(data.models.length, 43);
  assert.equal(new Set(data.models.map((m) => m.id)).size, 43);
  assert.ok(data.models.every((m) => m.status === "ok" && m.metric && m.note));
  assert.ok(data.models.every((m) => m.metric_source === "probe" || m.metric_source === "offline"));
  assert.ok(data.models.filter((m) => m.metric_source === "offline").map((m) => m.id).join(",") === "t12,t16,t31");
  assert.ok(data.models.every((m) => m.spark.length >= 2));
  assert.match(data.matlab_version, /R2025a/);
});

test("MATLAB probe dataset hashes match committed models", () => {
  for (const row of data.models) {
    const file = path.join(ROOT, "simulink", "models", row.model);
    assert.equal(sha(file), row.sha256, row.model);
  }
  const t39 = data.models.find((m) => m.id === "t39");
  assert.equal(t39.refs.length, 2);
  for (const ref of t39.refs) {
    assert.equal(sha(path.join(ROOT, "simulink", "models", "refs", ref.model)), ref.sha256);
  }
});

test("MATLAB table has 43 rows and links the raw dataset", () => {
  const html = fs.readFileSync(path.join(ROOT, "about", "matlab.html"), "utf8");
  assert.equal((html.match(/<tr data-search=/g) || []).length, 43);
  assert.match(html, /43 \/ 43/);
  assert.match(html, /data\/matlab-probes\.json/);
});
