/* 轻量性能预算：统计站点 JS/CSS 体积，按页面分组并设阈值，超过则 CI 失败 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIRS = ["landing", "shared", "model-lab/static", "imu-lab/static", "control-play", "simulink", "about"];
const EXT = new Set([".js", ".mjs", ".css"]);
const PAGE_BUDGET_KB = {
  landing: 26,
  shared: 45,
  "imu-lab/static": 120,
  "control-play": 80,
  simulink: 280,
  about: 30,
  "model-lab/static": 60,
};

let total = 0;
let largest = { file: "", size: 0 };
const rows = [];
const perDir = new Map();

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  let dirSize = 0;
  for (const name of fs.readdirSync(abs)) {
    const ext = path.extname(name);
    if (!EXT.has(ext)) continue;
    const file = path.join(abs, name);
    const size = fs.statSync(file).size;
    total += size;
    dirSize += size;
    if (size > largest.size) largest = { file: path.relative(ROOT, file), size };
    rows.push([path.relative(ROOT, file), size]);
  }
  perDir.set(dir, dirSize);
}

rows.sort((a, b) => b[1] - a[1]);
console.log(
  `perf budget: ${rows.length} files, total ${(total / 1024).toFixed(1)} KB, largest ${largest.file} ${(largest.size / 1024).toFixed(1)} KB`
);
rows.slice(0, 6).forEach(([f, s]) => console.log(`  ${(s / 1024).toFixed(1)} KB  ${f}`));
for (const [dir, size] of perDir)
  console.log(`  page ${dir.padEnd(16)} ${(size / 1024).toFixed(1)} KB / ${PAGE_BUDGET_KB[dir]} KB`);

const MAX_TOTAL = 560 * 1024;
const MAX_FILE = 160 * 1024;
let failed = false;
if (total > MAX_TOTAL) {
  console.error(`FAIL: total JS/CSS ${(total / 1024).toFixed(1)} KB > ${MAX_TOTAL / 1024} KB`);
  failed = true;
}
if (largest.size > MAX_FILE) {
  console.error(`FAIL: ${largest.file} ${(largest.size / 1024).toFixed(1)} KB > ${MAX_FILE / 1024} KB`);
  failed = true;
}
for (const [dir, size] of perDir) {
  if (size > PAGE_BUDGET_KB[dir] * 1024) {
    console.error(`FAIL: ${dir} ${(size / 1024).toFixed(1)} KB > ${PAGE_BUDGET_KB[dir]} KB`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("PERF BUDGET OK");
