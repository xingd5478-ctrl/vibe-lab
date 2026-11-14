/* Validate data/matlab-probes.json provenance against the committed models. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "matlab-probes.json");
const LEARNING = path.join(ROOT, "simulink", "lessons.js");
const problems = [];

if (!fs.existsSync(DATA)) {
  console.error("missing data/matlab-probes.json");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const lessonRe = /\{ id: "(t\d+)", n: (\d+), title: "([^"]+)", desc: "([^"]+)", file: "([^"]+)", model: "([^"]+)"(?:, demo: "([^"]+)")? \}/g;
const lessons = [...fs.readFileSync(LEARNING, "utf8").matchAll(lessonRe)].map((m) => ({
  id: m[1], n: Number(m[2]), title: m[3], model: m[6],
}));

if (data.model_count !== 43) problems.push(`model_count ${data.model_count} != 43`);
if (data.ok_count !== 43) problems.push(`ok_count ${data.ok_count} != 43`);
if (!/R2025a/.test(data.matlab_version || "")) problems.push(`unexpected MATLAB version: ${data.matlab_version}`);
if (data.probe_script !== "tools/probe_all.m") problems.push(`unexpected probe_script: ${data.probe_script}`);
if (!Array.isArray(data.models) || data.models.length !== 43) problems.push(`models length ${data.models?.length} != 43`);

const byId = new Map((data.models || []).map((m) => [m.id, m]));
if (byId.size !== 43) problems.push(`duplicate ids: ${byId.size} unique`);
for (const lesson of lessons) {
  const row = byId.get(lesson.id);
  if (!row) { problems.push(`${lesson.id}: missing from JSON`); continue; }
  if (row.model !== lesson.model) problems.push(`${lesson.id}: model ${row.model} != ${lesson.model}`);
  if (!row.metric) problems.push(`${lesson.id}: empty metric`);
  if (!row.note) problems.push(`${lesson.id}: empty note`);
  if (row.status !== "ok") problems.push(`${lesson.id}: status ${row.status}`);
  const file = path.join(ROOT, "simulink", "models", row.model);
  if (!fs.existsSync(file)) { problems.push(`${lesson.id}: missing ${row.model}`); continue; }
  const hash = sha(file);
  if (hash !== row.sha256) problems.push(`${lesson.id}: sha256 mismatch (${row.sha256.slice(0, 10)} != ${hash.slice(0, 10)})`);
  if (row.id === "t39") {
    if (!Array.isArray(row.refs) || row.refs.length !== 2) problems.push("t39: missing refs");
    for (const ref of row.refs || []) {
      const p = path.join(ROOT, "simulink", "models", "refs", ref.model);
      if (!fs.existsSync(p)) problems.push(`t39: missing ref ${ref.model}`);
      else if (sha(p) !== ref.sha256) problems.push(`t39: ref hash mismatch ${ref.model}`);
    }
  }
}

const table = fs.readFileSync(path.join(ROOT, "about", "matlab.html"), "utf8");
const rows = (table.match(/<tr data-search=/g) || []).length;
if (rows !== 43) problems.push(`about/matlab.html rows ${rows} != 43`);
if (!table.includes("../data/matlab-probes.json")) problems.push("about/matlab.html does not link JSON");
if (!table.includes("43 / 43")) problems.push("about/matlab.html missing 43/43 header");

if (problems.length) {
  console.error("MATLAB provenance FAIL:");
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}
console.log(`MATLAB provenance OK: 43/43 models, ${data.matlab_version}, ${data.toolbox_count} toolboxes`);
