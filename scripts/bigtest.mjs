/* Large-file end-to-end: generates a 200k-row CSV, uploads via DataTransfer,
   verifies parse worker + allan worker + kf worker + canvas path. */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const BIG = path.join(ROOT, "temp_big.csv");
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => fs.existsSync(p));
if (!EDGE) { console.log("SKIP: Edge not found"); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".csv": "text/csv", ".png": "image/png" };

function genBig() {
  const n = 200000;
  const lines = ["t,gx_dps,gy_dps,gz_dps,crc_ok"];
  for (let i = 0; i < n; i++) {
    const x = Math.sin(i / 40) * 0.4, y = Math.cos(i / 55) * 0.4, z = Math.sin(i / 70) * 0.4;
    lines.push(`${(i / 100).toFixed(2)},${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)},1`);
  }
  for (const i of [123, 4567, 89012, 150000, 199999]) {
    lines[i + 1] = `${(i / 100).toFixed(2)},200,200,200,0`;
  }
  fs.writeFileSync(BIG, lines.join("\n"));
}

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
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  return {
    open: new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    close: () => ws.close(),
  };
}

async function waitFor(fn, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch {}
    await sleep(200);
  }
  throw new Error("timeout");
}

async function main() {
  genBig();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-big-"));
  const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run",
    "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    await waitFor(async () => (await fetch("http://127.0.0.1:9334/json/version")).ok, 20000);
    const target = await (await fetch(`http://127.0.0.1:9334/json/new?${encodeURIComponent(`${base}/imu-lab/static/index.html`)}`, { method: "PUT" })).json();
    const client = cdp(target.webSocketDebuggerUrl);
    await client.open;
    await client.send("Runtime.enable");
    const evalJs = async (expression) => {
      const r = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };

    await waitFor(() => evalJs("!!document.querySelector('#chart-time svg')"));
    await evalJs(`(async () => {
      const res = await fetch('/temp_big.csv');
      const text = await res.text();
      const dt = new DataTransfer();
      dt.items.add(new File([text], 'big.csv', { type: 'text/csv' }));
      const input = document.querySelector('#file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    await waitFor(() => evalJs("document.querySelector('#stat-frames').textContent").then((t) => t === "200,000"));
    await waitFor(() => evalJs("!!document.querySelector('#chart-time canvas')"));
    await waitFor(() => evalJs("!!document.querySelector('#chart-allan svg')"), 30000);
    await waitFor(() => evalJs("!!document.querySelector('#chart-kf svg')"));
    const fit = await evalJs("document.querySelector('#fit-info').textContent");
    if (!/ARW=/.test(fit)) throw new Error("fit missing: " + fit);
    const meta = await evalJs("document.querySelector('#meta-kf').textContent");
    if (/计算中/.test(meta)) throw new Error("kf still pending");
    const source = await evalJs("document.querySelector('#source-name').textContent");
    console.log("BIG E2E OK", "|", "frames=200000", "|", "kf meta:", meta, "|", "source:", source);
    client.close();
  } finally {
    edge.kill();
    await new Promise((r) => { edge.once("exit", r); setTimeout(r, 1500); });
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {}
    try { fs.rmSync(BIG, { force: true }); } catch {}
  }
}

main().catch((e) => { console.error("BIG E2E FAIL:", e.message); process.exit(1); });
