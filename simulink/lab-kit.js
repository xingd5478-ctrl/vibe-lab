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

  function slider(label, min, max, step, value, onChange, opts) {
    opts = opts || {};
    const wrap = document.createElement("div");
    wrap.className = "lab-ctl";
    const head = document.createElement("div");
    head.className = "lab-ctl-head";
    const name = document.createElement("span");
    name.textContent = label;
    const val = document.createElement("b");
    val.textContent = String(value);
    if (opts.valueId) val.id = opts.valueId;
    head.appendChild(name);
    head.appendChild(val);
    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    if (opts.id) input.id = opts.id;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => {
      val.textContent = input.value;
      onChange(parseFloat(input.value));
    });
    wrap.appendChild(head);
    wrap.appendChild(input);
    return wrap;
  }

  function toggle(label, checked, onChange, opts) {
    opts = opts || {};
    const lab = document.createElement("label");
    lab.className = "lab-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    if (opts.id) input.id = opts.id;
    input.addEventListener("change", () => onChange(input.checked));
    lab.appendChild(input);
    lab.appendChild(document.createTextNode(" " + label));
    return lab;
  }

  root.LabKit = { metrics, toPts, slider, toggle };
})(typeof window !== "undefined" ? window : globalThis);
