/* Switch the site to a custom domain in one step.
   Usage: node scripts/set_domain.mjs https://vibe-lab.dev
   It rewrites canonical/OG/sitemap/robots URLs and writes landing/CNAME. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OLD = "https://xingd5478-ctrl.github.io/vibe-lab";
const fromArg = process.argv.find((a) => a.startsWith("--from="));
const OLD = (fromArg ? fromArg.slice("--from=".length) : DEFAULT_OLD).replace(/\/+$/, "");
const raw = process.argv[2];
if (!raw) {
  console.error(
    "usage: node scripts/set_domain.mjs https://your-domain.example [--from=https://old.example] [--no-cname]"
  );
  process.exit(1);
}
const origin = raw.replace(/\/+$/, "");
const noCname = process.argv.includes("--no-cname");
if (!/^https:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(origin)) {
  console.error("target must be https://host or https://host/path (no query/hash)");
  process.exit(1);
}
const host = new URL(origin).host;

const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (["node_modules", "artifacts", ".git", "models", "data"].includes(name)) continue;
      walk(p);
    } else if (/\.(html|xml|txt|webmanifest|md)$/.test(name) && !p.endsWith("PRODUCTIZATION.md")) {
      files.push(p);
    }
  }
}
for (const d of ["landing", "about", "docs"]) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
files.push(path.join(ROOT, "README.md"));

let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  if (!before.includes(OLD)) continue;
  const after = before.split(OLD).join(origin);
  fs.writeFileSync(file, after);
  changed++;
  console.log("updated", path.relative(ROOT, file));
}
if (!noCname) {
  fs.writeFileSync(path.join(ROOT, "landing", "CNAME"), host + "\n");
  console.log(`CNAME -> ${host}`);
}
console.log(`rewrote ${changed} files from ${OLD} to ${origin}`);
console.log(
  noCname
    ? "next: commit/push; Cloudflare Pages or your host will serve this hostname"
    : "next: commit, push, then GitHub Settings → Pages → Custom domain, Enforce HTTPS"
);
