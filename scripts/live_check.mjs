/* Post-deploy smoke check against the canonical GitHub Pages URL. */
const BASE = process.env.SITE_BASE || "https://xingd5478-ctrl.github.io/vibe-lab";
const checks = [
  ["/", "vibe-lab"],
  ["/en/guide.html", "guide-search"],
  ["/about/matlab-en.html", "Caveats"],
  ["/feedback.html", "Tally"],
  ["/shared/i18n.js", "VibeI18n"],
  ["/shared/sentry-config.js", "app.glitchtip.com"],
  ["/motion.js", "scope-canvas"],
  ["/data/feedback.json", '"total"'],
  ["/imu/manual-en.js", "IMU_MANUAL_EN"],
  ["/model/", "Model Lab"],
  ["/model/core/identify.js", "fitFOPDT"],
];

let failed = 0;
for (const [path, needle] of checks) {
  const url = BASE + path + (path.includes("?") ? "&" : "?") + "v=" + Date.now();
  try {
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        r = await fetch(url, { headers: { "Cache-Control": "no-cache" }, redirect: "follow" });
        if (r.ok) break;
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    const text = await r.text();
    const ok = r.ok && text.includes(needle);
    console.log(`${ok ? "ok  " : "FAIL"} ${r.status} ${path} (${text.length}b)`);
    if (!ok) failed++;
  } catch (e) {
    console.error(`FAIL ${path}: ${e.message}`);
    failed++;
  }
}
if (failed) {
  console.error(`live smoke failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`live smoke OK (${checks.length} endpoints)`);
