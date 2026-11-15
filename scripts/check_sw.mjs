import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "..");
const sw = fs.readFileSync(path.join(ROOT, "landing/sw.js"), "utf8");
const assets = [...sw.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter((x) => x && !x.startsWith("?"));
const map = (a) => {
  if (a === "" || a.endsWith("/")) {
    if (a === "") return path.join(ROOT, "landing", "index.html");
    if (a.startsWith("imu/")) return path.join(ROOT, "imu-lab/static", "index.html");
    if (a.startsWith("control/")) return path.join(ROOT, "control-play", "index.html");
    if (a.startsWith("simulink/")) return path.join(ROOT, "simulink", "index.html");
    if (a.startsWith("about/")) return path.join(ROOT, "about", "index.html");
    if (a.startsWith("en/")) return path.join(ROOT, "landing", a, "index.html");
    return path.join(ROOT, "landing", a, "index.html");
  }
  if (a.startsWith("imu/")) return path.join(ROOT, "imu-lab/static", a.slice(4));
  if (a.startsWith("control/")) return path.join(ROOT, "control-play", a.slice(8));
  if (a.startsWith("simulink/")) return path.join(ROOT, "simulink", a.slice(9));
  if (a.startsWith("about/")) return path.join(ROOT, "about", a.slice(6));
  if (a.startsWith("data/")) return path.join(ROOT, "data", a.slice(5));
  if (a.startsWith("shared/")) return path.join(ROOT, "shared", a.slice(7));
  return path.join(ROOT, "landing", a);
};
let bad = 0;
for (const a of assets) {
  const p = map(a);
  if (!fs.existsSync(p)) { console.error("missing SW asset", a, "->", path.relative(ROOT, p)); bad++; }
}
console.log(`SW assets checked: ${assets.length}, missing ${bad}`);
process.exit(bad ? 1 : 0);
