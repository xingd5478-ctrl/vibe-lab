/* Vendor .slx models from the tutorial repo (MIT) into simulink/models/.
   Usage: node scripts/vendor_models.mjs  (jsDelivr primary, raw GitHub fallback) */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "simulink", "models");
const CDN = "https://cdn.jsdelivr.net/gh/xingd5478-ctrl/simulink-control-tutorial@main/";
const RAW = "https://raw.githubusercontent.com/xingd5478-ctrl/simulink-control-tutorial/main/";

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "simulink", "lessons.js"), "utf8"), sandbox);
const DATA = sandbox.window.SIMULINK_LESSONS;
const models = [];
DATA.phases.forEach((ph) =>
  ph.items.forEach((l) => {
    if (!models.includes(l.model)) models.push(l.model);
  })
);

fs.mkdirSync(OUT, { recursive: true });
let ok = 0,
  skipped = 0,
  failed = [];

function isZip(buf) {
  return buf && buf.length > 100 && buf[0] === 0x50 && buf[1] === 0x4b;
}

for (const name of models) {
  const dest = path.join(OUT, name);
  if (fs.existsSync(dest) && isZip(fs.readFileSync(dest))) {
    skipped++;
    continue;
  }
  let saved = false;
  for (const base of [CDN, RAW]) {
    try {
      const res = await fetch(base + "models/" + name, { redirect: "follow" });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isZip(buf)) continue;
      fs.writeFileSync(dest, buf);
      saved = true;
      break;
    } catch (e) {
      /* try fallback */
    }
  }
  if (saved) {
    ok++;
    console.log("ok", name);
  } else failed.push(name);
}

const total = fs
  .readdirSync(OUT)
  .filter((f) => f.endsWith(".slx"))
  .reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(
  `models: ${models.length}, downloaded ${ok}, skipped ${skipped}, failed ${failed.length}, total ${(total / 1024).toFixed(0)} KB`
);
if (failed.length) {
  console.error("failed:", failed.join(", "));
  process.exit(1);
}
