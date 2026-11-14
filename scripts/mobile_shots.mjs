/* Mobile viewport screenshots (390x844, touch emulation) for layout regression.
   This is CDP emulation, not a physical-device test. */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => fs.existsSync(p));
if (!EDGE) { console.log("MOBILE VISUAL SKIP: Edge not found"); process.exit(0); }
const UPDATE = process.argv.includes("--update");
const OUT = path.join(ROOT, "artifacts", "visual-mobile");
const BASE = path.join(ROOT, "tests", "baselines-mobile");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".csv": "text/csv", ".webmanifest": "application/manifest+json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.statusCode = 403; res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.statusCode = 404; res.end("nf"); return; }
      res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  };
  return {
    open: new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq; pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    close: () => ws.close(),
  };
}
async function waitFor(fn, timeout = 20000) {
  const t = Date.now();
  while (Date.now() - t < timeout) { try { if (await fn()) return; } catch {} await sleep(100); }
  throw new Error("timeout");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-mobile-"));
  const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--disable-features=ServiceWorker", "--remote-debugging-port=9344", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    await waitFor(async () => (await fetch("http://127.0.0.1:9344/json/version")).ok, 20000);
    const target = await (await fetch("http://127.0.0.1:9344/json/new?about:blank", { method: "PUT" })).json();
    const c = cdp(target.webSocketDebuggerUrl);
    await c.open;
    await c.send("Page.enable");
    await c.send("Runtime.enable");
    await c.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await c.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    const ev = async (expr) => {
      const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };
    const pages = [
      ["landing", "landing/index.html", "!!document.querySelector('.card')"],
      ["landing-en", "landing/en/index.html", "!!document.querySelector('.card')"],
      ["imu", "imu-lab/static/index.html", "!!document.querySelector('#chart-time svg')"],
      ["control", "control-play/index.html", "!!document.querySelector('#bode svg')"],
      ["simulink", "simulink/index.html", "!!document.querySelector('#chart-a svg')"],
      ["about", "about/index.html", "!!document.querySelector('h1')"],
      ["matlab", "about/matlab.html", "document.querySelectorAll('#matlab-rows tr').length === 43"],
      ["course", "simulink/course.html?id=t21", "!!document.querySelector('#lesson-body .guide')"],
    ];
    for (const [name, file, ready] of pages) {
      await c.send("Page.navigate", { url: `${base}/${file}` });
      await waitFor(() => ev("document.readyState === 'complete'"));
      await waitFor(() => ev(ready), 25000);
      await sleep(700);
      const overflow = await ev("document.documentElement.scrollWidth - innerWidth");
      if (overflow > 1) throw new Error(`${name}: horizontal overflow ${overflow}px`);
      const smallTargets = await ev(`[...document.querySelectorAll('.topnav a, button, select, input[type="range"], input[type="number"], input[type="search"], input[type="file"]')]
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(x => x.r.width > 0 && x.r.height > 0 && x.r.height < 36)
        .map(x => (x.el.id || x.el.className || x.el.tagName) + ":" + Math.round(x.r.height))`);
      if (smallTargets.length) throw new Error(`${name}: touch targets < 36px: ${smallTargets.join(", ")}`);
      const shot = await c.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      fs.writeFileSync(path.join(OUT, `${name}-390.png`), Buffer.from(shot.data, "base64"));
      console.log("shot", `${name}-390.png`);
      if (name === "landing-en") await ev("localStorage.setItem('vibe-lang', 'zh')");
    }
    c.close();
  } finally {
    edge.kill();
    await new Promise((r) => { edge.once("exit", r); setTimeout(r, 1200); });
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {}
  }
  if (UPDATE) {
    fs.mkdirSync(BASE, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png")) fs.copyFileSync(path.join(OUT, f), path.join(BASE, f));
    console.log("MOBILE BASELINES UPDATED");
    return;
  }
  const py = spawnSync("python", ["scripts/compare_png.py", BASE, OUT, "0.03"], { cwd: ROOT, stdio: "inherit" });
  if (py.error) { console.error("python not found; cannot compare mobile baselines"); process.exit(1); }
  if (py.status !== 0) process.exit(1);
  console.log("MOBILE VISUAL OK");
}
main().catch((e) => { console.error("MOBILE VISUAL FAIL:", e.message); process.exit(1); });
