/* Runtime performance budget: navigation, long tasks and interaction latency.
   Complements scripts/budget.mjs (static JS/CSS bytes). Uses Edge CDP; skips if Edge is absent. */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => fs.existsSync(p));
if (!EDGE) {
  console.log("PERF SKIP: Edge not found");
  process.exit(0);
}

const SCALE = Math.max(0.1, Number(process.env.PERF_SCALE || 1));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Budgets in ms at scale 1; CI sets PERF_SCALE=2 for slower runners. */
const BUDGETS = {
  landing: { ready: 1800, longTask: 250, longTotal: 400, lcp: 1800, cls: 0.05 },
  "landing-en": { ready: 1100, longTask: 250, longTotal: 400, lcp: 1500, cls: 0.05 },
  imu: { ready: 1500, longTask: 300, longTotal: 600, fit: 400, channel: 400, q: 400, lcp: 1800, cls: 0.08 },
  control: { ready: 900, longTask: 250, longTotal: 400, kp: 250, tab: 600, lcp: 1500, cls: 0.08 },
  simulink: { ready: 1100, longTask: 250, longTotal: 400, tab: 500, lcp: 1600, cls: 0.1 },
  about: { ready: 600, longTask: 250, longTotal: 400, lcp: 1000, cls: 0.03 },
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
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
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  return {
    open: new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    }),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}

