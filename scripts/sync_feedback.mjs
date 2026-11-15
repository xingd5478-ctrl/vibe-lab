/* Sync public feedback metrics from GitHub issues into data/feedback.json.
   Uses the authenticated `gh` CLI when available; falls back to the public API. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPO = process.env.GITHUB_REPOSITORY || "xingd5478-ctrl/vibe-lab";

function gh(args) {
  try {
    return JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null;
  }
}

async function publicApi(pathname) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${pathname}`, {
    headers: { "User-Agent": "vibe-lab-feedback", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${pathname}: ${res.status}`);
  return res.json();
}

const raw =
  gh(["repos/" + REPO + "/issues?state=all&per_page=100"]) ?? (await publicApi("/issues?state=all&per_page=100"));
const issues = raw.filter((i) => !i.pull_request);
const details = [];
for (const it of issues.slice(0, 50)) {
  let first = null;
  if (it.comments > 0) {
    const comments =
      gh([`repos/${REPO}/issues/${it.number}/comments?per_page=1`]) ??
      (await publicApi(`/issues/${it.number}/comments?per_page=1`).catch(() => []));
    if (comments.length) first = comments[0].created_at;
  }
  details.push({
    number: it.number,
    title: it.title,
    state: it.state,
    labels: (it.labels || []).map((l) => l.name),
    created_at: it.created_at,
    closed_at: it.closed_at,
    comments: it.comments,
    first_response: first,
    url: it.html_url,
  });
}

const hours = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 36e5 : null);
const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const labels = {};
for (const it of details) for (const l of it.labels) labels[l] = (labels[l] || 0) + 1;

const doc = {
  schema: 1,
  generated_at: new Date().toISOString(),
  repo: REPO,
  total: details.length,
  open: details.filter((i) => i.state === "open").length,
  closed: details.filter((i) => i.state === "closed").length,
  labels,
  median_first_response_hours: median(details.map((i) => hours(i.created_at, i.first_response))),
  median_close_hours: median(details.map((i) => hours(i.created_at, i.closed_at))),
  issues: details.slice(0, 10),
};
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "feedback.json"), JSON.stringify(doc, null, 2) + "\n");
console.log(`feedback: ${doc.total} issues (${doc.open} open, ${doc.closed} closed)`);
