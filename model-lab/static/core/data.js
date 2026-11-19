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
    const rawHeader = lines[0].split(delimiter).map((s) => s.trim());
    const header = rawHeader.map((s) => s.toLowerCase());
    const allNumeric = rawHeader.every((h) => h === "" || Number.isFinite(parseNumber(h)));
    const dataStart = allNumeric ? 0 : 1;
    const headers = allNumeric ? rawHeader.map((_, i) => `col${i + 1}`) : rawHeader;
    if (headers.length < 3) throw new Error("CSV needs columns t, u, y (or time, input, output).");
    const find = (...names) => headers.findIndex((h) => names.includes(String(h).toLowerCase()));
    const prefix = (p) => headers.findIndex((h, i) => new RegExp(`^${p}\\d*$`, "i").test(h) && i > 0);
    let ti = find("t", "time", "timestamp", "时间");
    let ui = find("u", "input", "mv", "输入");
    let yi = find("y", "output", "cv", "输出");
    if (ui < 0) ui = prefix("u");
    if (yi < 0) yi = prefix("y");
    if (ti < 0 || ui < 0 || yi < 0) {
      ti = 0;
      ui = 1;
      yi = 2;
    }
    const columns = headers.map(() => []);
    let rows = 0;
    for (let i = dataStart; i < lines.length; i++) {
      const cols = lines[i].split(delimiter);
      const vals = headers.map((_, j) => parseNumber(cols[j]));
      if (vals.every((v) => Number.isNaN(v))) continue;
      vals.forEach((v, j) => columns[j].push(v));
      rows++;
    }
    if (rows < 3) throw new Error("CSV needs at least 3 numeric rows.");
    return {
      t: columns[ti],
      u: columns[ui],
      y: columns[yi],
      meta: {
        delimiter,
        rows,
        extraColumns: Math.max(0, headers.length - 3),
        headers,
        columns,
        timeIndex: ti,
        inputIndex: ui,
        outputIndex: yi,
      },
    };
  }

  function selectColumns(parsed, timeIndex, inputIndices, outputIndices) {
    const cols = parsed.meta && parsed.meta.columns;
    if (!cols) throw new Error("CSV columns are not available.");
    const ti = Number(timeIndex);
    const ins = inputIndices.map(Number).filter((i) => Number.isInteger(i) && cols[i]);
    const outs = outputIndices.map(Number).filter((i) => Number.isInteger(i) && cols[i]);
    if (!Number.isInteger(ti) || !cols[ti]) throw new Error("Select a time column.");
    if (!ins.length) throw new Error("Select at least one input column.");
    if (!outs.length) throw new Error("Select at least one output column.");
    if (ins.includes(ti) || outs.includes(ti)) throw new Error("Time column cannot also be an input/output.");
    const t = cols[ti].slice();
    const U = ins.map((i) => cols[i].slice());
    const Y = outs.map((i) => cols[i].slice());
    if (t.length !== U[0].length || t.length !== Y[0].length) throw new Error("Column lengths do not match.");
    return {
      t,
      u: U[0],
      y: Y[0],
      U,
      Y,
      meta: {
        ...(parsed.meta || {}),
        columns: cols,
        headers: parsed.meta.headers,
        selected: { time: ti, inputs: ins, outputs: outs },
        extraColumns: 0,
      },
    };
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
    selectColumns,
    median,
    mean,
    quantile,
    diff,
    stepIndex,
    trimStep,
  };
});
