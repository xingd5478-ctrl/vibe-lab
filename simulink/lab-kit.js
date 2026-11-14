/* 共享实验小工具：指标渲染、曲线点转换（Control 与 Simulink 共用） */
(function (root) {
  "use strict";

  function metrics(el, rows) {
    if (!el) return;
    el.innerHTML = rows.map(([k, v]) => `<span><i>${k}</i><b>${v}</b></span>`).join("");
  }

  function toPts(t, y) {
    const out = new Array(t.length);
    for (let i = 0; i < t.length; i++) out[i] = [t[i], y[i]];
    return out;
  }

  root.LabKit = { metrics, toPts };
})(typeof window !== "undefined" ? window : globalThis);
