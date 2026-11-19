/* Control Play · 二阶系统 + PID（零依赖 SVG，含悬浮读数与 URL 同步） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    order: 2,
    wn: 4,
    zeta: 0.4,
    K: 1,
    tau: 1,
    kp: 1.5,
    ki: 0.5,
    kd: 0.05,
    antiWindup: true,
    tf: 0.02,
    uMax: 20,
  };
  const PAD = { l: 56, r: 56, t: 30, b: 38 };

  function logspace(a, b, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(a * Math.pow(b / a, i / (n - 1)));
    return out;
  }

  function bode(wn, zeta) {
    const w = logspace(0.1, 100, 320);
    const mag = [],
      phase = [];
    for (const wi of w) {
      const re = wn * wn - wi * wi;
      const im = 2 * zeta * wn * wi;
      mag.push(20 * Math.log10((wn * wn) / Math.hypot(re, im)));
      phase.push((Math.atan2(-im, re) * 180) / Math.PI);
    }
    return { w, mag, phase };
  }

  function bodeFirst(K, tau) {
    const w = logspace(0.1, 100, 320);
    const mag = [],
      phase = [];
    for (const wi of w) {
      mag.push(20 * Math.log10(K / Math.hypot(1, wi * tau)));
      phase.push((-Math.atan(wi * tau) * 180) / Math.PI);
    }
    return { w, mag, phase };
  }

  function simFirst(K, tau, closed, kp, ki, kd, opts) {
    const dt = 0.002,
      T = 8,
      n = Math.floor(T / dt);
    let x = 0,
      xi = 0,
      dF = 0,
      prevE = 1;
    const t = new Float64Array(n),
      y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let u = 1;
      if (closed) {
        const e = 1 - x;
        const dRaw = (e - prevE) / dt;
        const tf = Math.max(0, (opts && opts.tf) || 0);
        dF += ((dRaw - dF) * dt) / (tf + dt);
        const candidate = Math.max(-10, Math.min(10, xi + e * dt));
        const raw = kp * e + ki * candidate + kd * dF;
        const lim = (opts && opts.uMax) || 20;
        u = Math.max(-lim, Math.min(lim, raw));
        const saturated = raw !== u;
        if (!saturated || !(opts && opts.antiWindup === false)) xi = candidate;
        prevE = e;
      }
      x += dt * ((K * u - x) / tau);
      t[i] = i * dt;
      y[i] = x;
    }
    return { t, y };
  }

  function sim(wn, zeta, closed, kp, ki, kd, opts) {
    const dt = 0.002,
      T = 8,
      n = Math.floor(T / dt);
    let x1 = 0,
      x2 = 0,
      xi = 0,
      dF = 0,
      prevE = 1;
    const t = new Float64Array(n),
      y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let u = 1;
      if (closed) {
        const e = 1 - x1;
        const dRaw = (e - prevE) / dt;
        const tf = Math.max(0, (opts && opts.tf) || 0);
        dF += ((dRaw - dF) * dt) / (tf + dt);
        const candidate = Math.max(-10, Math.min(10, xi + e * dt));
        const raw = kp * e + ki * candidate + kd * dF;
        const lim = (opts && opts.uMax) || 20;
        u = Math.max(-lim, Math.min(lim, raw));
        const saturated = raw !== u;
        if (!saturated || !(opts && opts.antiWindup === false)) xi = candidate;
        prevE = e;
      }
      const dx1 = x2;
      const dx2 = -wn * wn * x1 - 2 * zeta * wn * x2 + wn * wn * u;
      x1 += dx1 * dt;
      x2 += dx2 * dt;
      t[i] = i * dt;
      y[i] = x1;
    }
    return { t, y };
  }

  function metrics(t, y) {
    let peak = -Infinity,
      tPeak = 0;
    for (let i = 0; i < y.length; i++)
      if (y[i] > peak) {
        peak = y[i];
        tPeak = t[i];
      }
    const overshoot = peak > 1 ? (peak - 1) * 100 : 0;
    let settle = 0,
      settled = true;
    for (let i = y.length - 1; i >= 0; i--) {
      if (Math.abs(y[i] - 1) > 0.02) {
        if (i === y.length - 1) {
          settle = null;
          settled = false;
        } else settle = t[Math.min(i + 1, y.length - 1)];
        break;
      }
    }
    return { overshoot, tPeak, settle, settled, ess: Math.abs(1 - y[y.length - 1]) };
  }

  const { attachHover, path, fmt, linTicks, logTicks } = window.IMUChart;
  const tr = (s) => (window.VibeI18n ? window.VibeI18n.translate(s) : s);

  function plotBode(el, b) {
    const w = Math.max(el.clientWidth || 640, 320),
      h = 300;
    const iw = w - PAD.l - PAD.r,
      ih = h - PAD.t - PAD.b;
    const x0 = Math.log10(b.w[0]),
      x1 = Math.log10(b.w[b.w.length - 1]);
    let magMin = Math.min(...b.mag),
      magMax = Math.max(...b.mag);
    let phMin = Math.min(...b.phase),
      phMax = Math.max(...b.phase);
    const mp = (magMax - magMin) * 0.08 || 1,
      pp = (phMax - phMin) * 0.08 || 1;
    magMin -= mp;
    magMax += mp;
    phMin -= pp;
    phMax += pp;

    const X = (v) => PAD.l + ((Math.log10(v) - x0) / (x1 - x0)) * iw;
    const Ym = (v) => PAD.t + (1 - (v - magMin) / (magMax - magMin)) * ih;
    const Yp = (v) => PAD.t + (1 - (v - phMin) / (phMax - phMin)) * ih;
    const xInv = (frac) => Math.pow(10, x0 + frac * (x1 - x0));

    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Bode 图：幅频与相频">`;
    linTicks(magMin, magMax, 5).forEach((v) => {
      const y = Ym(v);
      svg += `<line class="grid" x1="${PAD.l}" y1="${y}" x2="${w - PAD.r}" y2="${y}"/>`;
      svg += `<text class="tick-label" x="${PAD.l - 7}" y="${y + 3}" text-anchor="end">${fmt(v)}</text>`;
    });
    linTicks(phMin, phMax, 6).forEach((v) => {
      const y = Yp(v);
      svg += `<line x1="${w - PAD.r}" y1="${y}" x2="${w - PAD.r + 4}" y2="${y}" stroke="#1b1d22" stroke-width="1"/>`;
      svg += `<text class="tick-label" x="${w - PAD.r + 7}" y="${y + 3}" text-anchor="start">${fmt(v)}</text>`;
    });
    logTicks(b.w[0], b.w[b.w.length - 1]).forEach((v) => {
      const x = X(v);
      svg += `<line class="grid" x1="${x}" y1="${PAD.t}" x2="${x}" y2="${h - PAD.b}"/>`;
      svg += `<text class="tick-label" x="${x}" y="${h - PAD.b + 14}" text-anchor="middle">${fmt(v)}</text>`;
    });
    svg += `<line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${h - PAD.b}"/>`;
    svg += `<line class="axis" x1="${w - PAD.r}" y1="${PAD.t}" x2="${w - PAD.r}" y2="${h - PAD.b}"/>`;
    svg += `<line class="axis" x1="${PAD.l}" y1="${h - PAD.b}" x2="${w - PAD.r}" y2="${h - PAD.b}"/>`;
    svg += `<text class="axis-label" x="${PAD.l}" y="${PAD.t - 10}">${tr("幅值 (dB)")}</text>`;
    svg += `<text class="axis-label" x="${w - PAD.r}" y="${PAD.t - 10}" text-anchor="end">${tr("相位 (°)")}</text>`;
    svg += `<text class="axis-label" x="${w - PAD.r}" y="${h - 4}" text-anchor="end">ω (rad/s)</text>`;

    svg += path(
      b.w.map((v, i) => [X(v), Ym(b.mag[i])]),
      "#1f4e79",
      1.8
    );
    svg += path(
      b.w.map((v, i) => [X(v), Yp(b.phase[i])]),
      "#b5651d",
      1.8
    );

    svg += `<line x1="${PAD.l + 118}" y1="${PAD.t - 18}" x2="${PAD.l + 132}" y2="${PAD.t - 18}" stroke="#1f4e79" stroke-width="2"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 137}" y="${PAD.t - 14}">${tr("幅值")}</text>`;
    svg += `<line x1="${PAD.l + 188}" y1="${PAD.t - 18}" x2="${PAD.l + 202}" y2="${PAD.t - 18}" stroke="#b5651d" stroke-width="2"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 207}" y="${PAD.t - 14}">${tr("相位")}</text>`;
    svg += "</svg>";
    el.innerHTML = svg;

    attachHover(el, {
      w,
      h,
      pad: PAD,
      X,
      xInv,
      xLabel: "ω",
      series: [
        { name: tr("幅值"), points: b.w.map((v, i) => [v, b.mag[i]]) },
        { name: tr("相位"), points: b.w.map((v, i) => [v, b.phase[i]]) },
      ],
      yDot: (p) => Ym(p[1]),
    });
  }

  function plotStep(el, open, closed) {
    const w = Math.max(el.clientWidth || 640, 320),
      h = 260;
    const iw = w - PAD.l - PAD.r,
      ih = h - PAD.t - PAD.b;
    const tmax = open.t[open.t.length - 1];
    const ymax = Math.max(1.05, ...open.y, ...closed.y) * 1.08;
    const X = (v) => PAD.l + (v / tmax) * iw;
    const Y = (v) => PAD.t + (1 - v / ymax) * ih;
    const xInv = (frac) => frac * tmax;

    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="阶跃响应：开环与闭环 PID 对比">`;
    linTicks(0, ymax, 4).forEach((v) => {
      const y = Y(v);
      svg += `<line class="grid" x1="${PAD.l}" y1="${y}" x2="${w - PAD.r}" y2="${y}"/>`;
      svg += `<text class="tick-label" x="${PAD.l - 7}" y="${y + 3}" text-anchor="end">${fmt(v)}</text>`;
    });
    linTicks(0, tmax, 5).forEach((v) => {
      const x = X(v);
      svg += `<line class="grid" x1="${x}" y1="${PAD.t}" x2="${x}" y2="${h - PAD.b}"/>`;
      svg += `<text class="tick-label" x="${x}" y="${h - PAD.b + 14}" text-anchor="middle">${fmt(v)}</text>`;
    });
    svg += `<line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${h - PAD.b}"/>`;
    svg += `<line class="axis" x1="${PAD.l}" y1="${h - PAD.b}" x2="${w - PAD.r}" y2="${h - PAD.b}"/>`;
    svg += `<text class="axis-label" x="${PAD.l}" y="${PAD.t - 10}">y(t)</text>`;
    svg += `<text class="axis-label" x="${w - PAD.r}" y="${h - 4}" text-anchor="end">t (s)</text>`;

    svg += `<line x1="${PAD.l}" y1="${Y(1)}" x2="${w - PAD.r}" y2="${Y(1)}" stroke="#b9b3a5" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg += path(
      Array.from(open.t, (v, i) => [X(v), Y(open.y[i])]),
      "#b9b3a5",
      1.2,
      "5 4"
    );
    svg += path(
      Array.from(closed.t, (v, i) => [X(v), Y(closed.y[i])]),
      "#2f6b4f",
      1.8
    );

    svg += `<line x1="${PAD.l + 78}" y1="${PAD.t - 18}" x2="${PAD.l + 92}" y2="${PAD.t - 18}" stroke="#b9b3a5" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 97}" y="${PAD.t - 14}">${tr("开环")}</text>`;
    svg += `<line x1="${PAD.l + 138}" y1="${PAD.t - 18}" x2="${PAD.l + 152}" y2="${PAD.t - 18}" stroke="#2f6b4f" stroke-width="2"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 157}" y="${PAD.t - 14}">${tr("闭环 PID")}</text>`;
    svg += "</svg>";
    el.innerHTML = svg;

    attachHover(el, {
      w,
      h,
      pad: PAD,
      X,
      xInv,
      xLabel: "t",
      series: [
        { name: tr("开环"), points: Array.from(open.t, (v, i) => [v, open.y[i]]) },
        { name: tr("闭环"), points: Array.from(closed.t, (v, i) => [v, closed.y[i]]) },
      ],
      yDot: (p) => Y(p[1]),
    });
  }

  function render() {
    const order = Number($("order").value) || 2;
    $("order-two").hidden = order !== 2;
    $("order-one").hidden = order !== 1;
    const kp = parseFloat($("kp").value);
    const ki = parseFloat($("ki").value);
    const kd = parseFloat($("kd").value);
    const antiWindup = $("anti-windup").checked;
    const tf = parseFloat($("d-filter").value);
    const uMax = parseFloat($("u-limit").value);
    const opts = { antiWindup, tf, uMax };
    $("d-filter-val").textContent = tf.toFixed(3);
    $("u-limit-val").textContent = uMax.toFixed(0);
    $("kp-val").textContent = kp.toFixed(2);
    $("ki-val").textContent = ki.toFixed(2);
    $("kd-val").textContent = kd.toFixed(3);
    ["kp", "ki", "kd"].forEach((id) => $(id).setAttribute("aria-valuetext", $(id + "-val").textContent));

    let open, closed, b;
    if (order === 1) {
      const K = parseFloat($("K").value);
      const tau = parseFloat($("tau").value);
      Object.assign(state, { order, K, tau, kp, ki, kd, antiWindup, tf, uMax });
      $("K-val").textContent = K.toFixed(1);
      $("tau-val").textContent = tau.toFixed(2);
      $("K").setAttribute("aria-valuetext", K.toFixed(1));
      $("tau").setAttribute("aria-valuetext", tau.toFixed(2));
      b = bodeFirst(K, tau);
      open = simFirst(K, tau, false, kp, ki, kd, opts);
      closed = simFirst(K, tau, true, kp, ki, kd, opts);
      $("meta-bode").textContent = `K=${K.toFixed(2)} · τ=${tau.toFixed(2)} s`;
    } else {
      const wn = parseFloat($("wn").value);
      const zeta = parseFloat($("zeta").value);
      Object.assign(state, { order, wn, zeta, kp, ki, kd, antiWindup, tf, uMax });
      $("wn-val").textContent = wn.toFixed(1);
      $("zeta-val").textContent = zeta.toFixed(2);
      $("wn").setAttribute("aria-valuetext", wn.toFixed(1));
      $("zeta").setAttribute("aria-valuetext", zeta.toFixed(2));
      b = bode(wn, zeta);
      open = sim(wn, zeta, false, kp, ki, kd, opts);
      closed = sim(wn, zeta, true, kp, ki, kd, opts);
      $("meta-bode").textContent = `ωn=${wn.toFixed(1)} · ζ=${zeta.toFixed(2)}`;
    }

    const h1 = document.querySelector("header h1");
    if (h1) h1.textContent = order === 1 ? tr("Control Play · 一阶系统") : tr("Control Play · 二阶系统");
    const sub = document.querySelector("header .sub");
    if (sub)
      sub.textContent =
        order === 1
          ? tr("G(s) = K / (τs + 1) · 拖动滑杆，实时看一阶 Bode 与阶跃响应。")
          : tr("G(s) = ωn² / (s² + 2ζωn·s + ωn²) · 拖动滑杆，实时看 Bode 与阶跃响应。");
    plotBode($("bode"), b);
    plotStep($("step"), open, closed);
    const m = metrics(closed.t, closed.y);
    const tEnd = closed.t[closed.t.length - 1];
    const peakAtEnd = m.tPeak >= tEnd - 1e-9;
    $("overshoot").textContent = m.overshoot.toFixed(1) + " %";
    $("peak").textContent = peakAtEnd ? `>${tEnd.toFixed(1)} s` : m.tPeak.toFixed(2) + " s";
    $("settle").textContent = m.settled ? m.settle.toFixed(2) + " s" : `>${tEnd.toFixed(1)} s`;
    $("ess").textContent = m.ess.toFixed(3);
    $("meta-step").textContent = `Kp=${kp.toFixed(2)} · Ki=${ki.toFixed(2)} · Kd=${kd.toFixed(3)}`;
    const p = new URLSearchParams();
    p.set("order", String(order));
    if (order === 1) {
      p.set("K", state.K.toFixed(2));
      p.set("tau", state.tau.toFixed(2));
    } else {
      p.set("wn", state.wn.toFixed(2));
      p.set("zeta", state.zeta.toFixed(2));
    }
    p.set("kp", kp.toFixed(2));
    p.set("ki", ki.toFixed(2));
    p.set("kd", kd.toFixed(3));
    if ($("url-params")) $("url-params").textContent = "?" + p.toString();
    syncURL();
  }

  const copyLink = $("copy-link");
  if (copyLink) {
    copyLink.addEventListener("click", async () => {
      const status = $("copy-status");
      try {
        await navigator.clipboard.writeText(location.href);
        if (status) status.textContent = "已复制当前参数链接";
      } catch (e) {
        if (status) status.textContent = "复制失败，可直接复制地址栏 URL";
      }
      setTimeout(() => {
        if (status) status.textContent = "";
      }, 2400);
    });
  }

  function syncURL() {
    const p = new URLSearchParams();
    p.set("order", String(state.order));
    if (state.order === 1) {
      p.set("K", state.K.toFixed(2));
      p.set("tau", state.tau.toFixed(2));
    } else {
      p.set("wn", state.wn.toFixed(2));
      p.set("zeta", state.zeta.toFixed(2));
    }
    p.set("kp", state.kp.toFixed(2));
    p.set("ki", state.ki.toFixed(2));
    p.set("kd", state.kd.toFixed(3));
    try {
      history.replaceState(null, "", location.pathname + "?" + p.toString() + (location.hash || ""));
    } catch (e) {}
  }

  function loadURL() {
    const p = new URLSearchParams(location.search);
    if (p.has("order")) $("order").value = p.get("order") === "1" ? "1" : "2";
    if (p.has("aw")) $("anti-windup").checked = p.get("aw") !== "0";
    if (p.has("tf")) $("d-filter").value = p.get("tf");
    if (p.has("umax")) $("u-limit").value = p.get("umax");
    const map = { wn: "wn", zeta: "zeta", K: "K", tau: "tau", kp: "kp", ki: "ki", kd: "kd" };
    for (const k in map) {
      if (p.has(k)) {
        const v = parseFloat(p.get(k));
        if (isFinite(v)) $(map[k]).value = v;
      }
    }
  }

  ["order", "wn", "zeta", "K", "tau", "kp", "ki", "kd", "d-filter", "u-limit"].forEach((id) => {
    $(id).addEventListener(id === "order" ? "change" : "input", render);
  });
  $("anti-windup").addEventListener("change", render);
  window.addEventListener("resize", () => render());

  loadURL();
  render();
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", render);
  }
})();
