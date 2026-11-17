/* DOM smoke test via Edge CDP (works while a normal Edge window is open). */
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
  console.error("SMOKE SKIP: Edge not found");
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
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
        res.end("nf");
        return;
      }
      res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
const httpUrl = (base, p) => base + "/" + p.replace(/\\/g, "/");

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  return {
    open: new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    }),
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    close: () => ws.close(),
  };
}

async function waitFor(fn, timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await fn()) return true;
    } catch {}
    await sleep(150);
  }
  throw new Error("timeout");
}

async function main() {
  const modelDir = path.join(ROOT, "simulink", "models");
  const nModels = fs.existsSync(modelDir) ? fs.readdirSync(modelDir).filter((f) => f.endsWith(".slx")).length : 0;
  if (nModels !== 43) throw new Error(`simulink: expected 43 vendored models, got ${nModels}`);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const port = 9336;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-smoke-"));
  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  try {
    await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok, 20000);

    async function check(name, url, fn) {
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
      const client = cdp(target.webSocketDebuggerUrl);
      await client.open;
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: 'try { localStorage.setItem("vibe-lang", "zh"); } catch (e) {}',
      });
      await client.send("Page.navigate", { url });
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

    await check("imu", httpUrl(base, "imu-lab/static/index.html"), async (e) => {
      await waitFor(() => e("!!document.querySelector('#chart-time svg')"));
      if (!(await e("document.querySelector('#fit-info').textContent")).includes("ARW="))
        throw new Error("imu: fit missing");
      if (!(await e("document.body.textContent")).includes("仅作演示")) throw new Error("imu: disclosure missing");
      if (!(await e("!!document.querySelector('#load-real')"))) throw new Error("imu: sample button missing");
      if (!(await e("!!document.querySelector('#export-report')"))) throw new Error("imu: report missing");
      if ((await e("document.querySelectorAll('#manual .manual-card').length")) !== 10)
        throw new Error("imu: manual chapters");
      await e("document.querySelector('[data-tab=\"manual\"]').click()");
      await waitFor(async () => (await e("document.getElementById('manual').hidden")) === false);
      await e("document.querySelector('[data-tab=\"lab\"]').click()");
      await waitFor(async () => (await e("document.getElementById('manual').hidden")) === true);
      if ((await e("document.querySelectorAll('[tabindex=\"0\"]').length")) < 1)
        throw new Error("imu: no keyboard focus");
    });

    await check("control", httpUrl(base, "control-play/index.html") + "?kp=3&ki=1&kd=0.1", async (e) => {
      await waitFor(() => e("!!document.querySelector('#bode svg')"));
      if (!/Kp=3\.00/.test(await e("document.querySelector('#meta-step').textContent")))
        throw new Error("control: PID URL");
      if (!(await e("!!document.querySelector('#step svg')"))) throw new Error("control: step chart");
      if ((await e("document.querySelectorAll('#manual .manual-card').length")) !== 14)
        throw new Error("control: manual chapters");
      if ((await e("document.querySelectorAll('#labs .lab-module').length")) !== 4)
        throw new Error("control: extra labs");
      await e("document.querySelector('[data-tab=\"labs\"]').click()");
      await waitFor(async () => (await e("document.getElementById('labs').hidden")) === false);
      await e("document.querySelector('[data-tab=\"manual\"]').click()");
      await waitFor(async () => (await e("document.getElementById('manual').hidden")) === false);
      await e("document.querySelector('[data-tab=\"lab\"]').click()");
      await waitFor(async () => (await e("document.getElementById('manual').hidden")) === true);
      if (!(await e("!!document.querySelector('#lab-sf-a svg')"))) throw new Error("control: state feedback lab chart");
      if ((await e("document.querySelectorAll('#lab-rl-a svg circle').length")) < 3)
        throw new Error("control: root locus pole markers");
      const setK = async (v) => {
        await e(
          `(() => { const i = document.querySelector('#lab-rl input[type=range]'); i.value = '${v}'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`
        );
        await waitFor(async () => (await e("document.querySelector('#lab-rl .lab-metrics').textContent")).length > 0);
      };
      await setK(50);
      await waitFor(async () =>
        (await e("document.querySelector('#lab-rl .lab-metrics').textContent")).includes("不稳定")
      );
      const cy50 = await e(
        "[...document.querySelectorAll('#lab-rl-a svg circle')].map(c=>c.getAttribute('cy')).join(',')"
      );
      await setK(1);
      await waitFor(
        async () => !(await e("document.querySelector('#lab-rl .lab-metrics').textContent")).includes("不稳定")
      );
      const cy1 = await e(
        "[...document.querySelectorAll('#lab-rl-a svg circle')].map(c=>c.getAttribute('cy')).join(',')"
      );
      if (cy1 === cy50) throw new Error("control: root locus poles did not move with K");
    });

    await check("control-state", httpUrl(base, "control-play/index.html") + "#labs&K=50", async (e) => {
      await waitFor(async () => (await e("document.getElementById('labs').hidden")) === false);
      await waitFor(async () =>
        (await e("document.querySelector('#lab-rl .lab-metrics').textContent")).includes("不稳定")
      );
      if ((await e("document.querySelectorAll('#lab-rl-a svg circle').length")) < 3)
        throw new Error("control-state: poles missing");
    });

    await check("landing", httpUrl(base, "landing/index.html"), async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('.card').length")) === 3);
      if ((await e("document.querySelectorAll('.paths-grid a').length")) !== 3)
        throw new Error("landing: path chooser");
      if ((await e("document.querySelectorAll('.topnav a').length")) !== 6) throw new Error("landing: global nav");
      if (!(await e("document.title")).includes("vibe-lab")) throw new Error("landing: title");
    });

    await check("landing-en", httpUrl(base, "landing/en/index.html"), async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('.card').length")) === 3);
      if ((await e("document.documentElement.lang")) !== "en") throw new Error("landing-en: lang");
      if ((await e("document.querySelectorAll('.topnav a').length")) !== 6) throw new Error("landing-en: global nav");
      if ((await e("document.querySelectorAll('.paths-grid a').length")) !== 3)
        throw new Error("landing-en: path chooser");
      if (!(await e("document.title")).includes("sensors")) throw new Error("landing-en: title");
      const zh = await e("document.querySelector('.topnav a[hreflang=\"zh-CN\"]').getAttribute('href')");
      if (!/index\.html$/.test(zh)) throw new Error("landing-en: language switch");
    });

    await check("about", httpUrl(base, "about/index.html"), async (e) => {
      if (!(await e("document.body.textContent")).includes("方法说明")) throw new Error("about: content");
    });

    await check("about-matlab", httpUrl(base, "about/matlab.html"), async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('#matlab-rows tr').length")) === 43);
      if (!(await e("document.body.textContent")).includes("43 / 43")) throw new Error("about-matlab: header");
      if ((await e("document.querySelector('#matlab-count').textContent")).trim() !== "43 / 43")
        throw new Error("about-matlab: count");
      await e(
        "(() => { const q = document.querySelector('#matlab-search'); q.value = 't31'; q.dispatchEvent(new Event('input', { bubbles: true })); })()"
      );
      await waitFor(async () => (await e("document.querySelector('#matlab-count').textContent")).trim() === "1 / 43");
      if (!(await e("document.querySelector('#matlab-rows tr:not([hidden])').textContent")).includes("t31"))
        throw new Error("about-matlab: filter");
    });

    await check("about-en", httpUrl(base, "about/en.html"), async (e) => {
      if ((await e("document.documentElement.lang")) !== "en") throw new Error("about-en: lang");
      if (!(await e("document.body.textContent")).includes("Methods & limitations"))
        throw new Error("about-en: content");
      if (!(await e("document.body.textContent")).includes("43/43")) throw new Error("about-en: matlab");
    });

    await check("simulink", httpUrl(base, "simulink/index.html"), async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('#phases .phase-link').length")) === 8, 15000);
      await waitFor(() => e("!!document.querySelector('#chart-a svg')"));
      if ((await e("document.querySelectorAll('#tabs button').length")) !== 29) throw new Error("simulink: demo tabs");
      await e("document.querySelector('#tabs button[data-demo=\"smc\"]').click()");
      await waitFor(async () => (await e("document.querySelector('#metrics').textContent")).includes("抖振"));
    });

    await check("course", httpUrl(base, "simulink/course.html") + "#t03", async (e) => {
      await waitFor(async () => (await e("document.querySelectorAll('#lesson-list .lesson').length")) === 43);
      if (!(await e("document.querySelector('#lesson-title').textContent")).includes("t03"))
        throw new Error("course: lesson title");
      if ((await e("document.querySelectorAll('#lesson-nav button').length")) < 1)
        throw new Error("course: prev/next missing");
      const dl = await e(
        "(() => { const a = document.querySelector('#lesson-body a[download]'); return a ? a.getAttribute('href') : ''; })()"
      );
      if (!/\.slx$/.test(dl)) throw new Error("course: .slx download link missing");
      if (!(await e("!!document.querySelector('#lesson-body .guide')")))
        throw new Error("course: beginner guide missing");
      if ((await e("document.querySelectorAll('#lesson-body .guide-card').length")) < 3)
        throw new Error("course: guide concepts missing");
      try {
        await waitFor(async () => (await e("document.querySelectorAll('#lesson-body .reader-sec').length")) > 0, 10000);
        console.log("   course content loaded (jsDelivr)");
      } catch {
        console.log("   course content offline (GitHub link fallback)");
      }
    });

    await check("course-example", httpUrl(base, "simulink/course.html") + "#t19", async (e) => {
      await waitFor(async () => (await e("document.querySelector('#lesson-title').textContent")).includes("t19"));
      if (!(await e("document.body.textContent")).includes("小例子"))
        throw new Error("course: concept example missing");
      if (!(await e("document.body.textContent")).includes("完整算例")) throw new Error("course: full case missing");
    });

    console.log("SMOKE OK (landing + landing-en + imu + control + about + matlab + about-en + simulink)");
  } finally {
    if (server) server.close();
    edge.kill();
    await new Promise((r) => {
      edge.once("exit", r);
      setTimeout(r, 1500);
    });
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {}
  }
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e.message);
  process.exit(1);
});
