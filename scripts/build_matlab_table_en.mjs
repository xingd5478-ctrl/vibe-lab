/* English provenance table: 43 rows, numeric metrics only; detailed caveats stay on the Chinese table. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "matlab-probes.json"), "utf8"));
const i18n = fs.readFileSync(path.join(ROOT, "shared", "i18n.js"), "utf8");
const block = i18n.match(/const TITLES = \{([\s\S]*?)\n  \};/);
if (!block) throw new Error("TITLES block not found");
const TITLES = Function(`return ({${block[1]}});`)();

const REPL = [
  ["峰值", "peak"], ["末值", "final"], ["范围", "range"], ["输出", "output"], ["模糊", "fuzzy"],
  ["转速", "speed"], ["角度", "angle"], ["互补滤波", "complementary filter"], ["校正后", "corrected"],
  ["参考", "reference"], ["对象", "plant"], ["控制", "control"], ["末端", "end effector"],
  ["测量", "measurement"], ["误差", "error"], ["响应", "response"], ["位移", "displacement"],
  ["车身", "body"], ["变体", "variant"], ["输入", "input"], ["转速", "speed"], ["输出1", "output 1"],
  ["输出2", "output 2"], ["输出3", "output 3"], ["精度", "accuracy"], ["模式", "mode"], ["最大", "maximum"], ["终值", "final"], ["离线", "offline"], ["按讲义离线", "offline lecture"], ["讲义", "lecture"],
];
const enMetric = (s) => REPL.reduce((x, [a, b]) => x.split(a).join(b), s)
  .replace(/，/g, ", ").replace(/；/g, "; ").replace(/：/g, ": ")
  .replace(/（/g, " (").replace(/）/g, ")").replace(/按lectureoffline/g, "offline lecture");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const spark = (values) => {
  const v = (values || []).map(Number).filter(Number.isFinite);
  if (v.length < 2) return "";
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * 120).toFixed(1)},${(25 - (x - min) / span * 20).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 120 28" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
};

let cjk = 0;
const rows = data.models.map((m) => {
  const title = TITLES[m.title] || `Lesson ${m.id}`;
  const metric = enMetric(m.metric);
  cjk += (metric.match(/[\u4e00-\u9fff]/g) || []).length;
  return `      <tr>
        <td><b>${esc(m.id)}</b> ${esc(title)}</td>
        <td>${m.demo ? `<a href="../simulink/index.html?lang=en#${m.id}">${esc(m.demo)}</a>` : "—"}</td>
        <td><div class="metric">${spark(m.spark)}<span>${esc(metric)}</span></div></td>
        <td>${m.metric_source === "offline" ? "Offline lecture value" : "Probe"}</td>
        <td><a href="../simulink/models/${esc(m.model)}" download>${esc(m.model)}</a></td>
      </tr>`;
}).join("\n");
if (cjk) console.warn(`warning: ${cjk} CJK characters left in metrics`);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MATLAB comparison: 43/43 · vibe-lab</title>
  <meta name="description" content="English provenance table for 43 MATLAB/Simulink models: SHA-256, solver, stop time, signal statistics and model downloads." />
  <link rel="stylesheet" href="../style.css" />
  <link rel="canonical" href="https://xingd5478-ctrl.github.io/vibe-lab/about/matlab-en.html" />
  <link rel="alternate" hreflang="zh-CN" href="https://xingd5478-ctrl.github.io/vibe-lab/about/matlab.html" />
  <link rel="alternate" hreflang="en" href="https://xingd5478-ctrl.github.io/vibe-lab/about/matlab-en.html" />
  <style>
    .wrap { max-width: 1120px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th, td { border-bottom: 1px solid var(--line); padding: 8px 7px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    .metric { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
    .spark { width: 120px; height: 28px; color: var(--accent); }
    .hint { color: var(--muted); font-size: 12px; }
    @media (prefers-color-scheme: dark) { .spark { color: #7fb3e0; } }
  </style>
</head>
<body>
  <div class="wrap">
    <nav class="topnav" aria-label="Site navigation">
      <a href="../">Home</a><a href="../imu/?lang=en">IMU</a><a href="../control/?lang=en">Control</a>
      <a href="../simulink/index.html?lang=en">Simulink</a><a href="en.html">Method</a>
      <a href="matlab.html">Chinese</a>
    </nav>
    <header>
      <div class="kicker">vibe-lab / method / matlab</div>
      <h1>MATLAB comparison: 43/43</h1>
      <p class="sub">Every vendored <code>.slx</code> was simulated with MATLAB ${esc(data.matlab_version)}. The table links model downloads and records the probe metric; the Chinese table keeps the per-model caveats.</p>
      <p class="hint">Generated ${esc(data.generated_at)} · ${data.ok_count}/${data.model_count} models · ${data.toolbox_count} toolboxes · <a href="../data/matlab-probes.json" download>raw JSON</a> · <a href="en.html">method</a></p>
    </header>
    <main id="main">
      <table>
        <thead><tr><th>Lesson</th><th>Demo</th><th>Probe metric</th><th>Source</th><th>Model</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
      <p class="hint">Detailed differences and caveats (t10, t20, t21, t31, modified t32/t35) are documented in the <a href="matlab.html">Chinese provenance table</a>. Numbers are language-independent; the model SHA-256 is in the raw JSON.</p>
    </main>
    <footer><a href="en.html">← method</a> · <a href="../">vibe-lab</a></footer>
  </div>
  <script>
    (function () {
      if (location.protocol !== "https:") return;
      var s = document.createElement("script");
      s.async = true; s.src = "https://gc.zgo.at/count.js";
      s.setAttribute("data-goatcounter", "https://xingdong.goatcounter.com/count");
      document.head.appendChild(s);
    })();
  </script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, "about", "matlab-en.html"), html);
console.log(`wrote about/matlab-en.html (${data.models.length} rows, ${cjk} CJK left)`);
