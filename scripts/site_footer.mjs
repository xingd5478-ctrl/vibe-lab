/* Single source for static footers. 404 stays dynamic and is intentionally excluded. */
export const FOOTERS = {
  "landing/index.html": {
    lead: "vibe-lab · 本地优先：数据不上传，交互计算在浏览器",
    links: [
      '<a href="about/">方法说明</a>',
      '<a href="feedback.html?v=2">反馈</a>',
      '<a href="LICENSE" target="_blank" rel="noreferrer">MIT License</a>',
      '<a href="https://github.com/xingd5478-ctrl/vibe-lab" target="_blank" rel="noreferrer">源码</a>',
    ],
  },
  "landing/en/index.html": {
    lead: "vibe-lab · local-first: interactive computation in your browser",
    links: [
      '<a href="../about/en.html">Method</a>',
      '<a href="https://github.com/xingd5478-ctrl/vibe-lab/issues/new?template=feedback.yml">Feedback</a>',
      '<a href="https://tally.so/r/9N98bY">Tally form</a>',
      '<a href="../LICENSE" target="_blank" rel="noreferrer">MIT License</a>',
      '<a href="https://github.com/xingd5478-ctrl/vibe-lab" target="_blank" rel="noreferrer">Source</a>',
    ],
  },
  "landing/feedback.html": {
    links: [
      '<a href="./">← vibe-lab</a>',
      '<a href="./about/">方法说明</a>',
      '<a href="https://github.com/xingd5478-ctrl/vibe-lab" target="_blank" rel="noreferrer">源码</a>',
    ],
  },
  "imu-lab/static/index.html": {
    lead: "vibe-lab · 数据与算法在浏览器内运行 · 工程近似：R=(ARW/60)²·Δt，Q=(RRW/60)²·Δt · 仅用于教学/演示，真实标定以论文流程为准。",
    links: [
      '<a href="../">← vibe-lab</a>',
      '<a href="../control/">Control Play →</a>',
      '<a href="../about/">方法说明</a>',
    ],
  },
  "control-play/index.html": {
    lead: 'vibe-lab · 零依赖 SVG · 参数同步到 URL（<span id="url-params">—</span>） · 仅用于教学/复习演示',
    links: ['<a href="../">← vibe-lab</a>', '<a href="../imu/">IMU Lab →</a>', '<a href="../about/">方法说明</a>'],
  },
  "simulink/index.html": {
    lead: "vibe-lab · Simulink 教程交互复现",
    links: [
      '<a href="../">首页</a>',
      '<a href="../imu/" data-nav="imu">IMU 数据实验室</a>',
      '<a href="../control/" data-nav="control">Control Play</a>',
      '<a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">教程源码</a>',
    ],
  },
  "simulink/course.html": {
    lead: "课程内容 © 邢栋 · MIT",
    links: [
      '<a href="index.html">交互复现</a>',
      '<a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">教程源码</a>',
      '<a href="../">首页</a>',
    ],
  },
  "about/index.html": {
    links: [
      '<a href="../">← vibe-lab</a>',
      '<a href="../imu/" data-nav="imu">IMU Lab</a>',
      '<a href="../control/" data-nav="control">Control Play</a>',
      '<a href="en.html" hreflang="en" lang="en">English</a>',
    ],
  },
  "about/en.html": {
    links: [
      '<a href="../en/">← vibe-lab</a>',
      '<a href="index.html?lang=zh">Chinese method page</a>',
      '<a href="matlab.html">MATLAB 43/43</a>',
    ],
  },
  "about/matlab.html": {
    links: [
      '<a href="../">← vibe-lab</a>',
      '<a href="../imu/">IMU Lab</a>',
      '<a href="../control/">Control Play</a>',
      '<a href="../simulink/">Simulink</a>',
    ],
  },
  "about/matlab-en.html": {
    links: ['<a href="en.html">← method</a>', '<a href="../">vibe-lab</a>'],
  },
  "landing/en/lessons.html": {
    links: [
      '<a href="./">← vibe-lab</a>',
      '<a href="../about/en.html">Method</a>',
      '<a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">Tutorial source</a>',
    ],
  },
  "landing/en/guide.html": {
    links: [
      '<a href="./">← vibe-lab</a>',
      '<a href="lessons.html">43-lesson index</a>',
      '<a href="https://github.com/xingd5478-ctrl/simulink-control-tutorial" target="_blank" rel="noreferrer">Tutorial source</a>',
    ],
  },
};

export function footerFor(rel) {
  const f = FOOTERS[rel];
  if (!f) return "";
  const lead = f.lead ? `\n  <span>${f.lead}</span>` : "";
  const sep = lead && f.links.length ? " · " : "";
  return `<footer class="site-footer">${lead}${sep}${f.links.join(" · ")}\n</footer>`;
}
