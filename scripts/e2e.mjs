/* End-to-end smoke via Edge DevTools Protocol (no puppeteer/playwright pipes). */
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
const AXE = fs.existsSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"))
  ? fs.readFileSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8")
  : null;
if (!EDGE) {
  console.log("E2E SKIP: Edge not found");
  process.exit(0);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv",
  ".png": "image/png",
  ".gz": "application/gzip",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function waitFor(fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await fn()) return true;
    } catch {}
    await sleep(150);
  }
  throw new Error("timeout waiting for condition");
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
  const open = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    open,
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

async function main() {
  const server = await serve();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-e2e-"));
  const download = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-dl-"));
  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--remote-debugging-port=9333",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    await waitFor(async () => (await fetch("http://127.0.0.1:9333/json/version")).ok, 20000);
    const pageUrl = `${base}/imu-lab/static/index.html`;
    const target = await (
      await fetch(`http://127.0.0.1:9333/json/new?${encodeURIComponent(pageUrl)}`, { method: "PUT" })
    ).json();
    const client = cdp(target.webSocketDebuggerUrl);
    await client.open;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: download });

    const evalJs = async (expression) => {
      const r = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };

    const audit = async (label, dark = false) => {
      if (!AXE) return;
      await client.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }],
      });
      await sleep(150);
      await evalJs(AXE);
      const res = await evalJs(
        'axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa"]}})' +
          ".then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.slice(0,3).map(n=>n.target)})))"
      );
      const bad = res.filter((v) => v.impact === "serious" || v.impact === "critical");
      const tag = dark ? `${label}-dark` : label;
      console.log("A11Y", tag, "violations:", res.length, "serious/critical:", bad.length);
      if (bad.length) throw new Error(`${tag} a11y: ${JSON.stringify(bad)}`);
    };

    await waitFor(() => evalJs("!!document.querySelector('#chart-time svg')"));
    await audit("imu");
    await audit("imu", true);

    await client.send("Page.navigate", { url: `${base}/imu-lab/static/index.html?lang=en` });
    await waitFor(() => evalJs("!!document.querySelector('#chart-time svg')"));
    if ((await evalJs("document.documentElement.lang")) !== "en") throw new Error("imu-en: lang");
    if (!(await evalJs("document.querySelector('h1').textContent")).includes("IMU data lab"))
      throw new Error("imu-en: h1");
    if (!(await evalJs("!!document.querySelector('.lang-banner')"))) throw new Error("imu-en: banner");
    if ((await evalJs("document.querySelector('.lang-switch').textContent")) !== "Chinese")
      throw new Error("imu-en: switch");
    if ((await evalJs("(document.body.innerText.match(/[\\u4e00-\\u9fff]/g) || []).length")) > 0)
      throw new Error("imu-en: Chinese text remains");
    await audit("imu-en");
    await audit("imu-en", true);
    await evalJs("localStorage.setItem('vibe-lang', 'zh')");
    const fit = await evalJs("document.querySelector('#fit-info').textContent");
    if (!/ARW=/.test(fit) || !/R²=/.test(fit)) throw new Error("fit info missing");
    const before = await evalJs("document.querySelector('#r-val').textContent");
    await evalJs("document.querySelector('#fit').click()");
    await sleep(350);
    const after = await evalJs("document.querySelector('#r-val').textContent");
    if (before === after) throw new Error("fit did not update R");

    await evalJs("document.querySelector('#export-report').click()");
    await waitFor(() => fs.readdirSync(download).some((f) => f.endsWith(".html")), 8000);
    const html = fs.readFileSync(
      path.join(
        download,
        fs.readdirSync(download).find((f) => f.endsWith(".html"))
      ),
      "utf8"
    );
    if (!html.includes("IMU 数据实验室")) throw new Error("report content missing");

    await client.send("Page.navigate", { url: `${base}/imu-lab/static/index.html?r=-7&q=-9&ch=gy` });
    await sleep(1200);
    if (!(await evalJs("document.querySelector('#r-val').textContent")).includes("1.00e-7"))
      throw new Error("URL R not restored");
    if ((await evalJs("document.querySelector('#channel').value")) !== "gy")
      throw new Error("URL channel not restored");

    await client.send("Page.navigate", { url: `${base}/control-play/index.html` });
    await waitFor(() => evalJs("!!document.querySelector('#bode svg')"));
    await evalJs(
      "(() => { const el = document.querySelector('#kp'); el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); })()"
    );
    await sleep(250);
    const meta = await evalJs("document.querySelector('#meta-step').textContent");
    if (!/Kp=3\.00/.test(meta)) throw new Error("PID slider not wired");
    await audit("control");
    await audit("control", true);

    await client.send("Page.navigate", { url: `${base}/control-play/index.html?lang=en` });
    await waitFor(() => evalJs("!!document.querySelector('#bode svg')"));
    await sleep(800);
    if ((await evalJs("document.querySelectorAll('.tabs-bar button').length")) !== 3)
      throw new Error("control-en: tabs");
    await evalJs("document.querySelector('.tabs-bar button[data-tab=\"labs\"]').click()");
    await sleep(300);
    if (!(await evalJs("document.querySelector('#labs').textContent")).includes("State feedback"))
      throw new Error("control-en: labs not English");
    if ((await evalJs("(document.body.innerText.match(/[\\u4e00-\\u9fff]/g) || []).length")) > 0)
      throw new Error("control-en: Chinese text remains");
    await evalJs("document.querySelector('.tabs-bar button[data-tab=\"manual\"]').click()");
    await sleep(300);
    if (!(await evalJs("document.querySelector('#manual-grid').textContent")).includes("First and second order"))
      throw new Error("control-en: manual not English");
    await audit("control-en");
    await evalJs("localStorage.setItem('vibe-lang', 'zh')");

    await client.send("Page.navigate", { url: `${base}/landing/index.html` });
    await sleep(1000);
    await audit("landing");
    await audit("landing", true);

    await client.send("Page.navigate", { url: `${base}/landing/en/index.html` });
    await sleep(700);
    if ((await evalJs("document.documentElement.lang")) !== "en") throw new Error("landing-en: lang");
    if ((await evalJs("document.querySelectorAll('.topnav a').length")) !== 6)
      throw new Error("landing-en: global nav");
    if ((await evalJs("document.querySelectorAll('.card').length")) !== 3) throw new Error("landing-en: cards");
    if (!(await evalJs("document.title")).includes("sensors")) throw new Error("landing-en: title");
    if ((await evalJs("(document.body.innerText.match(/[\\u4e00-\\u9fff]/g) || []).length")) > 0)
      throw new Error("English text check failed");
    await audit("landing-en");
    await audit("landing-en", true);

    await client.send("Page.navigate", { url: `${base}/about/index.html` });
    await sleep(800);
    await audit("about");
    await audit("about", true);

    await client.send("Page.navigate", { url: `${base}/about/matlab.html` });
    await waitFor(async () => (await evalJs("document.querySelectorAll('#matlab-rows tr').length")) === 43, 12000);
    if ((await evalJs("document.querySelector('#matlab-count').textContent")).trim() !== "43 / 43")
      throw new Error("matlab: count");
    await evalJs(
      "(() => { const q = document.querySelector('#matlab-search'); q.value = 't31'; q.dispatchEvent(new Event('input', { bubbles: true })); })()"
    );
    await waitFor(
      async () => (await evalJs("document.querySelector('#matlab-count').textContent")).trim() === "1 / 43"
    );
    await audit("matlab");
    await audit("matlab", true);

    await client.send("Page.navigate", { url: `${base}/about/en.html` });
    await sleep(400);
    if ((await evalJs("document.documentElement.lang")) !== "en") throw new Error("about-en: lang");
    if (!(await evalJs("document.body.textContent")).includes("Methods & limitations"))
      throw new Error("about-en: content");
    if ((await evalJs("(document.body.innerText.match(/[\\u4e00-\\u9fff]/g) || []).length")) > 0)
      throw new Error("English text check failed");
    await audit("about-en");
    await audit("about-en", true);
    await evalJs("localStorage.setItem('vibe-lang', 'zh')");

    await client.send("Page.navigate", { url: `${base}/simulink/index.html` });
    await waitFor(async () => (await evalJs("document.querySelectorAll('#phases .phase-link').length")) === 8, 12000);
    await waitFor(() => evalJs("!!document.querySelector('#chart-a svg')"));
    await evalJs("document.querySelector('#tabs button[data-demo=\"smc\"]').click()");
    await sleep(350);
    const simMeta = await evalJs("document.querySelector('#metrics').textContent");
    if (!/抖振/.test(simMeta)) throw new Error("simulink: SMC metrics missing");
    await audit("simulink");
    await audit("simulink", true);

    await client.send("Page.navigate", { url: `${base}/simulink/course.html?id=t03` });
    await sleep(900);
    if (!(await evalJs("document.querySelector('#lesson-title').textContent")).includes("t03"))
      throw new Error("course: title");
    if ((await evalJs("document.querySelectorAll('#lesson-list .lesson').length")) !== 43)
      throw new Error("course: lessons");
    if ((await evalJs("document.querySelectorAll('#lesson-body .guide-card').length")) < 3)
      throw new Error("course: guide");
    await evalJs("document.querySelector('#lesson-body a[download]').click()");
    await waitFor(() => fs.readdirSync(download).some((f) => f.endsWith(".slx")), 10000);
    const slx = path.join(
      download,
      fs.readdirSync(download).find((f) => f.endsWith(".slx"))
    );
    const head = fs.readFileSync(slx).subarray(0, 2);
    if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Error("course: downloaded .slx is not a zip");
    await audit("course");
    await audit("course", true);

    await client.send("Page.navigate", { url: `${base}/simulink/index.html?lang=en` });
    await waitFor(async () => (await evalJs("document.querySelectorAll('#phases .phase-link').length")) === 8, 12000);
    await waitFor(() => evalJs("!!document.querySelector('#chart-a svg')"));
    await sleep(350);
    if (!/Signals|Signal/.test(await evalJs("document.querySelector('#demo-title').textContent")))
      throw new Error("simulink-en: demo title");
    if (!(await evalJs("!!document.querySelector('.lang-banner')"))) throw new Error("simulink-en: banner");
    if ((await evalJs("(document.body.innerText.match(/[\\u4e00-\\u9fff]/g) || []).length")) > 0)
      throw new Error("English text check failed");
    await audit("simulink-en");
    await audit("simulink-en", true);

    client.close();
    console.log("E2E OK");
  } finally {
    edge.kill();
    await new Promise((resolve) => {
      edge.once("exit", resolve);
      setTimeout(resolve, 1500);
    });
    server.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch (e) {
      /* Edge may still hold crashpad files; ignore */
    }
    fs.rmSync(download, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
