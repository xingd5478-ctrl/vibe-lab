/* Control Play · 二阶系统（零依赖 SVG 绘图） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = { wn: 4, zeta: 0.4 };
  const PAD = { l: 56, r: 56, t: 30, b: 38 };

  function logspace(a, b, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(a * Math.pow(b / a, i / (n - 1)));
    return out;
  }

  function bode(wn, zeta) {
    const w = logspace(0.1, 100, 320);
    const mag = [], phase = [];
    for (const wi of w) {
      const re = wn * wn - wi * wi;
      const im = 2 * zeta * wn * wi;
      const den = Math.hypot(re, im);
      mag.push(20 * Math.log10((wn * wn) / den));
      phase.push((Math.atan2(-im, re) * 180) / Math.PI);
    }
    return { w, mag, phase };
  }

  function step(wn, zeta) {
    const dt = 0.002, T = 8, n = Math.floor(T / dt);
    let x1 = 0, x2 = 0;
    const t = new Float64Array(n), y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const dx1 = x2;
      const dx2 = -wn * wn * x1 - 2 * zeta * wn * x2 + wn * wn;
      x1 += dx1 * dt;
      x2 += dx2 * dt;
      t[i] = i * dt;
      y[i] = x1;
    }
    return { t, y };
  }

  function metrics(t, y) {
    let peak = -Infinity, tPeak = 0;
    for (let i = 0; i < y.length; i++) {
      if (y[i] > peak) { peak = y[i]; tPeak = t[i]; }
    }
    const overshoot = peak > 1 ? (peak - 1) * 100 : 0;
    let settle = t[t.length - 1];
    for (let i = y.length - 1; i >= 0; i--) {
      if (Math.abs(y[i] - 1) > 0.02) { settle = t[Math.min(i + 1, y.length - 1)]; break; }
    }
    return { overshoot, tPeak, settle };
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function linTicks(min, max, count) {
    const step = niceStep((max - min) / (count || 5));
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(v);
    return out;
  }

  function logTicks(min, max) {
    const out = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
      }
    }
    return out;
  }

  function fmt(v) {
    const a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 1000 || a < 0.01) return v.toExponential(0);
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(0);
    return v.toFixed(2);
  }

  function path(points, color, width, dash) {
    let d = "";
    points.forEach(([x, y], i) => { d += `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`; });
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width || 1.4}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  }

  function plotBode(el, b) {
    const w = Math.max(el.clientWidth || 640, 320);
    const h = 290;
    const iw = w - PAD.l - PAD.r, ih = h - PAD.t - PAD.b;
    const x0 = Math.log10(b.w[0]), x1 = Math.log10(b.w[b.w.length - 1]);

    let magMin = Math.min(...b.mag), magMax = Math.max(...b.mag);
    let phMin = Math.min(...b.phase), phMax = Math.max(...b.phase);
    const mp = (magMax - magMin) * 0.08 || 1, pp = (phMax - phMin) * 0.08 || 1;
    magMin -= mp; magMax += mp; phMin -= pp; phMax += pp;

    const X = (v) => PAD.l + ((Math.log10(v) - x0) / (x1 - x0)) * iw;
    const Ym = (v) => PAD.t + (1 - (v - magMin) / (magMax - magMin)) * ih;
    const Yp = (v) => PAD.t + (1 - (v - phMin) / (phMax - phMin)) * ih;

    const xt = logTicks(b.w[0], b.w[b.w.length - 1]);
    const mt = linTicks(magMin, magMax, 5);
    const pt = linTicks(phMin, phMax, 4);

    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img">`;
    mt.forEach((v) => {
      const y = Ym(v);
      svg += `<line class="grid" x1="${PAD.l}" y1="${y}" x2="${w - PAD.r}" y2="${y}"/>`;
      svg += `<text class="tick-label" x="${PAD.l - 7}" y="${y + 3}" text-anchor="end">${fmt(v)}</text>`;
    });
    pt.forEach((v) => {
      const y = Yp(v);
      svg += `<text class="tick-label" x="${w - PAD.r + 7}" y="${y + 3}" text-anchor="start">${fmt(v)}</text>`;
    });
    xt.forEach((v) => {
      const x = X(v);
      svg += `<line class="grid" x1="${x}" y1="${PAD.t}" x2="${x}" y2="${h - PAD.b}"/>`;
      svg += `<text class="tick-label" x="${x}" y="${h - PAD.b + 14}" text-anchor="middle">${fmt(v)}</text>`;
    });

    svg += `<line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${h - PAD.b}"/>`;
    svg += `<line class="axis" x1="${w - PAD.r}" y1="${PAD.t}" x2="${w - PAD.r}" y2="${h - PAD.b}"/>`;
    svg += `<line class="axis" x1="${PAD.l}" y1="${h - PAD.b}" x2="${w - PAD.r}" y2="${h - PAD.b}"/>`;

    svg += `<text class="axis-label" x="${PAD.l}" y="${PAD.t - 10}">幅值 (dB)</text>`;
    svg += `<text class="axis-label" x="${w - PAD.r}" y="${PAD.t - 10}" text-anchor="end">相位 (°)</text>`;
    svg += `<text class="axis-label" x="${w - PAD.r}" y="${h - 4}" text-anchor="end">ω (rad/s)</text>`;

    const magPts = b.w.map((wv, i) => [X(wv), Ym(b.mag[i])]);
    const phPts = b.w.map((wv, i) => [X(wv), Yp(b.phase[i])]);
    svg += path(magPts, "#1f4e79", 1.8);
    svg += path(phPts, "#b5651d", 1.8);

    svg += `<line x1="${PAD.l + 118}" y1="${PAD.t - 18}" x2="${PAD.l + 132}" y2="${PAD.t - 18}" stroke="#1f4e79" stroke-width="2"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 137}" y="${PAD.t - 14}">幅值</text>`;
    svg += `<line x1="${PAD.l + 188}" y1="${PAD.t - 18}" x2="${PAD.l + 202}" y2="${PAD.t - 18}" stroke="#b5651d" stroke-width="2"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 207}" y="${PAD.t - 14}">相位</text>`;

    svg += "</svg>";
    el.innerHTML = svg;
  }

  function plotStep(el, s) {
    const w = Math.max(el.clientWidth || 640, 320);
    const h = 250;
    const iw = w - PAD.l - PAD.r, ih = h - PAD.t - PAD.b;
    const tmax = s.t[s.t.length - 1];
    let ymax = Math.max(1.05, ...s.y) * 1.08;
    const ymin = 0;

    const X = (v) => PAD.l + (v / tmax) * iw;
    const Y = (v) => PAD.t + (1 - (v - ymin) / (ymax - ymin)) * ih;
    const xt = linTicks(0, tmax, 5);
    const yt = linTicks(ymin, ymax, 4);

    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img">`;
    yt.forEach((v) => {
      const y = Y(v);
      svg += `<line class="grid" x1="${PAD.l}" y1="${y}" x2="${w - PAD.r}" y2="${y}"/>`;
      svg += `<text class="tick-label" x="${PAD.l - 7}" y="${y + 3}" text-anchor="end">${fmt(v)}</text>`;
    });
    xt.forEach((v) => {
      const x = X(v);
      svg += `<line class="grid" x1="${x}" y1="${PAD.t}" x2="${x}" y2="${h - PAD.b}"/>`;
      svg += `<text class="tick-label" x="${x}" y="${h - PAD.b + 14}" text-anchor="middle">${fmt(v)}</text>`;
    });

    svg += `<line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${h - PAD.b}"/>`;
    svg += `<line class="axis" x1="${PAD.l}" y1="${h - PAD.b}" x2="${w - PAD.r}" y2="${h - PAD.b}"/>`;
    svg += `<text class="axis-label" x="${PAD.l}" y="${PAD.t - 10}">y(t)</text>`;
    svg += `<text class="axis-label" x="${w - PAD.r}" y="${h - 4}" text-anchor="end">t (s)</text>`;

    svg += `<line x1="${PAD.l}" y1="${Y(1)}" x2="${w - PAD.r}" y2="${Y(1)}" stroke="#b9b3a5" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg += path(Array.from(s.t, (tv, i) => [X(tv), Y(s.y[i])]), "#2f6b4f", 1.8);
    svg += `<line x1="${PAD.l + 78}" y1="${PAD.t - 18}" x2="${PAD.l + 92}" y2="${PAD.t - 18}" stroke="#2f6b4f" stroke-width="2"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 97}" y="${PAD.t - 14}">y(t)</text>`;
    svg += `<line x1="${PAD.l + 138}" y1="${PAD.t - 18}" x2="${PAD.l + 152}" y2="${PAD.t - 18}" stroke="#b9b3a5" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg += `<text class="legend-label" x="${PAD.l + 157}" y="${PAD.t - 14}">目标</text>`;

    svg += "</svg>";
    el.innerHTML = svg;
  }

  function render() {
    const wn = parseFloat($("wn").value);
    const zeta = parseFloat($("zeta").value);
    state.wn = wn;
    state.zeta = zeta;
    $("wn-val").textContent = wn.toFixed(1);
    $("zeta-val").textContent = zeta.toFixed(2);

    const b = bode(wn, zeta);
    plotBode($("bode"), b);

    const s = step(wn, zeta);
    plotStep($("step"), s);
    const m = metrics(s.t, s.y);
    $("overshoot").textContent = m.overshoot.toFixed(1) + " %";
    $("settle").textContent = m.settle.toFixed(2) + " s";
    $("peak").textContent = m.tPeak.toFixed(2) + " s";
    $("meta-bode").textContent = `ωn=${wn.toFixed(1)} rad/s · ζ=${zeta.toFixed(2)}`;
  }

  $("wn").addEventListener("input", render);
  $("zeta").addEventListener("input", render);
  window.addEventListener("resize", () => render());

  const params = new URLSearchParams(location.search);
  if (params.has("wn")) $("wn").value = params.get("wn");
  if (params.has("zeta")) $("zeta").value = params.get("zeta");
  render();
})();
