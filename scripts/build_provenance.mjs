/* Generate docs/MODEL_PROVENANCE.md from data/matlab-probes.json. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "matlab-probes.json");
const OUT = path.join(ROOT, "docs", "MODEL_PROVENANCE.md");
const CHECK = process.argv.includes("--check");
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));

const modified = {
  t24: "FIS rebuilt from lesson (Sugeno, 25 rules)",
  t26: "Probe records end-effector x/y/z",
  t32: "PD feedback added (K1=20, K2=8)",
  t35: "Time channel rewired to Clock",
};

const rows = data.models.map((m) => {
  const src = m.metric_source === "offline" ? "**offline**" : "probe";
  const mod = modified[m.id] ? `<br><small>${modified[m.id]}</small>` : "";
  return `| ${m.id} | ${m.model} | \`${m.sha256.slice(0, 12)}\` | ${m.solver || "—"} | ${src} | ${m.note || ""}${mod} |`;
});

const html = `# Simulink model provenance

Generated from \`data/matlab-probes.json\`. Do not hand-edit the table; run \`npm run provenance\`.

## Source and license

The 43 \`.slx\` models are vendored from
[xingd5478-ctrl/simulink-control-tutorial](https://github.com/xingd5478-ctrl/simulink-control-tutorial),
which declares the MIT license. The vendored files remain subject to the upstream
license and copyright; the full notice is in [NOTICE.md](../NOTICE.md).

## Scope

- MATLAB version: ${data.matlab_version}
- Models: ${data.model_count} / probes ok: ${data.ok_count}
- Toolboxes: ${data.toolbox_count}
- Generated: ${data.generated_at}
- Probe script: \`${data.probe_script}\`

\`metric_source: probe\` means the metric came from a fresh MATLAB probe of the model.
\`metric_source: offline\` means the value is from the lesson/offline calculation, not a
fresh probe. The three offline rows are t12, t16 and t31.

## Rows

| Lesson | Model | SHA-256 (12) | Solver | Metric source | Note |
|---|---|---|---|---|---|
${rows.join("\n")}

## Known modifications

- **t32** — added PD state feedback (\`K_theta=20\`, \`K_omega=8\`); without it the pendulum is unstable.
- **t35** — the \`t_ms\` To Workspace block now records a Clock; the original was wired to the fusion sum.
- **t24** — FIS rebuilt from the lesson because the original had no usable FIS.
- **t26** — probe records the end-effector x/y/z.

The exact patch script is \`tools/patch_models.m\`; rerun it only if a new upstream
model is vendored, then rerun \`npm run matlab:data\` and \`npm run provenance\`.

## Why t12/t16/t31 are offline

- **t12**: the model is a Kalman comparison; the reported RMSE is from the lesson's offline comparison.
- **t16**: the reported gain/phase margin is from the lesson's frequency analysis.
- **t31**: the model only outputs truth/noisy measurement; the EKF metric follows the lesson's offline implementation.

They are not presented as fresh probes, and the table marks them as \`offline\`.
`;

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== html) {
    console.error("docs/MODEL_PROVENANCE.md is out of date; run: npm run provenance");
    process.exit(1);
  }
  console.log(`provenance ok: ${data.models.length} models`);
} else {
  fs.writeFileSync(OUT, html);
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${data.models.length} models`);
}
