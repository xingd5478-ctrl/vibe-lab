(function (root) {
  "use strict";

  /* 主题色：调用方仍传浅色主题的十六进制值，深色模式由 CSS 变量接管。 */
  const CHART_VARS = {
    "#1f4e79": "--chart-1",
    "#2f6b4f": "--chart-2",
    "#b5651d": "--chart-3",
    "#7a9cc6": "--chart-4",
    "#c9a27a": "--chart-5",
    "#b9b3a5": "--chart-raw",
    "#d3ccba": "--chart-raw2",
    "#8a4a12": "--chart-warn",
    "#6d685d": "--chart-muted",
    "#1b1d22": "--chart-axis",
    "#5b564c": "--chart-muted",
  };

  function cssVar(name, fallback) {
    if (typeof document === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function themed(color) {
    const key = String(color || "").toLowerCase();
    const name = CHART_VARS[key];
    return name ? cssVar(name, color) : color;
  }

  /* 导出报告/PNG 用浅色底：把深色模式的高亮系列色换回浅色主题色。 */
  const LIGHT_COLORS = {
    "#7fb3e0": "#1f4e79",
    "#7fc9a3": "#2f6b4f",
    "#e0a36a": "#b5651d",
    "#8db3d8": "#7a9cc6",
    "#d8a97a": "#c9a27a",
    "#9a9488": "#b9b3a5",
    "#b3ada0": "#d3ccba",
    "#a49e90": "#6d685d",
    "#e7e2d6": "#1b1d22",
  };

  function lightColor(color) {
    return LIGHT_COLORS[String(color || "").toLowerCase()] || color;
  }

  function plotTimeCanvas(el, raw, clean, ch) {
    const H = 230;
    const pad = { l: 58, r: 16, t: 28, b: 34 };
    const w = Math.max(el.clientWidth || 640, 320);
    let canvas = el.querySelector("canvas");
    if (!canvas) {
      el.innerHTML = "";
      canvas = document.createElement("canvas");
      el.appendChild(canvas);
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = "100%";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);

    const iw = w - pad.l - pad.r,
      ih = H - pad.t - pad.b;
    const xmin = raw[0].t,
      xmax = raw[raw.length - 1].t;
    const ymin = -6,
      ymax = 6;
    const X = (t) => pad.l + ((t - xmin) / (xmax - xmin)) * iw;
    const Y = (v) => pad.t + (1 - (v - ymin) / (ymax - ymin)) * ih;

    ctx.font = "11px Consolas, monospace";
    const muted = cssVar("--muted", "#5b564c");
    const grid = cssVar("--grid", "#e7e3d8");
    const ink = cssVar("--ink", "#1b1d22");
    ctx.fillStyle = muted;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (const v of [-5, 0, 5]) {
      const y = Y(v);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillText(String(v), pad.l - 22, y + 4);
    }
    for (let i = 0; i <= 5; i++) {
      const t = xmin + (i / 5) * (xmax - xmin);
      const x = X(t);
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, H - pad.b);
      ctx.stroke();
      ctx.fillText(t.toFixed(1), x - 12, H - pad.b + 15);
    }
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, H - pad.b);
    ctx.lineTo(w - pad.r, H - pad.b);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.fillText("角速度 (°/s)", pad.l, pad.t - 10);
    ctx.fillText("时间 (s)", w - pad.r - 48, H - 4);

    const drawSeries = (rows, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      let idx = 0;
      for (let px = 0; px <= iw; px++) {
        const t = xmin + (px / iw) * (xmax - xmin);
        let lo = Infinity,
          hi = -Infinity;
        while (idx < rows.length && rows[idx].t <= t) {
          const v = rows[idx][ch];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
          idx++;
        }
        if (lo <= hi) {
          ctx.moveTo(pad.l + px, Y(hi));
          ctx.lineTo(pad.l + px, Y(lo));
        }
      }
      ctx.stroke();
    };
    drawSeries(raw, themed("#b9b3a5"), 0.8);
    drawSeries(clean, themed("#1f4e79"), 1.0);

    canvas.setAttribute("aria-label", `时域图：${raw.length} 帧，Canvas 绘制`);
    let tip = el.querySelector(".tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tip";
      el.appendChild(tip);
    }
    canvas.onmousemove = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const t = xmin + frac * (xmax - xmin);
      let lo = 0,
        hi = raw.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (raw[mid].t < t) lo = mid + 1;
        else hi = mid;
      }
      let l2 = 0,
        h2 = clean.length - 1;
      while (l2 < h2) {
        const mid = (l2 + h2) >> 1;
        if (clean[mid].t < t) l2 = mid + 1;
        else h2 = mid;
      }
      const r = raw[lo],
        c = clean[Math.min(l2, clean.length - 1)];
      tip.textContent = `时间 ${r.t.toFixed(2)} s · 原始 ${r[ch].toFixed(3)} · 清洗 ${c[ch].toFixed(3)} °/s`;
      tip.style.left = `${frac * 100}%`;
      tip.style.top = "12%";
      tip.style.opacity = "1";
    };
    canvas.onmouseleave = () => {
      tip.style.opacity = "0";
    };

    canvas.tabIndex = 0;
    let kidx = 0;
    const live = document.getElementById("chart-live");
    const step = Math.max(1, Math.floor(raw.length / 500));
    const showIdx = (i) => {
      kidx = Math.max(0, Math.min(raw.length - 1, i));
      const r = raw[kidx];
      let lo = 0,
        hi = clean.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (clean[mid].t < r.t) lo = mid + 1;
        else hi = mid;
      }
      const c = clean[Math.min(lo, clean.length - 1)];
      const text = `时间 ${r.t.toFixed(2)} s · 原始 ${r[ch].toFixed(3)} · 清洗 ${c[ch].toFixed(3)} °/s`;
      tip.textContent = text;
      tip.style.left = `${(X(r.t) / w) * 100}%`;
      tip.style.top = "12%";
      tip.style.opacity = "1";
      if (live) live.textContent = text;
    };
    canvas.addEventListener("focus", () => showIdx(kidx));
    canvas.addEventListener("blur", () => {
      tip.style.opacity = "0";
    });
    canvas.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
        showIdx(kidx + step);
        ev.preventDefault();
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
        showIdx(kidx - step);
        ev.preventDefault();
      } else if (ev.key === "Home") {
        showIdx(0);
        ev.preventDefault();
      } else if (ev.key === "End") {
        showIdx(raw.length - 1);
        ev.preventDefault();
      }
    });
  }

  /* ---------- 绘图 ---------- */
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
    if (out.length > 8) return out.filter((_, i) => i % 2 === 0);
    return out;
  }

  function fmt(v) {
    const a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 10000 || a < 0.01) return v.toExponential(1);
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    return v.toFixed(2);
  }

  /* min/max 包络降采样：保留尖峰，按 x 顺序输出 */
  function decimate(pts, max) {
    if (pts.length <= max) return pts;
    const bucket = Math.ceil(pts.length / max);
    const out = [];
    for (let i = 0; i < pts.length; i += bucket) {
      const slice = pts.slice(i, i + bucket);
      let lo = slice[0],
        hi = slice[0];
      for (const p of slice) {
        if (p[1] < lo[1]) lo = p;
        if (p[1] > hi[1]) hi = p;
      }
      if (lo[0] <= hi[0]) out.push(lo, hi);
      else out.push(hi, lo);
    }
    return out;
  }

  function path(points, color, width, dash) {
    let d = "";
    points.forEach(([x, y], i) => {
      d += `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width || 1.5}" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  }

  function attachHover(el, meta) {
    const svg = el.querySelector("svg");
    if (!svg) return;
    let tip = el.querySelector(".tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tip";
      el.appendChild(tip);
    }
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "crosshair");
    line.setAttribute("y1", meta.pad.t);
    line.setAttribute("y2", meta.h - meta.pad.b);
    line.setAttribute("x1", meta.pad.l);
    line.setAttribute("x2", meta.pad.l);
    line.setAttribute("opacity", "0");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "hover-dot");
    dot.setAttribute("r", "3");
    dot.setAttribute("opacity", "0");
    svg.appendChild(line);
    svg.appendChild(dot);

    const nearest = (pts, xv) => {
      let lo = 0,
        hi = pts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pts[mid][0] < xv) lo = mid + 1;
        else hi = mid;
      }
      const a = pts[lo],
        b = pts[Math.max(0, lo - 1)];
      return Math.abs(a[0] - xv) <= Math.abs(b[0] - xv) ? a : b;
    };

    const live = document.getElementById("chart-live");
    const showAt = (xv) => {
      const hits = meta.series.map((s) => ({ s, p: nearest(s.points, xv) }));
      const first = hits[0].p;
      const px = meta.X(first[0]);
      line.setAttribute("x1", px);
      line.setAttribute("x2", px);
      line.setAttribute("opacity", "1");
      dot.setAttribute("cx", px);
      dot.setAttribute("cy", meta.yDot ? meta.yDot(first) : meta.Y(first[1]));
      dot.setAttribute("opacity", "1");
      const text = `${meta.xLabel} ${fmt(first[0])} · ` + hits.map((h) => `${h.s.name} ${fmt(h.p[1])}`).join(" · ");
      tip.textContent = text;
      tip.style.left = `${(px / meta.w) * 100}%`;
      tip.style.top = `${Math.max(8, (Number(dot.getAttribute("cy")) / meta.h) * 100 - 4)}%`;
      tip.style.opacity = "1";
      if (live) live.textContent = text;
    };
    const hide = () => {
      tip.style.opacity = "0";
      line.setAttribute("opacity", "0");
      dot.setAttribute("opacity", "0");
    };
    const onMove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      showAt(meta.xInv(frac));
    };

    svg.setAttribute("tabindex", "0");
    let idx = 0;
    const showIdx = (i) => {
      const pts = meta.series[0].points;
      idx = Math.max(0, Math.min(pts.length - 1, i));
      showAt(pts[idx][0]);
    };

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerdown", onMove);
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("focus", () => showIdx(idx));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
        showIdx(idx + 1);
        ev.preventDefault();
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
        showIdx(idx - 1);
        ev.preventDefault();
      } else if (ev.key === "Home") {
        showIdx(0);
        ev.preventDefault();
      } else if (ev.key === "End") {
        showIdx(meta.series[0].points.length - 1);
        ev.preventDefault();
      }
    });
  }

  function plot(el, cfg) {
    const pad = { l: 58, r: 16, t: 28, b: 34 };
    const w = Math.max(el.clientWidth || 640, 320);
    const h = cfg.height || 230;
    const iw = w - pad.l - pad.r,
      ih = h - pad.t - pad.b;
    const tr = (s) => (root.VibeI18n ? root.VibeI18n.translate(s) : s);
    const series = cfg.series
      .map((s) => ({
        ...s,
        name: tr(s.name),
        color: themed(s.color),
        points: decimate(
          s.points.filter((p) => isFinite(p[0]) && isFinite(p[1])),
          1500
        ),
      }))
      .filter((s) => s.points.length > 1 || s.marker);

    if (!series.length) {
      el.innerHTML = "";
      return;
    }

    let xs = [],
      ys = [];
    series.forEach((s) =>
      s.points.forEach(([x, y]) => {
        xs.push(x);
        ys.push(y);
      })
    );

    const logX = !!cfg.logX,
      logY = !!cfg.logY;
    const pos = (a) => a.filter((v) => v > 0);
    let xmin = cfg.xMin !== undefined ? cfg.xMin : logX ? Math.min(...pos(xs)) : Math.min(...xs);
    let xmax = cfg.xMax !== undefined ? cfg.xMax : logX ? Math.max(...pos(xs)) : Math.max(...xs);
    let ymin = cfg.yMin !== undefined ? cfg.yMin : logY ? Math.min(...pos(ys)) : Math.min(...ys);
    let ymax = cfg.yMax !== undefined ? cfg.yMax : logY ? Math.max(...pos(ys)) : Math.max(...ys);

    if (xmax <= xmin) xmax = xmin + 1;
    if (ymax <= ymin) ymax = ymin + 1;
    if (!logY && cfg.yMin === undefined && cfg.yMax === undefined) {
      const padv = (ymax - ymin) * 0.06;
      ymin -= padv;
      ymax += padv;
    }
    if (cfg.equalAspect && !logX && !logY) {
      const xr = xmax - xmin,
        yr = ymax - ymin;
      const targetY = xr * (ih / iw);
      if (yr < targetY) {
        const c = (ymin + ymax) / 2;
        ymin = c - targetY / 2;
        ymax = c + targetY / 2;
      } else {
        const targetX = yr * (iw / ih);
        const c = (xmin + xmax) / 2;
        xmin = c - targetX / 2;
        xmax = c + targetX / 2;
      }
    }

    const lx0 = logX ? Math.log10(xmin) : xmin,
      lx1 = logX ? Math.log10(xmax) : xmax;
    const ly0 = logY ? Math.log10(ymin) : ymin,
      ly1 = logY ? Math.log10(ymax) : ymax;
    const X = (v) => pad.l + (((logX ? Math.log10(v) : v) - lx0) / (lx1 - lx0)) * iw;
    const Y = (v) => pad.t + (1 - ((logY ? Math.log10(v) : v) - ly0) / (ly1 - ly0)) * ih;
    const xInv = (frac) => {
      const v = lx0 + frac * (lx1 - lx0);
      return logX ? Math.pow(10, v) : v;
    };

    const xt = logX ? logTicks(xmin, xmax) : linTicks(xmin, xmax, 5);
    const yt = logY ? logTicks(ymin, ymax) : linTicks(ymin, ymax, 4);

    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${tr(cfg.aria || "数据图")}">`;
    const clipId = "clip" + (el._cid = (el._cid || 0) + 1);
    svg += `<defs><clipPath id="${clipId}"><rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}"/></clipPath></defs>`;

    yt.forEach((v) => {
      const y = Y(v);
      svg += `<line class="grid" x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}"/>`;
      svg += `<text class="tick-label" x="${pad.l - 7}" y="${y + 3}" text-anchor="end">${fmt(v)}</text>`;
    });
    xt.forEach((v) => {
      const x = X(v);
      svg += `<line class="grid" x1="${x}" y1="${pad.t}" x2="${x}" y2="${h - pad.b}"/>`;
      svg += `<text class="tick-label" x="${x}" y="${h - pad.b + 14}" text-anchor="middle">${fmt(v)}</text>`;
    });

    svg += `<line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${h - pad.b}"/>`;
    svg += `<line class="axis" x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}"/>`;
    svg += `<text class="axis-label" x="${w - pad.r}" y="${h - 4}" text-anchor="end">${tr(cfg.xLabel || "")}</text>`;
    svg += `<text class="axis-label" x="${pad.l}" y="${pad.t - 10}">${tr(cfg.yLabel || "")}</text>`;

    svg += `<g clip-path="url(#${clipId})">`;
    const marker = (kind, cx, cy, color, r) => {
      const rr = r || 3.5;
      if (kind === "x") {
        return `<path d="M${cx - rr},${cy - rr} L${cx + rr},${cy + rr} M${cx + rr},${cy - rr} L${cx - rr},${cy + rr}" stroke="${color}" stroke-width="1.7" fill="none"/>`;
      }
      if (kind === "o") {
        return `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${color}"/>`;
    };
    series.forEach((s) => {
      if (s.line !== false && s.points.length > 1) {
        let d = "";
        s.points.forEach(([x, y], i) => {
          d += `${i ? "L" : "M"}${X(x).toFixed(2)},${Y(y).toFixed(2)}`;
        });
        svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.2}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>`;
      }
      if (s.marker) {
        s.points.slice(0, 80).forEach(([x, y]) => {
          svg += marker(s.marker, X(x), Y(y), s.color, s.markerSize);
        });
      }
    });
    svg += `</g>`;

    let total = 0;
    series.forEach((s) => {
      if (s.legend !== false) total += 28 + s.name.length * 11;
    });
    let lx = Math.max(pad.l + 84, w - pad.r - total);
    series.forEach((s) => {
      if (s.legend === false) return;
      if (s.marker) {
        svg += marker(s.marker, lx + 7, pad.t - 14, s.color, 3.2);
      } else {
        svg += `<line x1="${lx}" y1="${pad.t - 18}" x2="${lx + 14}" y2="${pad.t - 18}" stroke="${s.color}" stroke-width="2"/>`;
      }
      svg += `<text class="legend-label" x="${lx + 19}" y="${pad.t - 14}">${s.name}</text>`;
      lx += 28 + s.name.length * 11;
    });

    svg += "</svg>";
    el.innerHTML = svg;
    attachHover(el, {
      w,
      h,
      pad,
      series,
      X,
      yDot: (p) => Y(p[1]),
      xInv,
      xLabel: cfg.xLabel || "x",
      aria: cfg.aria || "",
    });
  }

  const api = {
    plot,
    plotTimeCanvas,
    attachHover,
    path,
    fmt,
    linTicks,
    logTicks,
    niceStep,
    decimate,
    themed,
    lightColor,
  };
  root.IMUChart = api;
})(typeof window !== "undefined" ? window : globalThis);
