/* Generate about/matlab.html from data/matlab-probes.json.
   Usage: node scripts/build_matlab_table.mjs [--check] */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "matlab-probes.json");
const OUT = path.join(ROOT, "about", "matlab.html");
const CHECK = process.argv.includes("--check");

if (!fs.existsSync(DATA)) {
  console.error("missing data/matlab-probes.json; run: node scripts/build_matlab_data.mjs");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const rows = [...data.models].sort((a, b) => a.n - b.n);
if (rows.length !== 43) throw new Error(`expected 43 rows, got ${rows.length}`);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const shortHash = (h) => String(h || "").slice(0, 10);
const fmtTime = (t) => Number.isFinite(Number(t)) ? `${Number(t)} s` : "—";

function sparkSvg(values) {
  const v = (values || []).map(Number).filter((x) => Number.isFinite(x));
  if (v.length < 2) return "";
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * 120).toFixed(1)},${(25 - (x - min) / span * 20).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 120 28" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

const body = rows.map((r) => {
  const demo = r.demo
    ? `<a href="../simulink/#${esc(r.demo)}">${esc(r.demo)}</a>`
    : "—";
  const refs = r.refs && r.refs.length ? ` +${r.refs.length} refs` : "";
  const status = r.status === "ok" ? "ok" : "blocked";
  return `        <tr data-search="${esc([r.id, r.title, r.demo, r.metric, r.note, r.solver].join(" "))}">
          <td><a href="../simulink/course.html?id=${esc(r.id)}">${esc(r.id)}</a> ${esc(r.title)}
            <a class="slx" href="../simulink/models/${esc(r.model)}" download title="下载 ${esc(r.model)}">.slx</a></td>
          <td>${demo}</td>
          <td><div class="metric-cell">${sparkSvg(r.spark)}<span>${r.metric_source === "offline" ? '<span class="source-offline" title="该数字来自离线讲义，不是本次探针逐点计算">离线</span> ' : ""}${esc(r.metric)}</span></div></td>
          <td>${esc(r.note)}</td>
          <td><code>${esc(r.solver)}</code><br>${esc(fmtTime(r.stop_time))} · <span class="hash" title="SHA-256: ${esc(r.sha256)}">${esc(shortHash(r.sha256))}</span>${refs}<br><span class="status ${status}">${status}</span></td>
        </tr>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MATLAB 对照 · 43 个模型 · vibe-lab</title>
  <meta name="description" content="MATLAB R2025a 对 43 个 Simulink .slx 模型逐一仿真：模型哈希、求解器、停止时间、输出统计与网页 demo 对照。" />
  <meta name="theme-color" content="#f4f2ec" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#15171c" media="(prefers-color-scheme: dark)" />
  <meta property="og:title" content="MATLAB 对照 · 43 个模型 · vibe-lab" />
  <meta property="og:description" content="43/43 个 Simulink 模型真机仿真，公开模型哈希、求解器与输出统计。" />
  <meta property="og:type" content="article" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%231f4e79'/%3E%3Cpath d='M5 23 L11 13 L16 19 L21 9 L27 15' stroke='%23fff' stroke-width='2' fill='none'/%3E%3C/svg%3E" />
  <link rel="manifest" href="../manifest.webmanifest" />
  <link rel="apple-touch-icon" href="../icon-192.png" />
  <link rel="stylesheet" href="style.css" />
  <link rel="canonical" href="https://vibe-lab.xingd5478.workers.dev/about/matlab.html" />
  <meta property="og:image" content="https://vibe-lab.xingd5478.workers.dev/icon-512.png" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body class="wide">
  <a class="skip" href="#main">跳到内容</a>
  <div class="wrap">
    <nav class="topnav" aria-label="全站导航">
      <a href="../" data-local="../landing/index.html">首页</a>
      <a href="../imu/" data-local="../imu-lab/static/index.html">IMU</a>
      <a href="../control/" data-local="../control-play/index.html">Control</a>
      <a href="../simulink/" data-local="../simulink/index.html">Simulink</a>
      <a href="./" data-local="index.html" aria-current="page">方法</a>
      <a href="../en/" data-local="../landing/en/index.html" hreflang="en" lang="en">EN</a>
    </nav>
    <header>
      <div class="kicker">vibe-lab / method / matlab</div>
      <h1>MATLAB 对照：43 / 43</h1>
      <p class="sub">用 MATLAB ${esc(data.matlab_version.split(" ")[0])} 对仓库里的 43 个 <code>.slx</code> 逐一仿真；每个模型都记录 SHA-256、求解器、停止时间与输出统计，再与网页 demo 对照。</p>
      <p class="matlab-meta">生成时间：${esc(data.generated_at)} · ${data.ok_count}/${data.model_count} 通过 · ${data.toolbox_count} 个工具箱 · <a href="../data/matlab-probes.json" download>下载原始 JSON</a> · <a href="./">返回方法说明</a></p>
    </header>

    <main id="main">
      <section class="panel">
        <div class="matlab-toolbar">
          <label for="matlab-search">筛选</label>
          <input id="matlab-search" type="search" placeholder="课程、指标、说明、求解器…" autocomplete="off" />
          <span id="matlab-count" class="count">${rows.length} / ${rows.length}</span>
        </div>
        <div class="matlab-table-wrap">
          <table class="matlab-table">
            <thead><tr><th>课程</th><th>网页 demo</th><th>.slx 实测</th><th>说明</th><th>出处</th></tr></thead>
            <tbody id="matlab-rows">
${body}
            </tbody>
          </table>
        </div>
        <p class="hint">只列真机跑过的模型，没有用网页结果反填。t20/t21/t31 的差异见各行的“说明”；t24 的 FIS 是探针占位，原讲义 FIS 未随模型分发；t26 的 Stateflow 模型没有记录输出。JSON 里保留了每个模型的关键信号统计；模型文件变化时 <code>npm run check:matlab</code> 会报哈希不一致。</p>
      </section>
    </main>

    <footer>
      <a href="../" data-local="../landing/index.html">← vibe-lab</a> ·
      <a href="../imu/" data-local="../imu-lab/static/index.html">IMU Lab</a> ·
      <a href="../control/" data-local="../control-play/index.html">Control Play</a> ·
      <a href="../simulink/" data-local="../simulink/index.html">Simulink</a>
    </footer>
  </div>

  <script>
    (function () {
      if (location.protocol === "file:") {
        document.querySelectorAll("[data-local]").forEach(function (a) {
          a.href = a.getAttribute("data-local");
        });
      }
      var q = document.getElementById("matlab-search");
      var rows = Array.prototype.slice.call(document.querySelectorAll("#matlab-rows tr"));
      var count = document.getElementById("matlab-count");
      q.addEventListener("input", function () {
        var v = q.value.trim().toLowerCase();
        var n = 0;
        rows.forEach(function (tr) {
          var hit = !v || (tr.getAttribute("data-search") || "").toLowerCase().indexOf(v) >= 0;
          tr.hidden = !hit;
          if (hit) n++;
        });
        count.textContent = n + " / " + rows.length;
      });
    })();
  </script>
  <script>
    (function () {
      if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;
      var root = location.pathname.replace(/(imu|control|about|simulink|en)\\/(index\\.html|matlab\\.html)?$/, "");
      navigator.serviceWorker.register(root + "sw.js").catch(function () {});
    })();
  </script>
  <script>
  (function () {
    if (location.protocol !== "https:") return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", "https://xingdong.goatcounter.com/count");
    document.head.appendChild(s);
  })();
</script>
</body>
</html>
`;

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== html) {
    console.error("about/matlab.html is out of date; run: node scripts/build_matlab_table.mjs");
    process.exit(1);
  }
  console.log(`matlab table ok: ${rows.length} rows`);
} else {
  fs.writeFileSync(OUT, html);
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${rows.length} rows`);
}
