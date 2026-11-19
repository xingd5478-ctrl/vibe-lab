/* Model Lab data utilities: CSV parsing, summaries, preprocessing.
   UMD: module.exports in Node, window.ModelData in the browser. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ModelData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function parseNumber(value) {
    if (value === null || value === undefined) return NaN;
    const s = String(value).trim().replace(",", ".");
    if (!s) return NaN;
    return Number(s);
  }

  function splitRows(text) {
    const lines = String(text)
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    if (!lines.length) return { rows: [], delimiter: "," };
    const candidates = [",", ";", "\t"];
    let delimiter = ",";
    let best = -1;
    for (const d of candidates) {
      const count = lines[0].split(d).length;
      if (count > best) {
        best = count;
        delimiter = d;
      }
    }
    return { lines, delimiter };
  }

  function parseCSV(text) {
    const { lines, delimiter } = splitRows(text);
    if (lines.length < 2) throw new Error("CSV needs a header and at least one data row.");
    const header = lines[0].split(delimiter).map((s) => s.trim().toLowerCase());
    const find = (...names) => header.findIndex((h) => names.includes(h));
    let ti = find("t", "time", "timestamp", "时间");
    let ui = find("u", "input", "mv", "输入");
    let yi = find("y", "output", "cv", "输出");
    let dataStart = 1;
    if (ti < 0 || ui < 0 || yi < 0) {
      if (header.length >= 3) {
        ti = 0;
        ui = 1;
        yi = 2;
        dataStart = 0;
      } else {
        throw new Error("CSV needs columns t, u, y (or time, input, output).");
      }
    }
    const t = [];
    const u = [];
    const y = [];
    for (let i = dataStart; i < lines.length; i++) {
      const cols = lines[i].split(delimiter);
      const tv = parseNumber(cols[ti]);
      const uv = parseNumber(cols[ui]);
      const yv = parseNumber(cols[yi]);
      if (Number.isNaN(tv) && Number.isNaN(uv) && Number.isNaN(yv)) continue;
      t.push(tv);
      u.push(uv);
      y.push(yv);
    }
    if (t.length < 3) throw new Error("CSV needs at least 3 numeric rows.");
    return { t, u, y, meta: { delimiter, rows: t.length } };
  }

  function median(values) {
    const a = values
      .filter((v) => Number.isFinite(v))
      .slice()
      .sort((x, y) => x - y);
    if (!a.length) return NaN;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function mean(values) {
    const a = values.filter((v) => Number.isFinite(v));
    if (!a.length) return NaN;
    return a.reduce((s, v) => s + v, 0) / a.length;
  }

  function quantile(values, q) {
    const a = values
      .filter((v) => Number.isFinite(v))
      .slice()
      .sort((x, y) => x - y);
    if (!a.length) return NaN;
    const pos = (a.length - 1) * Math.min(1, Math.max(0, q));
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return a[lo];
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  }

  function diff(values) {
    const out = [];
    for (let i = 1; i < values.length; i++) out.push(values[i] - values[i - 1]);
    return out;
  }

  function stepIndex(u) {
    if (!u || u.length < 2) return -1;
    let best = -1;
    let bestAbs = 0;
    for (let i = 1; i < u.length; i++) {
      const d = Math.abs(u[i] - u[i - 1]);
      if (d > bestAbs) {
        bestAbs = d;
        best = i;
      }
    }
    return bestAbs > 0 ? best : -1;
  }

  function trimStep(t, u, y) {
    const i = stepIndex(u);
    if (i < 1) return { t, u, y, step: -1 };
    const start = Math.max(0, i - Math.round((t.length - i) * 0.1));
    return {
      t: t.slice(start),
      u: u.slice(start),
      y: y.slice(start),
      step: i - start,
    };
  }

  return {
    parseCSV,
    median,
    mean,
    quantile,
    diff,
    stepIndex,
    trimStep,
  };
});
