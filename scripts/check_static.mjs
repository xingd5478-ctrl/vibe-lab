import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (["node_modules", "artifacts", ".git", "models", "models"].includes(name)) continue;
      walk(p, out);
    } else if (/\.(html|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [];
for (const d of ["landing", "shared", "imu-lab/static", "control-play", "simulink", "about", "scripts", "tests", "tools"]) {
  const p = path.join(ROOT, d);
  if (fs.existsSync(p)) walk(p, files);
}
let failed = 0;
for (const file of files.filter((f) => /\.m?js$/.test(f))) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (e) {
    console.error(`JS syntax FAIL ${path.relative(ROOT, file)}`);
    failed++;
  }
}
console.log(`JS syntax checked: ${files.filter((f) => /\.m?js$/.test(f)).length}`);

const pages = [
  "landing/index.html", "landing/en/index.html", "landing/404.html", "landing/feedback.html",
  "landing/en/lessons.html", "landing/en/guide.html",
  "imu-lab/static/index.html", "control-play/index.html",
  "simulink/index.html", "simulink/course.html",
  "about/index.html", "about/en.html", "about/matlab.html", "about/matlab-en.html",
];
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.error(`page missing ${rel}`); failed++; continue; }
  const html = fs.readFileSync(file, "utf8");
  const errs = [];
  if (!/^<!doctype html>/i.test(html.trim())) errs.push("doctype");
  if (!/<html\s+lang="[^"]+"/i.test(html)) errs.push("html lang");
  if (!/<title>[^<]+<\/title>/i.test(html)) errs.push("title");
  if (!/name="viewport"/i.test(html)) errs.push("viewport");
  if (!/<main[\s>]/i.test(html)) errs.push("main");
  if (!/<nav[\s>]/i.test(html)) errs.push("nav");
  const ids = [...html.matchAll(/<[^>]+\bid="([^"]+)"/g)].map((m) => m[1]);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dup.length) errs.push("duplicate id: " + dup.join(","));
  if (errs.length) { console.error(`HTML FAIL ${rel}: ${errs.join("; ")}`); failed++; }
  else console.log(`ok   ${rel}`);
}
if (failed) { console.error(`static checks failed: ${failed}`); process.exit(1); }
console.log("STATIC CHECKS OK");
