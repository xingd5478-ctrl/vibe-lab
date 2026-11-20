/* Build the static _site/ directory used by Cloudflare Pages (and any static host). */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "_site");

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function copyDir(from, to, { skip = [] } = {}) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (skip.includes(name)) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    const st = fs.statSync(src);
    if (st.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

// landing/* is the site root
for (const name of fs.readdirSync(path.join(ROOT, "landing"))) {
  if (name === "CNAME") continue; // Cloudflare Pages gets its hostname from the dashboard
  const src = path.join(ROOT, "landing", name);
  const dst = path.join(OUT, name);
  const st = fs.statSync(src);
  if (st.isDirectory()) copyDir(src, dst);
  else fs.copyFileSync(src, dst);
}

for (const [from, to] of [
  ["model-lab/static", "model"],
  ["imu-lab/static", "imu"],
  ["control-play", "control"],
  ["simulink", "simulink"],
  ["about", "about"],
])
  copyDir(path.join(ROOT, from), path.join(OUT, to));

fs.mkdirSync(path.join(OUT, "data"), { recursive: true });
for (const f of ["matlab-probes.json", "feedback.json"]) {
  fs.copyFileSync(path.join(ROOT, "data", f), path.join(OUT, "data", f));
}
copyDir(path.join(ROOT, "shared"), path.join(OUT, "shared"));

// Deployed app pages live one level shallower than their source static dirs.
const deployPathFix = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) deployPathFix(p);
    else if (name.endsWith(".html")) {
      const html = fs.readFileSync(p, "utf8").replaceAll("../../shared/", "../shared/");
      fs.writeFileSync(p, html);
    }
  }
};
for (const to of ["model", "imu", "control", "simulink", "about"]) {
  const dir = path.join(OUT, to);
  if (fs.existsSync(dir)) deployPathFix(dir);
}

const count = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`_site built: ${count(OUT)} files at ${OUT}`);
