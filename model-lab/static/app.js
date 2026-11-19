/* Model Lab UI: virtual experiment, CSV import, data health, FOPDT/SOPDT fit. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const tr = (s) => (window.VibeI18n ? window.VibeI18n.translate(s) : s);
  const isEn = () => document.documentElement.lang === "en";
  const T = (zh, en) => (isEn() ? en : zh);
  const FIX_EN = {
    length: "Each column must have the same length and at least 3 rows.",
    finite: "Remove or fill NaN/blank rows.",
    time: "Sort by time and remove duplicate/reversed rows.",
    sampling: "Check for a stable sample interval; resample if needed.",
    excitation: "Increase the step/excitation amplitude, or check the actuator.",
    response: "Check the sensor, range and whether the input reaches the plant.",
    saturation: "Reduce the excitation amplitude; saturation makes the model misleading.",
    resolution: "Output resolution is too low; check quantization and sensor range.",
    noise: "Increase the signal amplitude, reduce noise, or average repeated runs.",
    loop: "Least squares can be biased on closed-loop data; prefer an open-loop test.",
  };
  const FIX_ZH = {};
  const fixFor = (c) => (isEn() ? FIX_EN[c.id] || c.fix : c.fix);
  const D = window.ModelData;
  const Q = window.ModelQuality;
  const I = window.ModelIdentify;
  const P = window.ModelPlants;

  const state = {
    data: null,
    quality: null,
    fit: null,
    source: "virtual",
    fileName: "",
    split: 0.7,
  };

  const PLANT_IDS = P.list();
  const fmt = (v, digits = 3) => (Number.isFinite(v) ? Number(v).toFixed(digits) : "—");

  function controlPath() {
    return location.pathname.includes("/model-lab/") ? "../control-play/" : "../control/";
  }

  function initPlants() {
    const sel = $("plant");
    PLANT_IDS.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${isEn() ? p.nameEn : p.name} · ${isEn() ? p.unitInEn : p.unitIn} → ${isEn() ? p.unitOutEn : p.unitOut}`;
      sel.appendChild(o);
    });
    sel.value = "thermal";
    applyPlantDefaults();
    sel.addEventListener("change", applyPlantDefaults);
  }

  function applyPlantDefaults() {
    const p = PLANT_IDS.find((x) => x.id === $("plant").value) || PLANT_IDS[0];
    $("amp").value = p.defaultAmp;
    $("noise").value = p.defaultNoise;
    $("fs").value = p.defaultFs;
    $("duration").value = p.defaultDuration;
    $("file-name").textContent = "";
  }

  function generate() {
    const opts = {
      plant: $("plant").value,
      amp: Number($("amp").value),
      noise: Number($("noise").value),
      fs: Number($("fs").value),
      duration: Number($("duration").value),
      seed: 42,
    };
    try {
      const d = P.virtualStep(opts);
      state.source = "virtual";
      state.fileName = "";
      $("file-name").textContent = "";
      const p = PLANT_IDS.find((x) => x.id === opts.plant);
      setData(d, T(`${p ? p.name : opts.plant} 虚拟阶跃`, `${p ? p.nameEn : opts.plant} step`));
    } catch (e) {
      showError(e.message);
    }
  }

  function setData(d, label) {
    state.data = d;
    state.fit = null;
    $("metrics").innerHTML = "";
    $("warnings").innerHTML = "";
    $("actions").hidden = true;
    $("chart-caption").textContent = label || "实测输出";
    state.quality = Q.analyze(d);
    renderQuality();
    drawMainChart();
    drawResidual(null);
    if (!state.quality.blockers.length) fit();
    else {
      $("fit").disabled = true;
      $("fit-hint").textContent = "数据体检有硬性错误，先修复再拟合。";
    }
  }

  function renderQuality() {
    const q = state.quality;
    const grade = $("grade");
    grade.textContent = q.grade;
    grade.dataset.grade = q.grade;
    $("quality-title").textContent =
      q.grade === "F"
        ? T("这组数据还不能用来辨识", "This data is not ready for identification")
        : T("数据体检", "Data health");
    const wrap = $("quality");
    wrap.innerHTML = "";
    q.checks.forEach((c) => {
      const div = document.createElement("div");
      div.className = "q-item " + c.level;
      const b = document.createElement("b");
      b.textContent = c.level === "ok" ? "OK" : c.level === "warn" ? "!" : "X";
      div.appendChild(b);
      div.appendChild(document.createTextNode(c.message));
      if (c.fix && c.level !== "ok") {
        const fix = document.createElement("span");
        fix.className = "q-fix";
        fix.textContent = fixFor(c);
        div.appendChild(fix);
      }
      wrap.appendChild(div);
    });
    const blockers = q.blockers.length;
    $("fit").disabled = blockers > 0;
    $("fit-hint").textContent = blockers
      ? T("数据体检有硬性错误，先修复再拟合。", "Data health has hard errors; fix them before fitting.")
      : T(
          "数据体检通过；可以拟合，但仍要看残差和物理合理性。",
          "Data health passed; you can fit, but still check residuals and physical plausibility."
        );
    $("quality-title").textContent = blockers ? "这组数据还不能用来辨识" : "数据体检";
  }

  function fit() {
    if (!state.data || state.quality.blockers.length) return;
    const model = $("model").value;
    const split = Math.max(0, Math.min(1, Number($("split").value) || 0.7));
    state.split = split;
    const trainEnd = split < 1 ? Math.max(8, Math.floor(state.data.t.length * split)) : state.data.t.length;
    $("fit").disabled = true;
    $("fit-hint").textContent = T("正在拟合…", "Fitting…");
    try {
      const f =
        model === "ARX"
          ? I.fitARX(state.data.t, state.data.u, state.data.y, { trainEnd, na: 2, nb: 2, nk: 1 })
          : model === "SOPDT"
            ? I.fitSOPDT(state.data.t, state.data.u, state.data.y, { trainEnd })
            : I.fitFOPDT(state.data.t, state.data.u, state.data.y, { trainEnd });
      state.fit = f;
      drawMainChart();
      drawResidual(f);
      renderMetrics();
      renderWarnings();
      $("actions").hidden = false;
      $("fit-hint").textContent = T(
        "拟合完成。检查 FIT、残差和参数是否物理合理。",
        "Fit complete. Check FIT, residuals and physical plausibility."
      );
      const sc = $("send-control");
      if (f.model === "SOPDT") {
        sc.hidden = false;
        sc.href = `${controlPath()}?wn=${encodeURIComponent(f.wn.toFixed(3))}&zeta=${encodeURIComponent(f.zeta.toFixed(3))}`;
      } else sc.hidden = true;
    } catch (e) {
      state.fit = null;
      $("metrics").innerHTML = "";
      $("warnings").innerHTML = `<span class="bad">${T("拟合失败", "Fit failed")}：${e.message}</span>`;
      $("actions").hidden = true;
      $("fit-hint").textContent = T(
        "拟合失败；先检查数据是否有真实阶跃和足够长的响应。",
        "Fit failed; check for a real step and a long enough response."
      );
    } finally {
      $("fit").disabled = false;
    }
  }

  function renderMetrics() {
    const f = state.fit;
    const d = state.data;
    const box = $("metrics");
    box.innerHTML = "";
    const add = (label, value) => {
      const el = document.createElement("div");
      el.className = "metric";
      el.innerHTML = `<span>${label}</span><b>${value}</b>`;
      box.appendChild(el);
    };
    add(T("FIT 训练", "FIT train"), `${fmt(f.fitTrain != null ? f.fitTrain : f.fit, 1)} %`);
    if (f.fitVal != null) add(T("FIT 验证", "FIT validation"), `${fmt(f.fitVal, 1)} %`);
    if (f.model === "ARX") {
      add("ARX", `${f.na}/${f.nb}/${f.nk}`);
    } else {
      add(
        "K",
        `${fmt(f.K, 3)} ${(isEn() ? d.meta.units?.yEn : d.meta.units?.y) || ""}/${(isEn() ? d.meta.units?.uEn : d.meta.units?.u) || ""}`
      );
      if (f.model === "SOPDT") {
        add("ωn", `${fmt(f.wn, 3)} rad/s`);
        add("ζ", fmt(f.zeta, 3));
      } else {
        add("τ", `${fmt(f.tau, 2)} s`);
      }
      add("L", `${fmt(f.L, 2)} s`);
    }
    if (f.model !== "ARX") {
      const real = f.model === "SOPDT" ? -f.zeta * f.wn : -1 / f.tau;
      const pole =
        f.model === "SOPDT"
          ? `${fmt(real, 2)} ± j${fmt(f.wn * Math.sqrt(Math.max(0, 1 - f.zeta * f.zeta)), 2)}`
          : fmt(real, 2);
      add(T("极点", "Pole"), pole);
      add(T("稳定", "Stable"), real < 0 ? T("是", "yes") : T("否", "no"));
    }
    if (state.source === "virtual" && d.truth) {
      const t = d.truth;
      const truth =
        f.model === "SOPDT"
          ? `K=${fmt(t.K, 3)} · ωn=${fmt(t.wn, 3)} · ζ=${fmt(t.zeta, 3)}`
          : `K=${fmt(t.K, 3)} · τ=${fmt(t.tau, 2)} · L=${fmt(t.L, 2)}`;
      const el = document.createElement("p");
      el.className = "hint";
      el.textContent = `${T("虚拟对象真实值", "Virtual plant truth")}：${truth}${T("（仅用于教学对照）", " (teaching comparison only)")}`;
      box.appendChild(el);
    }
  }

  function renderWarnings() {
    const box = $("warnings");
    box.innerHTML = "";
    const f = state.fit;
    const q = state.quality;
    const lines = [];
    q.warnings.forEach((w) => lines.push(`${w.message}${fixFor(w) ? " — " + fixFor(w) : ""}`));
    if (f.fit < 70)
      lines.push(
        T(
          "FIT 偏低：模型可能不够好，或数据里还有未建模的动态/扰动。",
          "FIT is low: the model may be insufficient, or unmodeled dynamics/disturbances remain."
        )
      );
    if (f.model === "ARX" && new Set(state.data.u).size < 5)
      lines.push(
        T(
          "ARX 需要丰富输入（PRBS/多阶跃）；只有阶跃时，结果只能当参考。",
          "ARX needs rich input (PRBS/multi-step); with only a step, treat the result as a reference."
        )
      );
    if (f.model === "SOPDT" && f.zeta > 2.4)
      lines.push(
        T(
          "ζ 接近搜索上界：这组数据可能更像一阶，二阶的第二个时间常数不可辨识。",
          "ζ is near the search bound: the data may be closer to first order, so the second time constant is not identifiable."
        )
      );
    if (!lines.length)
      lines.push(
        T(
          "没有明显警告；仍要用独立数据验证，不能只看 FIT。",
          "No obvious warnings; still validate on independent data, not just FIT."
        )
      );
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      p.style.margin = "4px 0";
      box.appendChild(p);
    });
  }

  function drawMainChart() {
    const el = $("chart");
    if (!state.data) {
      el.innerHTML = '<p class="hint">先生成实验或上传 CSV。</p>';
      return;
    }
    const d = state.data;
    const f = state.fit;
    drawSvg(el, 800, 300, d, f);
  }

  function drawResidual(fit) {
    const el = $("residual");
    if (!fit || !state.data) {
      el.innerHTML = "";
      return;
    }
    const d = state.data;
    const res = d.y.map((v, i) => v - fit.yhat[i]);
    const min = Math.min(...res);
    const max = Math.max(...res);
    const span = max - min || 1;
    const pts = res.map((v, i) => {
      const x = 4 + (i / Math.max(1, res.length - 1)) * 392;
      const y = 22 - ((v - min) / span) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    el.innerHTML = `<svg viewBox="0 0 400 46" aria-label="残差曲线"><line x1="0" y1="22" x2="400" y2="22" style="stroke:var(--line);stroke-width:1"/><polyline points="${pts.join(" ")}" fill="none" style="stroke:var(--chart-2);stroke-width:1.2"/></svg><div class="hint" style="margin-top:2px">残差（实测 − 模型）</div>`;
  }

  function drawSvg(el, width, height, d, f) {
    const m = { l: 48, r: 12, t: 10, b: 24 };
    const inputH = 40;
    const plotH = height - m.t - m.b - inputH - 12;
    const w = width - m.l - m.r;
    const yMin = Math.min(...d.y);
    const yMax = Math.max(...d.y);
    const yPad = (yMax - yMin || 1) * 0.08;
    const sy = (v) => m.t + plotH - ((v - (yMin - yPad)) / (yMax - yMin + 2 * yPad || 1)) * plotH;
    const t0 = d.t[0];
    const t1 = d.t[d.t.length - 1];
    const sx = (t) => m.l + ((t - t0) / (t1 - t0 || 1)) * w;
    let shade = "";
    if (state.split < 1 && state.split > 0) {
      const xv = sx(t0 + (t1 - t0) * state.split);
      shade = `<rect x="${xv.toFixed(1)}" y="${m.t}" width="${(width - m.r - xv).toFixed(1)}" height="${plotH}" style="fill:var(--grid);opacity:.45"/><text x="${(xv + 4).toFixed(1)}" y="${(m.t + 10).toFixed(1)}" style="fill:var(--muted);font:9px var(--mono)">validation</text>`;
    }
    const yPath = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${sx(d.t[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
    const uMin = Math.min(...d.u);
    const uMax = Math.max(...d.u);
    const iy = height - m.b - inputH;
    const su = (v) => iy + inputH - ((v - uMin) / (uMax - uMin || 1)) * inputH;
    const uPath = d.u.map((v, i) => `${i ? "L" : "M"}${sx(d.t[i]).toFixed(1)},${su(v).toFixed(1)}`).join(" ");
    let grid = "";
    for (let i = 0; i <= 4; i++) {
      const val = yMin - yPad + ((yMax - yMin + 2 * yPad) * i) / 4;
      const y = sy(val);
      grid += `<line x1="${m.l}" y1="${y.toFixed(1)}" x2="${width - m.r}" y2="${y.toFixed(1)}" style="stroke:var(--grid);stroke-width:1"/>`;
      grid += `<text x="${m.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" style="fill:var(--muted);font:9px var(--mono)">${fmt(val, 1)}</text>`;
    }
    const xTicks = [0, 0.25, 0.5, 0.75, 1]
      .map((p) => {
        const tv = t0 + (t1 - t0) * p;
        return `<text x="${sx(tv).toFixed(1)}" y="${height - 6}" text-anchor="middle" style="fill:var(--muted);font:9px var(--mono)">${fmt(tv, 1)}</text>`;
      })
      .join("");
    el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${shade}
      ${grid}
      <path d="${yPath(d.y)}" fill="none" style="stroke:var(--chart-raw);stroke-width:1.1;opacity:.8"/>
      ${f ? `<path d="${yPath(f.yhat)}" fill="none" style="stroke:var(--chart-1);stroke-width:1.8"/>` : ""}
      <line x1="${m.l}" y1="${iy}" x2="${width - m.r}" y2="${iy}" style="stroke:var(--line);stroke-width:1"/>
      <path d="${uPath}" fill="none" style="stroke:var(--chart-3);stroke-width:1.2;opacity:.85"/>
      <text x="${m.l}" y="${iy - 5}" style="fill:var(--muted);font:9px var(--mono)">u(t)</text>
      ${xTicks}
      <text x="${m.l}" y="${m.t + 8}" style="fill:var(--muted);font:9px var(--mono)">y(t)</text>
    </svg>`;
  }

  function drawHero() {
    const d = P.virtualStep({ plant: "thermal", amp: 2, noise: 0, fs: 1, duration: 420, seed: 5 });
    const el = $("hero-chart");
    const width = 420,
      height = 150,
      m = { l: 8, r: 8, t: 8, b: 8 };
    const yMin = Math.min(...d.y),
      yMax = Math.max(...d.y);
    const t0 = d.t[0],
      t1 = d.t[d.t.length - 1];
    const points = d.y.map(
      (v, i) =>
        `${(m.l + (i / (d.y.length - 1)) * (width - m.l - m.r)).toFixed(1)},${(m.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (height - m.t - m.b)).toFixed(1)}`
    );
    el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><line x1="${m.l}" y1="${height - 8}" x2="${width - m.r}" y2="${height - 8}" style="stroke:var(--line)"/><polyline points="${points.join(" ")}" fill="none" style="stroke:var(--chart-1);stroke-width:2"/></svg>`;
  }

  function copyMatlab() {
    if (!state.fit) return;
    const text = I.toMatlab(state.fit);
    const done = () => {
      $("fit-hint").textContent = T("已复制 .m 代码。", "MATLAB .m copied.");
      setTimeout(
        () =>
          ($("fit-hint").textContent = T(
            "拟合完成。检查 FIT、残差和参数是否物理合理。",
            "Fit complete. Check FIT, residuals and physical plausibility."
          )),
        2200
      );
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard
        .writeText(text)
        .then(done)
        .catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      $("fit-hint").textContent = T("复制失败，请下载 .m。", "Copy failed; download the .m file.");
    }
    ta.remove();
  }

  function downloadMatlab() {
    if (!state.fit) return;
    const blob = new Blob([I.toMatlab(state.fit) + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `model-${state.fit.model.toLowerCase()}.m`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function showError(msg) {
    $("warnings").innerHTML = `<span class="bad">${msg}</span>`;
    $("fit-hint").textContent = T("先修复数据，再拟合。", "Fix the data before fitting.");
  }

  function initUpload() {
    $("csv").addEventListener("change", (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const d = D.parseCSV(String(reader.result));
          d.meta = { ...(d.meta || {}), units: { u: "", y: "" }, closedLoop: false, source: "csv" };
          state.source = "csv";
          state.fileName = file.name;
          $("file-name").textContent = `${T("已读取", "Loaded")}：${file.name} · ${d.t.length} ${T("行", "rows")}`;
          setData(d, `CSV：${file.name}`);
        } catch (e) {
          showError(`CSV 解析失败：${e.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  function init() {
    initPlants();
    drawHero();
    initUpload();
    $("generate").addEventListener("click", generate);
    $("fit").addEventListener("click", fit);
    $("split").addEventListener("change", () => {
      const v = Number($("split").value);
      $("split-hint").textContent =
        v < 1
          ? T(
              `前 ${Math.round(v * 100)}% 训练，后 ${Math.round((1 - v) * 100)}% 验证。`,
              `First ${Math.round(v * 100)}% train, last ${Math.round((1 - v) * 100)}% validation.`
            )
          : T("全部数据训练，没有独立验证。", "All data for training; no independent validation.");
    });
    $("copy-matlab").addEventListener("click", copyMatlab);
    $("download-matlab").addEventListener("click", downloadMatlab);
    generate();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
