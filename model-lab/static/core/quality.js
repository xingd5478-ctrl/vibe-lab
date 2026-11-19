/* Model Lab data quality report. Pure function, no DOM. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"));
  else root.ModelQuality = factory(root.ModelData);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";

  function result(checks) {
    const blockers = checks.filter((c) => c.level === "fail");
    const warnings = checks.filter((c) => c.level === "warn");
    let grade = "A";
    if (blockers.length) grade = "F";
    else if (warnings.length >= 3) grade = "C";
    else if (warnings.length >= 1) grade = "B";
    return { grade, blockers, warnings, checks };
  }

  function analyze(input) {
    const checks = [];
    const t = input.t || [];
    const u = input.u || [];
    const y = input.y || [];
    const n = Math.min(t.length, u.length, y.length);
    const lenOk = t.length === u.length && u.length === y.length && n >= 3;
    checks.push({
      id: "length",
      level: lenOk ? "ok" : "fail",
      message: lenOk ? `${n} rows` : "t/u/y lengths differ or fewer than 3 rows",
      fix: lenOk ? "" : "每列长度必须一致，至少 3 行数据。",
    });
    if (!lenOk) return result(checks);

    let finite = 0;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(t[i]) && Number.isFinite(u[i]) && Number.isFinite(y[i])) finite++;
    }
    const finiteOk = finite / n >= 0.95;
    checks.push({
      id: "finite",
      level: finiteOk ? "ok" : "fail",
      message: finiteOk ? `${Math.round((finite / n) * 100)}% finite` : "too many NaN/invalid rows",
      fix: finiteOk ? "" : "删除或补齐 NaN/空行后重试。",
    });

    let mono = true;
    let dup = 0;
    for (let i = 1; i < n; i++) {
      if (t[i] <= t[i - 1]) mono = false;
      if (t[i] === t[i - 1]) dup++;
    }
    checks.push({
      id: "time",
      level: mono ? (dup ? "warn" : "ok") : "fail",
      message: mono ? (dup ? `${dup} duplicate timestamps` : "time is strictly increasing") : "time is not increasing",
      fix: mono ? (dup ? "合并重复时间戳。" : "") : "按时间排序并删除重复/倒序行。",
    });

    const dt = [];
    for (let i = 1; i < n; i++) dt.push(t[i] - t[i - 1]);
    const dtMed = D.median(dt);
    const dtSpread = D.quantile(dt, 0.9) - D.quantile(dt, 0.1);
    const jitter = dtMed > 0 ? dtSpread / dtMed : 0;
    checks.push({
      id: "sampling",
      level: dtMed > 0 ? (jitter > 0.5 ? "warn" : "ok") : "fail",
      message:
        dtMed > 0 ? `median dt ${dtMed.toPrecision(3)} s, jitter ${Math.round(jitter * 100)}%` : "invalid time step",
      fix: dtMed > 0 ? (jitter > 0.5 ? "检查采样是否稳定；必要时重采样。" : "") : "时间列必须是单调数值。",
    });

    const up = D.quantile(u, 0.95);
    const lo = D.quantile(u, 0.05);
    const uRange = up - lo;
    const yRange = D.quantile(y, 0.95) - D.quantile(y, 0.05);
    const uActive = uRange > 1e-9;
    const yActive = yRange > 1e-9;
    checks.push({
      id: "excitation",
      level: uActive ? "ok" : "fail",
      message: uActive ? `input moves ${uRange.toPrecision(3)}` : "input is flat",
      fix: uActive ? "" : "增大阶跃/激励幅值，或检查执行器是否真的动了。",
    });
    checks.push({
      id: "response",
      level: yActive ? "ok" : "fail",
      message: yActive ? `output moves ${yRange.toPrecision(3)}` : "output has no measurable response",
      fix: yActive ? "" : "检查传感器、量程和输入是否作用到对象。",
    });

    const limits = input.meta || {};
    let sat = 0;
    if (Number.isFinite(limits.uMin) && Number.isFinite(limits.uMax) && limits.uMax > limits.uMin) {
      const tol = (limits.uMax - limits.uMin) * 1e-6;
      for (let i = 0; i < n; i++) {
        if (u[i] <= limits.uMin + tol || u[i] >= limits.uMax - tol) sat++;
      }
    }
    const satRatio = n ? sat / n : 0;
    checks.push({
      id: "saturation",
      level: satRatio > 0.2 ? "warn" : "ok",
      message: sat ? `${Math.round(satRatio * 100)}% at input limits` : "no declared input limits",
      fix: satRatio > 0.2 ? "降低激励幅值，避免执行器饱和后模型失真。" : "",
    });

    const uniqueY = new Set(y.map((v) => Number(v).toFixed(6))).size;
    checks.push({
      id: "resolution",
      level: uniqueY < 5 ? "warn" : "ok",
      message: `${uniqueY} distinct output values`,
      fix: uniqueY < 5 ? "输出分辨率太低；检查量化和传感器量程。" : "",
    });

    const dY = D.diff(y);
    const noise = D.median(dY.map((v) => Math.abs(v))) * 1.4826;
    const snr = noise > 0 ? yRange / noise : Infinity;
    checks.push({
      id: "noise",
      level: snr < 4 ? "warn" : "ok",
      message: Number.isFinite(snr) ? `rough SNR ${snr.toFixed(1)}` : "noise not estimable",
      fix: snr < 4 ? "增大信号幅值、降低噪声或多次平均。" : "",
    });

    if (limits.closedLoop) {
      checks.push({
        id: "loop",
        level: "warn",
        message: "closed-loop data declared",
        fix: "普通最小二乘在闭环下可能有偏；优先用开环实验。",
      });
    }

    return result(checks);
  }

  return { analyze };
});
