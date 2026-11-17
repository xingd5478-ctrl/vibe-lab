const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function load(dsn) {
  const requests = [];
  const ctx = {
    window: { VIBE_SENTRY_DSN: dsn, addEventListener() {} },
    document: { documentElement: { lang: "en" } },
    location: { protocol: "https:", hostname: "example.com", pathname: "/simulink/index.html", search: "" },
    URL,
    crypto: { randomUUID: () => "00000000-0000-0000-0000-000000000000" },
    fetch: (url, opts) => {
      requests.push({ url, opts });
      return Promise.resolve({ ok: true });
    },
    console,
  };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "shared/observability.js"), "utf8"), ctx);
  return { ctx, requests };
}

test("valid DSN builds a Sentry store endpoint without a server secret", () => {
  const { ctx } = load("https://publickey@example.com/42");
  assert.equal(ctx.window.VibeSentry.parsed.endpoint, "https://example.com/api/42/store/");
  assert.equal(ctx.window.VibeSentry.parsed.key, "publickey");
});

test("capture posts a bounded error event to the DSN endpoint", async () => {
  const { ctx, requests } = load("https://publickey@example.com/42");
  const ev = ctx.window.VibeSentry._event("error", new Error("boom"));
  assert.equal(ev.exception.values[0].value, "boom");
  assert.equal(ev.tags.page, "/simulink/index.html");
  assert.equal(requests.length, 0);
  ctx.window.VibeSentry.capture("error", new Error("boom"));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/api/42/store/");
  assert.match(requests[0].opts.headers["X-Sentry-Auth"], /sentry_key=publickey/);
  const body = JSON.parse(requests[0].opts.body);
  assert.equal(body.exception.values[0].value, "boom");
});

test("empty or invalid DSNs stay dormant", () => {
  const empty = load("");
  assert.equal(empty.ctx.window.VibeSentry, undefined);
  const invalid = load("http://publickey@example.com/42");
  assert.equal(invalid.ctx.window.VibeSentry, undefined);
});
