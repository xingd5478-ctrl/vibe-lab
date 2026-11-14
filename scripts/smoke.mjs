/* DOM smoke test via Edge CDP (works while a normal Edge window is open). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => fs.existsSync(p));
if (!EDGE) { console.error("SMOKE SKIP: Edge not found"); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fileUrl = (p) => new URL("file:///" + path.resolve(ROOT, p).replace(/\\/g, "/")).href;

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
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

async function waitFor(fn, timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch {}
    await sleep(150);
  }
  throw new Error("timeout");
}

async function main() {
  const modelDir = path.join(ROOT, "simulink", "models");
  const nModels = fs.existsSync(modelDir) ? fs.readdirSync(modelDir).filter((f) => f.endsWith(".slx")).length : 0;
  if (nModels !== 43) throw new Error(`simulink: expected 43 vendored models, got ${nModels}`);
  const port = 9336;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-smoke-"));
  const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok, 20000);

    async function check(name, url, fn) {
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
      const client = cdp(target.webSocketDebuggerUrl);
      await client.open;
      await client.send("Runtime.enable");
      const evalJs = async (expr) => {
        const r = await client.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
        return r.result.value;
      };
      await waitFor(() => evalJs("document.readyState === 'complete'"));
      await fn(evalJs);
      client.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
      console.log("ok", name);
    }

    await check("imu", fileUrl("imu-lab/static/index.html"), async (e) => {
      await waitFor(() => e("!!document.querySelector('#chart-time svg')"));
      if (!(await e("document.querySelector('#fit-info').textContent")).includes("ARW=")) throw new Error("imu: fit missing");
      if (!(await e("document.body.textContent")).includes("仅作演示")) throw new Error("imu: disclosure missing");
      if (!(await e("!!document.querySelector('#load-real')"))) throw new Error("imu: sample button missing");
      if (!(await e("!!document.querySelector('#export-report')"))) throw new Error("imu: report missing");
      if ((await e("document.querySelectorAll('[tabindex=\"0\"]').length")) < 1) throw new Error("imu: no keyboard focus");
    });

    await check("control", fileUrl("control-play/index.html") + "?kp=3&ki=1&kd=0.1", async (e) => {
      await waitFor(() => e("!!document.querySelector('#bode svg')"));
      if (!/Kp=3\.00/.test(await e("document.querySelector('#meta-step').textContent"))) throw new Error("control: PID URL");
      if (!(await e("!!document.querySelector('#step svg')"))) throw new Error("control: step chart");
    });

    await check("landing", fileUrl("landing/index.html"), async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('.card').length")) === 3);
      if (!(await e("document.title")).includes("vibe-lab")) throw new Error("landing: title");
    });

    await check("about", fileUrl("about/index.html"), async (e) => {
      if (!(await e("document.body.textContent")).includes("方法说明")) throw new Error("about: content");
    });

    await check("simulink", fileUrl("simulink/index.html"), async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('#catalog .lesson').length")) === 43, 15000);
      await waitFor(() => e("!!document.querySelector('#chart-a svg')"));
      if ((await e("document.querySelectorAll('#tabs button').length")) !== 19) throw new Error("simulink: demo tabs");
      await e("document.querySelector('#tabs button[data-demo=\"smc\"]').click()");
      await waitFor(async () => (await e("document.querySelector('#metrics').textContent")).includes("抖振"));
    });

    await check("course", fileUrl("simulink/course.html") + "#t03", async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('#lesson-list .lesson').length")) === 43);
      if (!(await e("document.querySelector('#lesson-title').textContent")).includes("t03")) throw new Error("course: lesson title");
      if ((await e("document.querySelectorAll('#lesson-nav button').length")) < 1) throw new Error("course: prev/next missing");
      const dl = await e("(() => { const a = document.querySelector('#lesson-body a[download]'); return a ? a.getAttribute('href') : ''; })()");
      if (!/\.slx$/.test(dl)) throw new Error("course: .slx download link missing");
      if (!(await e("!!document.querySelector('#lesson-body .guide')"))) throw new Error("course: beginner guide missing");
      if ((await e("document.querySelectorAll('#lesson-body .guide-card').length")) < 3) throw new Error("course: guide concepts missing");
      try {
        await waitFor(async () => (await e("document.querySelectorAll('#lesson-body .reader-sec').length")) > 0, 10000);
        console.log("   course content loaded (jsDelivr)");
      } catch {
        console.log("   course content offline (GitHub link fallback)");
      }
    });

    console.log("SMOKE OK (landing + imu + control + about + simulink)");
  } finally {
    edge.kill();
    await new Promise((r) => { edge.once("exit", r); setTimeout(r, 1500); });
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {}
  }
}

main().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });
