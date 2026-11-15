import fs from "node:fs";
import path from "node:path";
import { PAGES, navFor } from "./site_layout.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const WRITE = process.argv.includes("--write");
let changed = 0;
let failed = 0;
for (const [rel, cfg] of Object.entries(PAGES)) {
  const file = path.join(ROOT, rel);
  const before = fs.readFileSync(file, "utf8");
  const next = before.replace(/<nav class="topnav"[\s\S]*?<\/nav>/, navFor(cfg));
  if (next === before) continue;
  if (WRITE) {
    fs.writeFileSync(file, next);
    changed++;
    console.log("wrote", rel);
  } else {
    console.error("layout out of date:", rel);
    failed++;
  }
}
if (WRITE) console.log(`updated ${changed} navs`);
else if (failed) process.exit(1);
else console.log("LAYOUT OK");
