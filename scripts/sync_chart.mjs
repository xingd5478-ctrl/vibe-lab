/* Keep chart.js copies identical. --check fails on drift; default copies canonical -> others. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const files = [
  "imu-lab/static/chart.js",
  "control-play/chart.js",
  "simulink/chart.js",
].map((f) => path.join(ROOT, f));

const hash = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const check = process.argv.includes("--check");
const source = fs.readFileSync(files[0]);
const base = hash(source);

if (check) {
  const bad = files.filter((f) => hash(fs.readFileSync(f)) !== base);
  if (bad.length) {
    console.error("chart.js drift:", bad.map((f) => path.relative(ROOT, f)).join(", "));
    process.exit(1);
  }
  console.log("chart.js in sync");
} else {
  files.slice(1).forEach((f) => fs.writeFileSync(f, source));
  console.log("chart.js synced");
}
