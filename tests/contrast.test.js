const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FILES = ["imu-lab/static/style.css", "control-play/style.css", "simulink/style.css"];

function luminance(hex) {
  const h = hex.replace("#", "");
  const c = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
function darkVars(file) {
  const css = fs.readFileSync(path.join(ROOT, file), "utf8");
  const block = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
  const vars = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[m[1]] = m[2];
  return vars;
}

test("dark chart series and axes meet 3:1 non-text contrast", () => {
  for (const file of FILES) {
    const v = darkVars(file);
    const panel = v.panel || "#1b1e24";
    for (const key of [
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
      "chart-raw",
      "chart-raw2",
      "chart-axis",
    ]) {
      assert.ok(v[key], `${file}: missing --${key}`);
      assert.ok(contrast(v[key], panel) >= 3, `${file}: --${key} ${v[key]} < 3:1 on ${panel}`);
    }
    assert.ok(contrast("#666b75", panel) >= 3, `${file}: control border < 3:1`);
  }
});
