/* 轻量性能预算：统计站点 JS/CSS 体积，超过阈值则 CI 失败 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIRS = ["landing", "imu-lab/static", "control-play", "simulink", "about"];
const EXT = new Set([".js", ".css"]);

let total = 0;
let largest = { file: "", size: 0 };
const rows = [];

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    const ext = path.extname(name);
    if (!EXT.has(ext)) continue;
    const file = path.join(abs, name);
    const size = fs.statSync(file).size;
    total += size;
    if (size > largest.size) largest = { file: path.relative(ROOT, file), size };
    rows.push([path.relative(ROOT, file), size]);
  }
}

rows.sort((a, b) => b[1] - a[1]);
console.log(`perf budget: ${rows.length} files, total ${(total / 1024).toFixed(1)} KB, largest ${largest.file} ${(largest.size / 1024).toFixed(1)} KB`);
rows.slice(0, 5).forEach(([f, s]) => console.log(`  ${(s / 1024).toFixed(1)} KB  ${f}`));

const MAX_TOTAL = 420 * 1024;
const MAX_FILE = 160 * 1024;
if (total > MAX_TOTAL) {
  console.error(`FAIL: total JS/CSS ${(total / 1024).toFixed(1)} KB > ${MAX_TOTAL / 1024} KB`);
  process.exit(1);
}
if (largest.size > MAX_FILE) {
  console.error(`FAIL: ${largest.file} ${(largest.size / 1024).toFixed(1)} KB > ${MAX_FILE / 1024} KB`);
  process.exit(1);
}
console.log("PERF BUDGET OK");
