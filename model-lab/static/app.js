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
  const V = window.ModelValidation;
  const P = window.ModelPlants;

  const state = {
    data: null,
    quality: null,
    fit: null,
    source: "virtual",
    fileName: "",
    split: 0.7,
    uncertainty: null,
    history: [],
    fitWorker: null,
    fitSeq: 0,
    csvParsed: null,
    csvName: "",
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
      kp: Number($("loop-kp").value) || 1.2,
      ki: Number($("loop-ki").value) || 0.05,
      kd: Number($("loop-kd").value) || 0.01,
    };
    try {
      const ex = $("excitation").value;
      const d =
        opts.plant === "mimo"
          ? P.virtualMimo(opts)
          : ex === "chirp"
            ? P.virtualChirp(opts)
            : opts.plant === "tank"
              ? P.virtualTank(opts)
              : ex === "closed-loop"
                ? P.virtualClosedLoop(opts)
                : ex === "prbs"
                  ? P.virtualPRBS(opts)
                  : P.virtualStep(opts);
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
    if (state.source === "csv") d.meta.closedLoop = $("closed-loop").checked;
    else d.meta.closedLoop = false;
    state.data = d;
    state.fit = null;
    state.uncertainty = null;
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

  function computeFit(model, data, opts) {
    if (model === "FIR") return I.fitFIR(data.t, data.u, data.y, { trainEnd: opts.trainEnd, nh: 20 });
    if (model === "OE") return I.fitOE(data.t, data.u, data.y, opts);
    if (model === "ARMAX") return I.fitARMAX(data.t, data.u, data.y, opts);
    if (model === "Wiener") return I.fitWiener(data.t, data.u, data.y, opts);
    if (model === "Hammerstein") return I.fitHammerstein(data.t, data.u, data.y, opts);
    if (model === "2SLS-ARX") return I.fit2SLS(data.t, data.u, data.y, data.r, opts);
    if (model === "MIMO-ARX") return I.fitMIMOARX(data.t, data.U, data.Y, opts);
    if (model === "ETFE") return I.fitETFE(data.t, data.u, data.y, opts);
    if (model === "ARX") return I.fitARX(data.t, data.u, data.y, opts);
    if (model === "SOPDT") return I.fitSOPDT(data.t, data.u, data.y, opts);
    return I.fitFOPDT(data.t, data.u, data.y, opts);
  }

  function applyFit(f) {
    state.fit = f;
    state.uncertainty = null;
    if (f.model === "ETFE") state.split = 1;
    drawMainChart();
    drawResidual(f);
    renderMetrics();
    renderWarnings();
    renderValidation();
    recordComparison(f);
    $("actions").hidden = false;
    $("uncertainty").hidden = ["ETFE", "MIMO-ARX", "2SLS-ARX", "Hammerstein", "FIR", "OE", "ARMAX", "Wiener"].includes(
      f.model
    );
    $("fit-hint").textContent = T(
      "拟合完成。检查 FIT、残差和参数是否物理合理。",
      "Fit complete. Check FIT, residuals and physical plausibility."
    );
    const sc = $("send-control");
    if (f.model === "SOPDT") {
      sc.hidden = false;
      sc.href = `${controlPath()}?order=2&wn=${encodeURIComponent(f.wn.toFixed(3))}&zeta=${encodeURIComponent(f.zeta.toFixed(3))}`;
    } else if (f.model === "FOPDT") {
      sc.hidden = false;
      sc.href = `${controlPath()}?order=1&K=${encodeURIComponent(f.K.toFixed(3))}&tau=${encodeURIComponent(f.tau.toFixed(3))}`;
    } else sc.hidden = true;
    $("fit").disabled = false;
  }

  function fitFailed(message) {
    state.fit = null;
    $("metrics").innerHTML = "";
    $("warnings").innerHTML = `<span class="bad">${T("拟合失败", "Fit failed")}：${message}</span>`;
    $("actions").hidden = true;
    $("fit-hint").textContent = T(
      "拟合失败；先检查数据是否有真实阶跃和足够长的响应。",
      "Fit failed; check for a real step and a long enough response."
    );
    $("fit").disabled = false;
  }

  function fit() {
    if (!state.data || state.quality.blockers.length) return;
    const model = $("model").value;
    const split = Math.max(0, Math.min(1, Number($("split").value) || 0.7));
    state.split = split;
    const trainEnd = split < 1 ? Math.max(8, Math.floor(state.data.t.length * split)) : state.data.t.length;
    const opts = {
      trainEnd,
      na: Math.max(1, Math.min(6, Number($("arx-na").value) || 2)),
      nb: Math.max(1, Math.min(6, Number($("arx-nb").value) || 2)),
      nk: Math.max(0, Math.min(5, Number($("arx-nk").value) || 0)),
      nc: Math.max(1, Math.min(4, Number($("arx-nc").value) || 1)),
    };
    $("fit").disabled = true;
    $("fit-hint").textContent = T("正在拟合…", "Fitting…");
    const heavy = ["OE", "ARMAX", "MIMO-ARX", "Hammerstein"].includes(model);
    if (heavy && state.fitWorker) {
      state.fitSeq += 1;
      state.fitWorker.postMessage({ id: state.fitSeq, model, opts, data: state.data });
      return;
    }
    try {
      applyFit(computeFit(model, state.data, opts));
    } catch (e) {
      fitFailed(e.message);
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
    if (["FIR", "OE", "ARMAX", "Wiener"].includes(f.model)) {
      if (f.model === "FIR") add("nh", String(f.nh));
      else if (f.model === "ARMAX") add("ARMAX", `${f.na}/${f.nb}/${f.nc}/${f.nk}`);
      else if (f.model === "Wiener") add("c2", fmt(f.c2, 3));
      else add(f.model, `${f.na}/${f.nb}/${f.nk}`);
    } else if (f.model === "Hammerstein") {
      add("c2", fmt(f.c2, 3));
      add("ARX", `${f.na}/${f.nb}/${f.nk}`);
    } else if (f.model === "2SLS-ARX") {
      add("2SLS", `${f.na}/${f.nb}/${f.nk}`);
      if (f.fitDirect != null) add(T("直接 LS", "Direct LS"), `${fmt(f.fitDirect, 1)} %`);
    } else if (f.model === "MIMO-ARX") {
      add(T("FIT y1", "FIT y1"), `${fmt(f.fitOut[0], 1)} %`);
      add(T("FIT y2", "FIT y2"), `${fmt(f.fitOut[1], 1)} %`);
      add("ARX", `${f.na}/${f.nb}/${f.nk}`);
      add("MIMO", `${f.m}×${f.p}`);
    } else if (f.model === "ETFE") {
      add("coherence", fmt(f.medianCoherence, 2));
      add("segments", String(f.segments));
      add("bins", String(f.freq.length));
    } else if (f.model === "ARX") {
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
    if (f.model === "FOPDT" || f.model === "SOPDT") {
      const real = f.model === "SOPDT" ? -f.zeta * f.wn : -1 / f.tau;
      const pole =
        f.model === "SOPDT"
          ? `${fmt(real, 2)} ± j${fmt(f.wn * Math.sqrt(Math.max(0, 1 - f.zeta * f.zeta)), 2)}`
          : fmt(real, 2);
      add(T("极点", "Pole"), pole);
      add(T("稳定", "Stable"), real < 0 ? T("是", "yes") : T("否", "no"));
    }
    if (state.uncertainty) {
      const u = state.uncertainty.intervals;
      const keys = Object.keys(u);
      keys.forEach((key) => add(`${key} 95% CI`, `${fmt(u[key][0], 2)} – ${fmt(u[key][1], 2)}`));
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
    if (state.data.meta?.closedLoop && f.model !== "2SLS-ARX") {
      lines.push(
        T(
          "闭环数据：普通最小二乘可能有偏，结果只作参考。",
          "Closed-loop data: ordinary least squares can be biased; treat the result as a reference."
        )
      );
    }
    if (["FIR", "OE", "ARMAX", "Wiener"].includes(f.model)) {
      lines.push(
        T(
          "这是时间域模型；验证集很差时不要用它外推。",
          "Time-domain model; do not extrapolate when validation FIT is poor."
        )
      );
    }
    if (f.model === "Hammerstein") {
      if (Math.abs(f.c2) > 0.9)
        lines.push(
          T(
            "c2 接近搜索边界；输入非线性可能不可辨识。",
            "c2 is near the search bound; the input nonlinearity may not be identifiable."
          )
        );
      lines.push(
        T(
          "Hammerstein 只建模静态输入非线性，不是通用非线性辨识。",
          "Hammerstein models static input nonlinearity only; this is not universal nonlinear identification."
        )
      );
    }
    if (f.model === "2SLS-ARX") {
      lines.push(
        T(
          "2SLS 用设定值 r 作为工具变量；r 必须独立激励。",
          "2SLS uses setpoint r as the instrument; r must be independently excited."
        )
      );
    }
    if (f.model === "ETFE" && state.data.meta?.excitation === "step") {
      lines.push(
        T(
          "ETFE 需要扫频/PRBS 等周期激励；阶跃数据只能做演示。",
          "ETFE needs a sweep/PRBS periodic excitation; step data is only a demo."
        )
      );
    }
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

  function renderValidation() {
    const box = $("validation");
    const report = V && state.fit ? V.validate(state.fit, state.data, state.quality) : null;
    if (!report) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const title = T("验证报告", "Validation report");
    box.innerHTML = `<div class="validation-head"><h3>${title}</h3><b class="v-grade" data-grade="${report.grade}">${report.grade}</b></div>`;
    const list = document.createElement("div");
    list.className = "v-list";
    report.checks.forEach((c) => {
      const row = document.createElement("div");
      row.className = "v-item " + c.level;
      const mark = document.createElement("b");
      mark.textContent = c.level === "ok" ? "OK" : c.level === "warn" ? "!" : "X";
      row.appendChild(mark);
      row.appendChild(document.createTextNode(" " + c.message));
      list.appendChild(row);
    });
    box.appendChild(list);
  }

  function paramCount(f) {
    if (f.model === "FOPDT") return 3;
    if (f.model === "SOPDT") return 4;
    if (f.model === "ARX" || f.model === "OE" || f.model === "2SLS-ARX") return f.na + f.nb;
    if (f.model === "ARMAX") return f.na + f.nb + f.nc;
    if (f.model === "FIR") return f.nh + 1;
    if (f.model === "Wiener") return f.na + f.nb + 3;
    if (f.model === "Hammerstein") return f.na + f.nb + 1;
    if (f.model === "MIMO-ARX") return f.p * (f.p * f.na + f.m * f.nb);
    return null;
  }

  function recordComparison(f) {
    if (!state.data || !f || !f.yhat || f.model === "ETFE" || f.model === "MIMO-ARX") return;
    let sse = 0;
    const n = state.data.y.length;
    for (let i = 0; i < n; i++) {
      const d = state.data.y[i] - f.yhat[i];
      sse += d * d;
    }
    const k = paramCount(f);
    const aic = k != null && sse > 0 ? n * Math.log(sse / n) + 2 * k : null;
    const grade = (V && V.validate(f, state.data, state.quality)) || null;
    const key = [f.model, f.na, f.nb, f.nk, f.fitTrain && f.fitTrain.toFixed(1)].join("|");
    if (state.history.some((h) => h.key === key)) return;
    state.history.unshift({
      key,
      model: f.model,
      train: f.fitTrain,
      val: f.fitVal,
      aic,
      grade: grade ? grade.grade : null,
      k,
    });
    state.history = state.history.slice(0, 6);
    renderComparison();
  }

  function renderComparison() {
    const box = $("comparison");
    if (!state.history.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const rows = state.history
      .map(
        (h) =>
          `<tr><td>${h.model}</td><td>${h.train != null ? h.train.toFixed(1) : "—"}</td><td>${h.val != null ? h.val.toFixed(1) : "—"}</td><td>${h.aic != null ? h.aic.toFixed(0) : "—"}</td><td>${h.k != null ? h.k : "—"}</td><td>${h.grade || "—"}</td></tr>`
      )
      .join("");
    box.innerHTML = `<h3>${T("模型对比", "Model comparison")}</h3><div class="table-wrap"><table><thead><tr><th>model</th><th>FIT train</th><th>FIT val</th><th>AIC</th><th>k</th><th>grade</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function drawMainChart() {
    const el = $("chart");
    if (!state.data) {
      el.innerHTML = '<p class="hint">先生成实验或上传 CSV。</p>';
      return;
    }
    const d = state.data;
    const f = state.fit;
    if (f && f.model === "ETFE") drawBode(el, f);
    else if (f && f.model === "MIMO-ARX") drawMimo(el, f, d);
    else drawSvg(el, 800, 300, d, f);
  }

  function drawResidual(fit) {
    const el = $("residual");
    if (!fit || fit.model === "ETFE" || fit.model === "MIMO-ARX" || !state.data) {
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

  function drawMimo(el, f, d) {
    const width = 800,
      height = 330,
      m = { l: 48, r: 12, t: 10, b: 24 };
    const w = width - m.l - m.r;
    const t0 = d.t[0],
      t1 = d.t[d.t.length - 1];
    const sx = (t) => m.l + ((t - t0) / (t1 - t0 || 1)) * w;
    const colors = ["var(--chart-1)", "var(--chart-2)"];
    const series = d.Y.map((arr, o) => ({ name: `y${o + 1}`, y: arr, yhat: f.yhat[o], color: colors[o] }));
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="MIMO measured and predicted outputs">`;
    series.forEach((s, o) => {
      const vals = s.y.concat(s.yhat);
      let lo = Math.min(...vals),
        hi = Math.max(...vals);
      const pad = (hi - lo || 1) * 0.1;
      lo -= pad;
      hi += pad;
      const top = m.t + o * 150,
        hh = 120;
      const sy = (v) => top + hh - ((v - lo) / (hi - lo || 1)) * hh;
      const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${sx(d.t[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
      svg += `<line x1="${m.l}" y1="${top + hh}" x2="${width - m.r}" y2="${top + hh}" style="stroke:var(--line)"/>`;
      svg += `<path d="${path(s.y)}" fill="none" style="stroke:var(--chart-raw);stroke-width:1.1;opacity:.8"/>`;
      svg += `<path d="${path(s.yhat)}" fill="none" style="stroke:${s.color};stroke-width:1.7"/>`;
      svg += `<text x="${m.l}" y="${top + 10}" style="fill:var(--muted);font:9px var(--mono)">${s.name} measured / fit</text>`;
    });
    svg += "</svg>";
    el.innerHTML = svg;
  }

  function drawBode(el, f) {
    const width = 800,
      height = 330,
      m = { l: 54, r: 16, t: 12, b: 26 };
    const w = width - m.l - m.r;
    const topH = 145,
      botY = 196,
      botH = 100;
    const mags = f.mag.map((v) => 20 * Math.log10(Math.max(v, 1e-9)));
    let lo = Math.min(...mags),
      hi = Math.max(...mags);
    const pad = (hi - lo || 1) * 0.12;
    lo -= pad;
    hi += pad;
    const sx = (i) => m.l + (i / Math.max(1, f.freq.length - 1)) * w;
    const sy = (v) => m.t + topH - ((v - lo) / (hi - lo || 1)) * topH;
    const magPath = mags.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
    const ph = f.phase.map((v) => (v * 180) / Math.PI);
    let plo = Math.min(...ph),
      phi = Math.max(...ph);
    const ppad = (phi - plo || 1) * 0.12;
    plo -= ppad;
    phi += ppad;
    const py = (v) => botY + botH - ((v - plo) / (phi - plo || 1)) * botH;
    const phPath = ph.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
    let grid = "";
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      grid += `<line x1="${m.l}" y1="${sy(v).toFixed(1)}" x2="${width - m.r}" y2="${sy(v).toFixed(1)}" style="stroke:var(--grid)"/><text x="${m.l - 6}" y="${(sy(v) + 3).toFixed(1)}" text-anchor="end" style="fill:var(--muted);font:9px var(--mono)">${v.toFixed(0)}</text>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${grid}
      <path d="${magPath}" fill="none" style="stroke:var(--chart-1);stroke-width:1.8"/>
      <text x="${m.l}" y="${m.t + 10}" style="fill:var(--muted);font:9px var(--mono)">|H| dB</text>
      <line x1="${m.l}" y1="${botY}" x2="${width - m.r}" y2="${botY}" style="stroke:var(--line)"/>
      <path d="${phPath}" fill="none" style="stroke:var(--chart-2);stroke-width:1.6"/>
      <text x="${m.l}" y="${botY + 12}" style="fill:var(--muted);font:9px var(--mono)">phase deg</text>
      <text x="${width - m.r}" y="${height - 6}" text-anchor="end" style="fill:var(--muted);font:9px var(--mono)">${fmt(f.freq[0], 3)} – ${fmt(f.freq[f.freq.length - 1], 3)} Hz</text>
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

  function estimateUncertainty() {
    if (!state.fit || !state.data || state.fit.model === "ETFE") return;
    const split = Math.max(0, Math.min(1, Number($("split").value) || 0.7));
    const trainEnd = split < 1 ? Math.max(8, Math.floor(state.data.t.length * split)) : state.data.t.length;
    $("uncertainty").disabled = true;
    $("fit-hint").textContent = T("正在做 bootstrap…", "Running bootstrap…");
    setTimeout(() => {
      try {
        state.uncertainty = I.bootstrap(state.data.t, state.data.u, state.data.y, state.fit.model, {
          trainEnd,
          B: 10,
          na: 2,
          nb: 2,
          nk: 1,
        });
        renderMetrics();
        $("fit-hint").textContent = T(
          "不确定度是重采样估计，不是严格保证。",
          "Intervals are resampling estimates, not a guarantee."
        );
      } catch (e) {
        $("fit-hint").textContent = T("不确定度估计失败：", "Uncertainty failed: ") + e.message;
      } finally {
        $("uncertainty").disabled = false;
      }
    }, 30);
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

  function applyColumns(parsed, timeIndex, ins, outs, name, refIndex) {
    const d = D.selectColumns(parsed, timeIndex, ins, outs);
    if (refIndex !== "" && refIndex != null) {
      const ri = Number(refIndex);
      if (Number.isInteger(ri) && parsed.meta.columns[ri]) d.r = parsed.meta.columns[ri].slice();
    }
    d.meta = {
      ...(d.meta || {}),
      units: { u: "", y: "" },
      closedLoop: $("closed-loop").checked,
      source: "csv",
      mimoChannels: d.U.length,
    };
    state.source = "csv";
    state.fileName = name;
    const mimo = d.U.length > 1 || d.Y.length > 1;
    if (mimo) {
      $("model").value = "MIMO-ARX";
      $("arx-orders").hidden = false;
    } else if ($("model").value === "MIMO-ARX") {
      $("model").value = "FOPDT";
    }
    $("file-name").textContent =
      `${T("已读取", "Loaded")}：${name} · ${d.t.length} ${T("行", "rows")} · ${d.U.length} u / ${d.Y.length} y`;
    setData(d, `CSV：${name}`);
    $("csv-map").hidden = true;
  }

  function showMapping(parsed, name) {
    state.csvParsed = parsed;
    state.csvName = name;
    const headers = parsed.meta.headers;
    const time = $("map-time");
    time.innerHTML = "";
    headers.forEach((h, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = h;
      time.appendChild(o);
    });
    time.value = String(parsed.meta.timeIndex || 0);
    const fill = (box, kind) => {
      box.innerHTML = "";
      headers.forEach((h, i) => {
        if (i === Number(time.value)) return;
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = String(i);
        cb.dataset.kind = kind;
        const auto = kind === "in" ? /^u\d*$/i.test(h) || /^input/i.test(h) : /^y\d*$/i.test(h) || /^output/i.test(h);
        cb.checked = auto || (kind === "in" ? i === parsed.meta.inputIndex : i === parsed.meta.outputIndex);
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(h));
        box.appendChild(lab);
      });
    };
    fill($("map-inputs"), "in");
    fill($("map-outputs"), "out");
    $("map-hint").textContent = T(
      "选择时间列、输入列和输出列，然后应用。",
      "Pick time, inputs and outputs, then apply."
    );
    $("csv-map").hidden = false;
    $("file-name").textContent = `${T("已读取", "Loaded")}：${name} · ${parsed.t.length} ${T("行", "rows")}`;
  }

  function applyMapping() {
    if (!state.csvParsed) return;
    const ins = Array.from(document.querySelectorAll("#map-inputs input:checked")).map((x) => x.value);
    const outs = Array.from(document.querySelectorAll("#map-outputs input:checked")).map((x) => x.value);
    try {
      applyColumns(state.csvParsed, $("map-time").value, ins, outs, state.csvName, $("map-ref").value);
    } catch (e) {
      $("map-hint").textContent = e.message;
    }
  }

  function initUpload() {
    $("csv").addEventListener("change", (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const d = D.parseCSV(String(reader.result));
          state.source = "csv";
          state.fileName = file.name;
          if (d.meta.headers.length > 3) showMapping(d, file.name);
          else applyColumns(d, d.meta.timeIndex, [d.meta.inputIndex], [d.meta.outputIndex], file.name, null);
        } catch (e) {
          showError(`CSV 解析失败：${e.message}`);
        }
      };
      reader.readAsText(file);
    });
    $("apply-map").addEventListener("click", applyMapping);
    $("map-time").addEventListener("change", () => {
      const t = Number($("map-time").value);
      document.querySelectorAll("#map-inputs input, #map-outputs input").forEach((cb) => {
        cb.disabled = Number(cb.value) === t;
        if (cb.disabled) cb.checked = false;
      });
    });
  }

  function renderManual() {
    const box = $("manual-list");
    if (!box || !window.MODEL_MANUAL) return;
    const data = isEn() ? window.MODEL_MANUAL.en : window.MODEL_MANUAL.zh;
    box.innerHTML = "";
    data.forEach((ch) => {
      const d = document.createElement("details");
      d.appendChild(Object.assign(document.createElement("summary"), { textContent: ch.title }));
      const p = document.createElement("p");
      p.textContent = ch.body;
      d.appendChild(p);
      box.appendChild(d);
    });
  }

  function init() {
    initPlants();
    drawHero();
    initUpload();
    try {
      state.fitWorker = new Worker("core/fit-worker.js");
      state.fitWorker.onmessage = (e) => {
        const m = e.data;
        if (!m || m.id !== state.fitSeq) return;
        if (m.ok) applyFit(m.fit);
        else fitFailed(m.error || "worker error");
      };
      state.fitWorker.onerror = () => {
        state.fitWorker = null;
        if ($("fit").disabled) fitFailed("worker failed; retry synchronously");
      };
    } catch (e) {
      state.fitWorker = null;
    }
    $("generate").addEventListener("click", generate);
    $("fit").addEventListener("click", fit);
    $("model").addEventListener("change", () => {
      $("arx-orders").hidden = !["ARX", "MIMO-ARX", "2SLS-ARX", "Hammerstein", "OE", "ARMAX", "Wiener"].includes(
        $("model").value
      );
      $("nc-field").hidden = $("model").value !== "ARMAX";
      $("loop-params").hidden = $("excitation").value !== "closed-loop";
      if ($("model").value === "MIMO-ARX") {
        $("plant").value = "mimo";
        $("excitation").value = "prbs";
        generate();
      }
      if ($("model").value === "2SLS-ARX") {
        $("excitation").value = "closed-loop";
        $("loop-params").hidden = false;
        generate();
      }
      if ($("model").value === "Hammerstein") {
        $("plant").value = "tank";
        applyPlantDefaults();
        $("excitation").value = "step";
        generate();
      }
      if ($("model").value === "ETFE") $("excitation").value = "chirp";
      if ($("model").value === "ARX") $("excitation").value = "prbs";
      if ($("model").value === "ETFE" || $("model").value === "ARX") generate();
    });
    $("arx-orders").hidden = !["ARX", "MIMO-ARX", "2SLS-ARX", "Hammerstein"].includes($("model").value);
    $("loop-params").hidden = $("excitation").value !== "closed-loop";
    renderManual();
    $("excitation").addEventListener("change", () => {
      $("loop-params").hidden = $("excitation").value !== "closed-loop";
    });
    $("closed-loop").addEventListener("change", () => {
      if (!state.data) return;
      state.data.meta.closedLoop = state.source === "csv" && $("closed-loop").checked;
      state.quality = Q.analyze(state.data);
      renderQuality();
    });
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
    $("uncertainty").addEventListener("click", estimateUncertainty);
    $("download-matlab").addEventListener("click", downloadMatlab);
    generate();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
