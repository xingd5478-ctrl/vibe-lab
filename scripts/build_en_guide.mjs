/* Build the full English 43-lesson guide from lessons.js + guide-en.js. */
import fs from "node:fs";
import path from "node:path";
import { PAGES, navFor } from "./site_layout.mjs";
import { footerFor } from "./site_footer.mjs";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
function loadWindow(file) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  return ctx.window;
}
const L = loadWindow("simulink/lessons.js").SIMULINK_LESSONS;
const G = loadWindow("simulink/guide-en.js").SIMULINK_GUIDE_EN;
const i18n = fs.readFileSync(path.join(ROOT, "shared", "i18n.js"), "utf8");
const block = i18n.match(/const TITLES = \{([\s\S]*?)\n  \};/);
if (!block) throw new Error("TITLES block not found");
const TITLES = Function(`return ({${block[1]}});`)();
const ROOT_URL = "https://xingd5478-ctrl.github.io/vibe-lab";
const PHASES = {
  "Phase 1 · Simulink 基础与动力学": "Phase 1 · Simulink & dynamics",
  "Phase 2 · 经典控制设计": "Phase 2 · Classical control",
  "Phase 3 · 现代控制": "Phase 3 · Modern control",
  "Phase 4 · 高级控制": "Phase 4 · Advanced control",
  "Phase 5 · 机电系统与部署": "Phase 5 · Mechatronics & deployment",
  "Phase 6 · 综合案例": "Phase 6 · Case studies",
  "Phase 7 · 非线性滤波": "Phase 7 · Nonlinear filtering",
  "Phase 8 · Simulink 进阶": "Phase 8 · Advanced Simulink",
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const phases = L.phases
  .map((ph) => {
    const items = ph.items
      .map((l) => {
        const g = G[l.id];
        if (!g) throw new Error(`missing guide for ${l.id}`);
        const title = TITLES[l.title] || `Lesson ${l.n}`;
        const concepts = g.concepts.map(([t, d]) => `<li><b>${esc(t)}</b> — ${esc(d)}</li>`).join("");
        const steps = g.steps.map((s) => `<li>${esc(s)}</li>`).join("");
        const quiz = (g.quiz || []).map(([q, a]) => `<li><b>${esc(q)}</b><br><span>${esc(a)}</span></li>`).join("");
        return `      <details class="lesson" id="${l.id}"${l.id === "t01" ? " open" : ""}>
        <summary><span class="num">${l.id}</span> ${esc(title)}</summary>
        <div class="lesson-body">
          <p class="hook">${esc(g.hook)}</p>
          <p><b>Goal.</b> ${esc(g.goal)}</p>
          <h4>Concepts</h4><ul>${concepts}</ul>
          <div class="math">${esc(g.math)}</div>
          <h4>Steps</h4><ol>${steps}</ol>
          <p><b>Watch for.</b> ${esc(g.watch)}</p>
          <p class="pitfall"><b>Pitfall.</b> ${esc(g.pitfall)}</p>
          <h4>Check yourself</h4><ol class="quiz">${quiz}</ol>
          <p class="dl"><a href="../simulink/models/${esc(l.model)}" download>${esc(l.model)}</a> · <a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial/blob/main/${esc(l.file)}" target="_blank" rel="noreferrer">${esc(l.file)}</a> · <a href="../simulink/course.html?id=${l.id}">Chinese source notes</a></p>
        </div>
      </details>`;
      })
      .join("\n");
    const label = PHASES[ph.title] || ph.title;
    return `    <h2>${esc(label)} <span class="range">${esc(ph.range)}</span></h2>\n${items}`;
  })
  .join("\n\n");

let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>43-lesson Simulink guide · vibe-lab</title>
  <meta name="description" content="English guide to all 43 Simulink control lessons: goals, concepts, steps, pitfalls and self-checks, with .slx and .m downloads." />
  <meta name="theme-color" content="#f4f2ec" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#15171c" media="(prefers-color-scheme: dark)" />
  <link rel="stylesheet" href="../style.css" />
  <link rel="canonical" href="${ROOT_URL}/en/guide.html" />
  <link rel="alternate" hreflang="zh-CN" href="${ROOT_URL}/simulink/course.html" />
  <link rel="alternate" hreflang="en" href="${ROOT_URL}/en/guide.html" />
  <style>
    .wrap { max-width: 980px; }
    .lesson { background: var(--panel); border: 1px solid var(--line); border-radius: 3px; margin: 10px 0; padding: 0 14px; }
    .lesson > summary { cursor: pointer; padding: 12px 0; font-weight: 600; list-style: none; }
    .lesson > summary::-webkit-details-marker { display: none; }
    .lesson > summary::before { content: "+"; display: inline-block; width: 18px; color: var(--muted); }
    .lesson[open] > summary::before { content: "−"; }
    .lesson .num { font-family: "Cascadia Mono", Consolas, monospace; color: var(--muted); margin-right: 6px; }
    .lesson-body { padding: 0 0 14px 18px; border-top: 1px solid var(--line); }
    .lesson-body h4 { margin: 14px 0 4px; font-size: 13px; }
    .lesson-body ul, .lesson-body ol { margin: 4px 0 8px; padding-left: 20px; font-size: 13px; line-height: 1.65; }
    .hook { font-size: 14px; color: var(--ink); }
    .math { font-family: "Cascadia Mono", Consolas, monospace; background: var(--bg); border-left: 2px solid var(--accent); padding: 6px 9px; margin: 8px 0; font-size: 12.5px; overflow-x: auto; }
    .pitfall { border-left: 2px solid #b58a3a; padding-left: 9px; color: var(--muted); }
    .quiz span { color: var(--muted); }
    .dl { font-size: 12px; color: var(--muted); margin-top: 12px; }
    h2 { margin-top: 28px; font-size: 16px; }
    h2 .range { color: var(--muted); font-weight: 400; font-size: 12px; }
    .guide-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 18px 0 4px; }
    .guide-tools input { flex: 1 1 280px; padding: 8px 10px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: inherit; border-radius: 2px; }
    .guide-tools button { padding: 7px 10px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: inherit; border-radius: 2px; cursor: pointer; }
    .guide-tools button:hover { border-color: var(--accent); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  </style>
  <script defer src="../shared/sentry-config.js"></script>
  <script defer src="../shared/observability.js"></script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <div class="wrap">
    <nav class="topnav" aria-label="Site navigation">
      <a href="./">Home</a>
      <a href="../imu/?lang=en">IMU</a>
      <a href="../control/?lang=en">Control</a>
      <a href="../simulink/index.html?lang=en">Simulink</a>
      <a href="../about/en.html">Method</a>
      <a href="../simulink/course.html">Chinese</a>
    </nav>
    <header>
      <div class="kicker">vibe-lab / simulink / 43-lesson guide</div>
      <h1>The 43-lesson English guide</h1>
      <p class="sub">Every lesson in English: goal, concepts, formula, steps, what to watch, pitfalls and a self-check. Download the <code>.slx</code> model or the original <code>.m</code>; the Chinese source notes remain available for comparison.</p>
<p class="hint">After 43 lessons you should be able to: build first/second-order and closed-loop models, read Bode and step responses, explain the trade-offs in PID, state feedback, observers and Kalman filters, and know when a real calibration is still required.</p>
      <p class="hint">This is the readable English companion to the interactive demos. The original Chinese lesson prose is not hidden here as a requirement; it is linked per lesson.</p>
    </header>
    <main id="main">
      <div class="guide-tools">
        <label for="guide-search" class="sr-only">Search lessons</label>
        <input id="guide-search" type="search" placeholder="Search 43 lessons: PID, Kalman, root locus…" />
        <button type="button" id="guide-expand">Expand all</button>
        <button type="button" id="guide-collapse">Collapse all</button>
        <span id="guide-count" class="hint">43 lessons</span>
      </div>
      <p class="hint"><a href="lessons.html">← compact lesson index</a> · <a href="../simulink/index.html?lang=en">interactive labs</a></p>
${phases}
    </main>
    <footer><a href="./">← vibe-lab</a> · <a href="lessons.html">43-lesson index</a> · <a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">Tutorial source</a></footer>
  </div>
  <script>
    (function () {
      var cards = Array.prototype.slice.call(document.querySelectorAll(".lesson"));
      var q = document.getElementById("guide-search");
      var count = document.getElementById("guide-count");
      if (q) {
        q.addEventListener("input", function () {
          var text = q.value.trim().toLowerCase();
          var shown = 0;
          cards.forEach(function (card) {
            var hit = !text || card.textContent.toLowerCase().indexOf(text) >= 0;
            card.hidden = !hit;
            if (hit) { shown++; if (text) card.open = true; }
          });
          if (count) count.textContent = shown + " / " + cards.length + " lessons";
        });
      }
      var ex = document.getElementById("guide-expand");
      if (ex) ex.addEventListener("click", function () { cards.forEach(function (c) { if (!c.hidden) c.open = true; }); });
      var co = document.getElementById("guide-collapse");
      if (co) co.addEventListener("click", function () { cards.forEach(function (c) { c.open = false; }); });
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
html = html.replace(/<nav class="topnav"[\s\S]*?<\/nav>/, navFor(PAGES["landing/en/guide.html"]));
html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/, footerFor("landing/en/guide.html"));
fs.writeFileSync(path.join(ROOT, "landing", "en", "guide.html"), html);
console.log(`wrote landing/en/guide.html (${phases.split("<details").length - 1} lessons)`);
