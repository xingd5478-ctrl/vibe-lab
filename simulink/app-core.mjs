/* Simulink 教程页：目录 + 5 个交互复现（chart.js + SimControl） */
const $ = (id) => document.getElementById(id);
const { plot } = window.IMUChart;
const S = window.SimControl;
const DATA = window.SIMULINK_LESSONS;
const REPO = DATA.repo;

const lessonById = {};
DATA.phases.forEach((ph) =>
  ph.items.forEach((l) => {
    lessonById[l.id] = l;
  })
);

const toPts = (t, y) => {
  const out = new Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = [t[i], y[i]];
  return out;
};
const maxOf = (arr) => arr.reduce((m, v) => (v > m ? v : m), -Infinity);
const minOf = (arr) => arr.reduce((m, v) => (v < m ? v : m), Infinity);
const f2 = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

function metrics(list) {
  if (window.LabKit) return window.LabKit.metrics($("metrics"), list);
  $("metrics").innerHTML = list.map(([k, v]) => `<div class="metric"><span>${k}</span><b>${v}</b></div>`).join("");
}

function links(id) {
  const l = lessonById[id];
  if (!l) {
    $("links").innerHTML = "";
    return;
  }
  $("links").innerHTML =
    `<a href="course.html?id=${l.id}">本课讲义 →</a>` +
    `<a href="${REPO}/blob/main/${l.file}" target="_blank" rel="noreferrer">第 ${l.n} 课 · ${l.file}</a>` +
    `<a href="models/${l.model}" download>下载 ${l.model}（本站）</a>` +
    `<a href="${REPO}" target="_blank" rel="noreferrer">教程仓库</a>`;
}

function diagram(spec) {
  const el = $("diagram");
  const n = spec.blocks.length;
  const w = Math.max(el.clientWidth || 640, 420);
  const h = spec.feedback ? 170 : 120;
  const bw = Math.max(84, Math.min(150, (w - 40 - (n - 1) * 34) / n));
  const gap = 34,
    y = 26,
    bh = 52;
  let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${spec.aria || "Simulink 框图"}">
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path class="arrow-head" d="M0,0 L8,4 L0,8 z" fill="#1b1d22"/></marker>
        <marker id="ah2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path class="fb-head" d="M0,0 L8,4 L0,8 z" fill="#2f6b4f"/></marker>
      </defs>`;
  spec.blocks.forEach((b, i) => {
    const x = 20 + i * (bw + gap);
    const isSum = b.label === "Σ";
    svg += `<rect class="blk${isSum ? " blk-sum" : ""}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3"/>`;
    svg += `<text class="blk-label" x="${x + bw / 2}" y="${y + (b.sub ? 21 : 30)}" text-anchor="middle">${b.label}</text>`;
    if (b.sub) svg += `<text class="blk-sub" x="${x + bw / 2}" y="${y + 37}" text-anchor="middle">${b.sub}</text>`;
    if (i < n - 1) {
      svg += `<line class="arrow" x1="${x + bw}" y1="${y + bh / 2}" x2="${x + bw + gap - 3}" y2="${y + bh / 2}"/>`;
    }
  });
  if (spec.feedback) {
    const lastX = 20 + (n - 1) * (bw + gap) + bw / 2;
    const firstX = 20 + spec.sumIndex * (bw + gap) + bw / 2;
    const yb = y + bh,
      yf = h - 16;
    svg += `<path class="fb" d="M${lastX},${yb} V${yf} H${firstX} V${yb + 2}" marker-end="url(#ah2)"/>`;
    svg += `<text class="fb-label" x="${(lastX + firstX) / 2}" y="${yf - 6}" text-anchor="middle">${spec.feedback}</text>`;
  }
  svg += "</svg>";
  el.innerHTML = svg;
}

function renderArm(el, a) {
  const W = Math.max(el.clientWidth || 640, 320),
    H = 300;
  const scale = Math.min((W * 0.55) / a.maxReach, (H * 0.72) / a.maxReach);
  const ox = W * 0.2,
    oy = H * 0.8;
  const x1 = ox + a.l1 * Math.cos(a.th1) * scale;
  const y1 = oy - a.l1 * Math.sin(a.th1) * scale;
  const x2 = x1 + a.l2 * Math.cos(a.th1 + a.th2) * scale;
  const y2 = y1 - a.l2 * Math.sin(a.th1 + a.th2) * scale;
  const tx = ox + a.ex * scale,
    ty = oy - a.ey * scale;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="两连杆机械臂，末端 ${a.ex.toFixed(2)},${a.ey.toFixed(2)}">
        <line class="arm-grid" x1="0" y1="${oy}" x2="${W}" y2="${oy}" stroke="#e7e3d8"/>
        <line class="arm-grid" x1="${ox}" y1="0" x2="${ox}" y2="${H}" stroke="#e7e3d8"/>
        <circle class="arm-base" cx="${ox}" cy="${oy}" r="7" fill="#1b1d22"/>
        <line class="arm-link-1" x1="${ox}" y1="${oy}" x2="${x1}" y2="${y1}" stroke="#1f4e79" stroke-width="7" stroke-linecap="round"/>
        <line class="arm-link-2" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2f6b4f" stroke-width="7" stroke-linecap="round"/>
        <circle class="arm-joint" cx="${x1}" cy="${y1}" r="6" fill="#fff" stroke="#1f4e79" stroke-width="2"/>
        <circle class="arm-target${a.reachable ? "" : " bad"}" cx="${x2}" cy="${y2}" r="8" fill="${a.reachable ? "#1f4e79" : "#8a4a12"}"/>
        <line class="arm-cross" x1="${tx - 7}" y1="${ty}" x2="${tx + 7}" y2="${ty}" stroke="#8a4a12" stroke-width="1.5"/>
        <line class="arm-cross" x1="${tx}" y1="${ty - 7}" x2="${tx}" y2="${ty + 7}" stroke="#8a4a12" stroke-width="1.5"/>
        <text class="arm-label" x="${ox + 8}" y="${oy - 8}" font-size="11" fill="#5b564c" font-family="Consolas">base</text>
      </svg>`;
}

const sfState = { state: 0, log: [[0, 0]], lastCmd: 0 };

export { $, S, DATA, REPO, lessonById, toPts, maxOf, minOf, f2, metrics, links, diagram, renderArm, sfState, plot };
