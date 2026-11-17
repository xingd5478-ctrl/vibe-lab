/* Minimal Sentry/GlitchTip client: no SDK, no cookies, no PII.
   Posts browser errors to the project's /api/<id>/store/ endpoint.
   DSN is public; configure shared/sentry-config.js. */
(function () {
  "use strict";

  var dsn = window.VIBE_SENTRY_DSN || "";
  var parsed = null;
  var sent = 0;
  var seen = {};
  var MAX_EVENTS = 5;

  function parseDSN(value) {
    try {
      var u = new URL(value);
      if (u.protocol !== "https:" || !u.username) return null;
      var parts = u.pathname.split("/").filter(Boolean);
      var project = parts[parts.length - 1];
      if (!project) return null;
      return {
        endpoint: u.origin + "/api/" + project + "/store/",
        key: u.username,
        host: u.host,
      };
    } catch (e) {
      return null;
    }
  }

  function eventId() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
    } catch (e) {}
    var out = "";
    for (var i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out;
  }

  function frames(stack) {
    if (!stack) return [];
    var lines = String(stack).split("\n");
    var out = [];
    for (var i = 0; i < lines.length && out.length < 20; i++) {
      var line = lines[i].trim();
      if (!line || line.indexOf("at ") !== 0) continue;
      var m = line.match(/^at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (!m) continue;
      out.push({
        function: m[1] || "?",
        filename: m[2],
        lineno: Number(m[3]),
        colno: Number(m[4]),
        in_app: true,
      });
    }
    return out;
  }

  function buildEvent(kind, err, extra) {
    var isError = err && typeof err === "object" && (err.name || err.message);
    var message = isError ? err.message || String(err) : String(err || "Unknown error");
    var type = isError ? err.name || "Error" : kind === "unhandledrejection" ? "UnhandledRejection" : "Error";
    var ev = {
      event_id: eventId(),
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      logger: "vibe-lab",
      environment: location.hostname || "local",
      release: "vibe-lab",
      transaction: location.pathname,
      tags: {
        page: location.pathname,
        lang: document.documentElement.lang || "",
        source: kind,
      },
      exception: {
        values: [
          {
            type: type,
            value: message.slice(0, 1000),
            stacktrace: { frames: frames(isError && err.stack) },
          },
        ],
      },
      extra: extra || {},
    };
    return ev;
  }

  function shouldSend(ev) {
    if (!parsed || sent >= MAX_EVENTS) return false;
    if (location.protocol !== "https:" && location.search.indexOf("sentry-test=1") < 0) return false;
    var key = ev.tags.page + "|" + ev.exception.values[0].value;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }

  function send(ev) {
    if (!shouldSend(ev)) return;
    sent++;
    try {
      fetch(parsed.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": "Sentry sentry_version=7, sentry_key=" + parsed.key + ", sentry_client=vibe-lab/1.0",
        },
        body: JSON.stringify(ev),
      }).catch(function () {});
    } catch (e) {}
  }

  function report(kind, err, extra) {
    if (!parsed) return;
    send(buildEvent(kind, err, extra));
  }

  parsed = parseDSN(dsn);
  if (!parsed) return;

  window.addEventListener("error", function (ev) {
    if (!ev) return;
    if (ev.error) report("error", ev.error);
    else
      report(
        "error",
        { name: "Error", message: ev.message || "Script error", stack: "" },
        { filename: ev.filename, lineno: ev.lineno, colno: ev.colno }
      );
  });
  window.addEventListener("unhandledrejection", function (ev) {
    report("unhandledrejection", ev && ev.reason ? ev.reason : "Unhandled rejection");
  });

  window.VibeSentry = {
    parsed: parsed,
    capture: report,
    _parse: parseDSN,
    _event: buildEvent,
  };
})();
