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
if (!EDGE) {
  console.log("E2E SKIP: Edge not found");
  process.exit(0);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".csv": "text/csv", ".png": "image/png", ".gz": "application/gzip" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.statusCode = 403; res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.statusCode = 404; res.end("not found"); return; }
      res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function waitFor(fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await fn()) return true; } catch {}
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
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--no-first-run",
    "--remote-debugging-port=9333", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitFor(async () => (await fetch("http://127.0.0.1:9333/json/version")).ok, 20000);
    const pageUrl = `${base}/imu-lab/static/index.html`;
    const target = await (await fetch(`http://127.0.0.1:9333/json/new?${encodeURIComponent(pageUrl)}`, { method: "PUT" })).json();
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

    await waitFor(() => evalJs("!!document.querySelector('#chart-time svg')"));
    const fit = await evalJs("document.querySelector('#fit-info').textContent");
    if (!/ARW=/.test(fit) || !/R²=/.test(fit)) throw new Error("fit info missing");
    const before = await evalJs("document.querySelector('#r-val').textContent");
    await evalJs("document.querySelector('#fit').click()");
    await sleep(350);
    const after = await evalJs("document.querySelector('#r-val').textContent");
    if (before === after) throw new Error("fit did not update R");

    await evalJs("document.querySelector('#export-report').click()");
    await waitFor(() => fs.readdirSync(download).some((f) => f.endsWith(".html")), 8000);
    const html = fs.readFileSync(path.join(download, fs.readdirSync(download).find((f) => f.endsWith(".html"))), "utf8");
    if (!html.includes("IMU 数据实验室")) throw new Error("report content missing");

    await client.send("Page.navigate", { url: `${base}/imu-lab/static/index.html?r=-7&q=-9&ch=gy` });
    await sleep(1200);
    if (!(await evalJs("document.querySelector('#r-val').textContent")).includes("1.00e-7")) throw new Error("URL R not restored");
    if ((await evalJs("document.querySelector('#channel').value")) !== "gy") throw new Error("URL channel not restored");

    await client.send("Page.navigate", { url: `${base}/control-play/index.html` });
    await waitFor(() => evalJs("!!document.querySelector('#bode svg')"));
    await evalJs("(() => { const el = document.querySelector('#kp'); el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await sleep(250);
    const meta = await evalJs("document.querySelector('#meta-step').textContent");
    if (!/Kp=3\.00/.test(meta)) throw new Error("PID slider not wired");

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
    } catch (e) { /* Edge may still hold crashpad files; ignore */ }
    fs.rmSync(download, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error("E2E FAIL:", e.message); process.exit(1); });
