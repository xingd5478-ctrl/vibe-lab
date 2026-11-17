/* Generate the English lesson index (landing/en/lessons.html) from lessons.js. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { PAGES, navFor } from "./site_layout.mjs";
import { footerFor } from "./site_footer.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "simulink", "lessons.js"), "utf8"), ctx, {
  filename: "simulink/lessons.js",
});
const DATA = ctx.window.SIMULINK_LESSONS;
const lessons = [];
DATA.phases.forEach((ph) => ph.items.forEach((l) => lessons.push({ ...l, zh: l.title })));
const i18n = fs.readFileSync(path.join(ROOT, "shared", "i18n.js"), "utf8");
const block = i18n.match(/const TITLES = \{([\s\S]*?)\n  \};/);
if (!block) throw new Error("TITLES block not found");
const TITLES = Function(`return ({${block[1]}});`)();
if (lessons.length !== 43) throw new Error(`expected 43 lessons, got ${lessons.length}`);

const rows = lessons
  .map((l) => {
    const title = TITLES[l.zh] || `Lesson ${l.n}`;
    const demo = l.demo ? ` · <a href="../simulink/index.html?lang=en#${l.id}">interactive</a>` : "";
    return `      <tr>
        <td><span class="n">${l.id}</span> ${title}${demo}</td>
        <td><a href="../simulink/course.html?id=${l.id}" data-local="../../simulink/course.html?id=${l.id}">Chinese notes</a></td>
        <td><a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial/blob/main/${l.file}" target="_blank" rel="noreferrer">${l.file}</a></td>
        <td><a href="../simulink/models/${l.model}" data-local="../../simulink/models/${l.model}" download>${l.model}</a></td>
      </tr>`;
  })
  .join("\n");

let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>43 lessons · Simulink tutorial · vibe-lab</title>
  <meta name="description" content="English index of the 43-lesson Simulink control tutorial: model downloads, MATLAB sources and interactive demos." />
  <meta name="theme-color" content="#f4f2ec" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#15171c" media="(prefers-color-scheme: dark)" />
  <link rel="stylesheet" href="../style.css" />
  <link rel="canonical" href="https://xingd5478-ctrl.github.io/vibe-lab/en/lessons.html" />
  <link rel="alternate" hreflang="zh-CN" href="https://xingd5478-ctrl.github.io/vibe-lab/simulink/course.html" />
  <link rel="alternate" hreflang="en" href="https://xingd5478-ctrl.github.io/vibe-lab/en/lessons.html" />
  <style>
    .wrap { max-width: 1100px; }
    .lesson-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .lesson-table th, .lesson-table td { border-bottom: 1px solid var(--line); padding: 7px 8px; text-align: left; vertical-align: top; }
    .lesson-table th { color: var(--muted); font-weight: 600; }
    .lesson-table .n { font-family: "Cascadia Mono", Consolas, monospace; color: var(--muted); margin-right: 6px; }
    .note { border-left: 2px solid var(--accent); background: #fbf9f2; color: var(--muted); padding: 8px 12px; font-size: 13px; margin: 18px 0; }
    @media (prefers-color-scheme: dark) { .note { background: #222831; } }
  </style>
  <script src="../shared/sentry-config.js"></script>
  <script src="../shared/observability.js"></script>
</head>
<body>
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
      <div class="kicker">vibe-lab / simulink / 43 lessons</div>
      <h1>43 lessons, in English index form</h1>
      <p class="sub">The interactive demos and model downloads are here; the long-form lesson prose is currently Chinese-only. Every row links to the original <code>.m</code> and the vendored <code>.slx</code>.</p>
    </header>
    <main id="main">
      <div class="note">Read the <a href="guide.html"><b>full 43-lesson English guide</b></a> for goals, concepts, steps and self-checks. The course reader at <a href="../simulink/course.html">/simulink/course.html</a> has the original Chinese source notes.</div>
      <table class="lesson-table">
        <thead><tr><th>Lesson</th><th>Notes</th><th>MATLAB source</th><th>Simulink model</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </main>
    <footer><a href="./">← vibe-lab</a> · <a href="../about/en.html">Method</a> · <a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">Tutorial source</a></footer>
  </div>
  <script>
    (function () {
      if (location.protocol !== "file:") return;
      document.querySelectorAll("[data-local]").forEach(function (a) { a.href = a.getAttribute("data-local"); });
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
html = html.replace(/<nav class="topnav"[\s\S]*?<\/nav>/, navFor(PAGES["landing/en/lessons.html"]));
html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/, footerFor("landing/en/lessons.html"));
fs.writeFileSync(path.join(ROOT, "landing", "en", "lessons.html"), html);
console.log(`wrote landing/en/lessons.html (${lessons.length} lessons)`);