async function waitFor(fn, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await fn()) return true;
    } catch {}
    await sleep(100);
  }
  throw new Error("timeout waiting for page condition");
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-perf-"));
  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--disable-features=ServiceWorker",
      "--remote-debugging-port=9337",
      `--user-data-dir=${profile}`,
      "--window-size=1400,1000",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const results = [];
  const failures = [];
  try {
    await waitFor(async () => (await fetch("http://127.0.0.1:9337/json/version")).ok, 20000);
    const target = await (await fetch("http://127.0.0.1:9337/json/new?about:blank", { method: "PUT" })).json();
    const client = cdp(target.webSocketDebuggerUrl);
    await client.open;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Performance.enable");
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__lt = [];
        window.__lcp = 0;
        window.__cls = 0;
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) window.__lt.push(Math.round(e.duration));
          }).observe({ entryTypes: ["longtask"] });
          new PerformanceObserver((list) => {
            const es = list.getEntries();
            window.__lcp = Math.round(es[es.length - 1].startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        } catch (e) {}
      `,
    });

    const evalJs = async (expression) => {
      const r = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };

    async function nav(url) {
      await client.send("Page.navigate", { url });
      await waitFor(() => evalJs("document.readyState === 'complete'"), 25000);
    }

    async function baseMetrics() {
      return evalJs(`(() => {
        const n = performance.getEntriesByType("navigation")[0];
        const fcp = performance.getEntriesByType("paint").find(p => p.name === "first-contentful-paint");
        const lt = window.__lt || [];
        return {
          now: Math.round(performance.now()),
          dcl: Math.round(n.domContentLoadedEventEnd),
          load: Math.round(n.loadEventEnd),
          fcp: fcp ? Math.round(fcp.startTime) : null,
          lcp: Math.round(window.__lcp || (fcp ? fcp.startTime : 0) || n.domContentLoadedEventEnd),
          cls: +(window.__cls || 0).toFixed(4),
          longTask: lt.length ? Math.max(...lt) : 0,
          longTotal: lt.reduce((a, b) => a + b, 0),
          longCount: lt.length,
        };
      })()`);
    }

    async function interact(action, condition, label) {
      await evalJs("window.__perfStart = performance.now()");
      if (action) await evalJs(action);
      if (condition) await waitFor(() => evalJs(condition));
      await evalJs("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
      return { label, ms: Math.round(await evalJs("performance.now() - window.__perfStart")) };
    }

    async function measurePage(name, file, readySelector) {
      console.log(`  measuring ${name}…`);
      await nav(`${base}/${file}`);
      if (readySelector) await waitFor(() => evalJs(readySelector), 25000);
      const m = await baseMetrics();
      const b = BUDGETS[name];
      const ready = Math.max(m.load, m.dcl, readySelector ? m.now : 0);
      const row = {
        page: name,
        ready,
        dcl: m.dcl,
        load: m.load,
        fcp: m.fcp,
        lcp: m.lcp,
        cls: m.cls,
        longTask: m.longTask,
        longTotal: m.longTotal,
      };
      if (ready > b.ready * SCALE) failures.push(`${name}: ready ${ready}ms > ${Math.round(b.ready * SCALE)}ms`);
      if (m.lcp > b.lcp * SCALE) failures.push(`${name}: LCP ${m.lcp}ms > ${Math.round(b.lcp * SCALE)}ms`);
      if (m.cls > b.cls * SCALE) failures.push(`${name}: CLS ${m.cls} > ${+(b.cls * SCALE).toFixed(3)}`);
      if (m.longTask > b.longTask * SCALE)
        failures.push(`${name}: long task ${m.longTask}ms > ${Math.round(b.longTask * SCALE)}ms`);
      if (m.longTotal > b.longTotal * SCALE)
        failures.push(`${name}: long tasks total ${m.longTotal}ms > ${Math.round(b.longTotal * SCALE)}ms`);
      results.push(row);
      return row;
    }

    await measurePage("landing", "landing/index.html", null);
    await measurePage("landing-en", "landing/en/index.html", null);
    await evalJs("localStorage.setItem('vibe-lang', 'zh')");

    const imu = await measurePage("imu", "imu-lab/static/index.html", "!!document.querySelector('#chart-time svg')");
    imu.interactions = [];
    imu.interactions.push(
      await interact(
        "document.querySelector('#fit').click()",
        "document.querySelector('#r-val').textContent.includes('e-')",
        "fit"
      )
    );
    imu.interactions.push(
      await interact(
        "(() => { const s = document.querySelector('#channel'); s.value = 'gz'; s.dispatchEvent(new Event('change', { bubbles: true })); })()",
        "document.querySelector('#chart-kf svg')",
        "channel"
      )
    );
    imu.interactions.push(
      await interact(
        "(() => { const i = document.querySelector('#logQ'); i.value = '-7'; i.dispatchEvent(new Event('input', { bubbles: true })); })()",
        "document.querySelector('#q-val').textContent.includes('e-')",
        "q-slider"
      )
    );
    imu.interactions.forEach((i) => {
      if (i.ms > BUDGETS.imu[i.label === "q-slider" ? "q" : i.label] * SCALE) {
        failures.push(
          `imu ${i.label}: ${i.ms}ms > ${Math.round(BUDGETS.imu[i.label === "q-slider" ? "q" : i.label] * SCALE)}ms`
        );
      }
    });

    const control = await measurePage("control", "control-play/index.html", "!!document.querySelector('#bode svg')");
    control.interactions = [];
    control.interactions.push(
      await interact(
        "(() => { const i = document.querySelector('#kp'); i.value = '5'; i.dispatchEvent(new Event('input', { bubbles: true })); })()",
        "document.querySelector('#meta-step').textContent.includes('Kp=5')",
        "kp-slider"
      )
    );
    control.interactions.push(
      await interact(
        "document.querySelector('[data-tab=\"labs\"]').click()",
        "document.getElementById('labs').hidden === false",
        "labs-tab"
      )
    );
    control.interactions.forEach((i) => {
      const key = i.label === "kp-slider" ? "kp" : "tab";
      if (i.ms > BUDGETS.control[key] * SCALE)
        failures.push(`control ${i.label}: ${i.ms}ms > ${Math.round(BUDGETS.control[key] * SCALE)}ms`);
    });

    const sim = await measurePage("simulink", "simulink/index.html", "!!document.querySelector('#chart-a svg')");
    sim.interactions = [];
    sim.interactions.push(
      await interact(
        "document.querySelector('#tabs button[data-demo=\"smc\"]').click()",
        "document.querySelector('#metrics').textContent.includes('抖振')",
        "smc-tab"
      )
    );
    sim.interactions.forEach((i) => {
      if (i.ms > BUDGETS.simulink.tab * SCALE)
        failures.push(`simulink ${i.label}: ${i.ms}ms > ${Math.round(BUDGETS.simulink.tab * SCALE)}ms`);
    });

    await measurePage("about", "about/index.html", null);

    const pm = await client.send("Performance.getMetrics");
    const heap = Object.fromEntries(
      pm.metrics
        .filter((m) => ["JSHeapUsedSize", "Nodes", "Documents"].includes(m.name))
        .map((m) => [m.name, Math.round(m.value)])
    );

    console.log(`runtime perf budget (scale x${SCALE})`);
    console.log("page      ready   dcl    load   fcp     lcp     cls     long(max/total)");
    for (const r of results) {
      console.log(
        `${r.page.padEnd(9)} ${String(r.ready).padStart(5)}ms ${String(r.dcl).padStart(5)}ms ${String(r.load).padStart(5)}ms ${String(r.fcp ?? "-").padStart(5)}ms ${String(r.lcp).padStart(5)}ms ${String(r.cls).padStart(6)} ${String(r.longTask + "/" + r.longTotal).padStart(12)}`
      );
      for (const i of r.interactions || []) console.log(`  ${i.label.padEnd(12)} ${String(i.ms).padStart(5)}ms`);
    }
    console.log(
      `JS heap ${(heap.JSHeapUsedSize / 1048576).toFixed(1)}MB, ${heap.Nodes} nodes, ${heap.Documents} documents`
    );
    if (failures.length) {
      console.error("RUNTIME PERF FAIL:");
      failures.forEach((f) => console.error("  " + f));
      process.exitCode = 1;
    } else {
      console.log("RUNTIME PERF OK");
    }
    client.close();
  } finally {
    edge.kill();
    await new Promise((r) => {
      edge.once("exit", r);
      setTimeout(r, 1500);
    });
    server.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {}
  }
}

main().catch((e) => {
  console.error("RUNTIME PERF FAIL:", e.message);
  process.exit(1);
});
