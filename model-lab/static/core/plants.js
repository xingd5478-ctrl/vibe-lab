/* Model Lab virtual plants and deterministic step experiments. UMD. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ModelPlants = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PLANTS = {
    thermal: {
      id: "thermal",
      name: "加热器",
      nameEn: "Heater",
      unitIn: "占空比",
      unitInEn: "duty",
      unitOut: "°C",
      unitOutEn: "°C",
      truth: { kind: "FOPDT", K: 1.8, tau: 42, L: 3, y0: 20, amp: 2, uMax: 2.4 },
      fs: 1,
      duration: 420,
      noise: 0.02,
      chirp: { f0: 0.002, f1: 0.03, base: 0.6, amp: 0.4 },
      prbs: { base: 1, amp: 1, hold: 20 },
    },
    motor: {
      id: "motor",
      name: "直流电机",
      nameEn: "DC motor",
      unitIn: "V",
      unitInEn: "V",
      unitOut: "rpm",
      unitOutEn: "rpm",
      truth: { kind: "FOPDT", K: 120, tau: 0.8, L: 0.05, y0: 0, amp: 1, uMax: 3.3 },
      fs: 100,
      duration: 5,
      noise: 1.2,
      chirp: { f0: 0.05, f1: 2, base: 1.6, amp: 1.2 },
      prbs: { base: 1.6, amp: 1.2, hold: 5 },
    },
    spring: {
      id: "spring",
      name: "弹簧-质量-阻尼",
      nameEn: "Mass-spring-damper",
      unitIn: "N",
      unitInEn: "N",
      unitOut: "mm",
      unitOutEn: "mm",
      truth: { kind: "SOPDT", K: 1, zeta: 0.25, wn: 6, L: 0, y0: 0, amp: 1, uMax: 5 },
      fs: 50,
      duration: 5,
      noise: 0.01,
      chirp: { f0: 0.1, f1: 2, base: 0, amp: 1 },
      prbs: { base: 0, amp: 1, hold: 5 },
    },
    mimo: {
      id: "mimo",
      name: "2×2 耦合水箱",
      nameEn: "2×2 coupled tanks",
      unitIn: "流量",
      unitInEn: "flow",
      unitOut: "液位",
      unitOutEn: "level",
      truth: { kind: "MIMO", K: 1, tau: 10, y0: 0, amp: 1, uMax: 2 },
      fs: 10,
      duration: 30,
      noise: 0.005,
      prbs: { base: 0.8, amp: 0.6, hold: 10 },
    },
  };

  function rng(seed) {
    let s = seed >>> 0 || 123456789;
    return function () {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function gauss(r) {
    const u = Math.max(1e-12, r());
    const v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function firstOrder(t, p, stepTime) {
    const out = [];
    for (const x of t) {
      if (x < stepTime) out.push(p.y0);
      else {
        const dt = x - stepTime - p.L;
        out.push(p.y0 + p.K * p.amp * (dt <= 0 ? 0 : 1 - Math.exp(-dt / p.tau)));
      }
    }
    return out;
  }

  function secondOrder(t, p, stepTime) {
    const out = [];
    for (const x of t) {
      if (x < stepTime) out.push(p.y0);
      else {
        const dt = x - stepTime - p.L;
        if (dt <= 0) out.push(p.y0);
        else if (p.zeta < 1) {
          const wd = p.wn * Math.sqrt(1 - p.zeta * p.zeta);
          const e = Math.exp(-p.zeta * p.wn * dt);
          out.push(
            p.y0 +
              p.K *
                p.amp *
                (1 - e * (Math.cos(wd * dt) + (p.zeta / Math.sqrt(1 - p.zeta * p.zeta)) * Math.sin(wd * dt)))
          );
        } else if (Math.abs(p.zeta - 1) < 1e-6) {
          out.push(p.y0 + p.K * p.amp * (1 - Math.exp(-p.wn * dt) * (1 + p.wn * dt)));
        } else {
          const s = Math.sqrt(p.zeta * p.zeta - 1);
          const r1 = -p.wn * (p.zeta - s);
          const r2 = -p.wn * (p.zeta + s);
          out.push(p.y0 + p.K * p.amp * (1 - (r2 * Math.exp(r1 * dt) - r1 * Math.exp(r2 * dt)) / (r2 - r1)));
        }
      }
    }
    return out;
  }

  function virtualStep(opts) {
    const cfg = PLANTS[opts.plant];
    if (!cfg) throw new Error("Unknown plant");
    const fs = Number(opts.fs) || cfg.fs;
    const duration = Number(opts.duration) || cfg.duration;
    const amp = Number(opts.amp);
    const noise = Math.max(0, Number(opts.noise) || 0);
    const n = Math.max(10, Math.round(duration * fs));
    const t = [];
    for (let i = 0; i < n; i++) t.push(i / fs);
    const stepTime = t[Math.max(1, Math.floor(n * 0.12))];
    const applied = Math.min(amp, cfg.truth.uMax);
    const u = t.map((x) => (x < stepTime ? 0 : applied));
    const p = { ...cfg.truth, amp: applied };
    const clean = p.kind === "SOPDT" ? secondOrder(t, p, stepTime) : firstOrder(t, p, stepTime);
    const r = rng(opts.seed || 42);
    const y = clean.map((v) => v + (noise ? gauss(r) * noise : 0));
    return {
      t,
      u,
      y,
      plant: cfg.id,
      truth: { ...p, K: p.K, stepTime },
      meta: {
        units: { u: cfg.unitIn, uEn: cfg.unitInEn, y: cfg.unitOut, yEn: cfg.unitOutEn },
        uMin: 0,
        uMax: cfg.truth.uMax,
        closedLoop: false,
        source: "virtual",
        fs,
        duration,
        noise,
      },
    };
  }

  function simulateInput(cfg, t, u, stepTime) {
    const dt = t[1] - t[0];
    const delay = Math.max(0, Math.round((cfg.truth.L || 0) / dt));
    const y = [];
    if (cfg.truth.kind === "SOPDT") {
      let x = 0,
        v = 0;
      for (let i = 0; i < t.length; i++) {
        const ui = i >= delay ? u[i - delay] : 0;
        const acc =
          cfg.truth.K * cfg.truth.wn * cfg.truth.wn * ui -
          2 * cfg.truth.zeta * cfg.truth.wn * v -
          cfg.truth.wn * cfg.truth.wn * x;
        v += acc * dt;
        x += v * dt;
        y.push(cfg.truth.y0 + x);
      }
    } else {
      let x = 0;
      for (let i = 0; i < t.length; i++) {
        const ui = i >= delay ? u[i - delay] : 0;
        x += (dt / cfg.truth.tau) * (cfg.truth.K * ui - x);
        y.push(cfg.truth.y0 + x);
      }
    }
    return y;
  }

  function chirpInput(cfg, t) {
    const duration = t[t.length - 1];
    const f0 = cfg.chirp ? cfg.chirp.f0 : 0.01;
    const f1 = cfg.chirp ? cfg.chirp.f1 : 0.2;
    const base = cfg.chirp ? cfg.chirp.base : 0;
    const amp = cfg.chirp ? cfg.chirp.amp : 1;
    return t.map((x) => {
      const phase = 2 * Math.PI * (f0 * x + ((f1 - f0) * x * x) / (2 * Math.max(duration, 1e-9)));
      return base + amp * Math.sin(phase);
    });
  }

  function prbsInput(cfg, t, seed) {
    const r = rng(seed || 7);
    const base = cfg.prbs ? cfg.prbs.base : 0;
    const amp = cfg.prbs ? cfg.prbs.amp : 1;
    const hold = cfg.prbs ? cfg.prbs.hold : 10;
    let u = base;
    return t.map((x, i) => {
      if (i % hold === 0) u = base + (r() > 0.5 ? amp : -amp);
      return u;
    });
  }

  function virtualMimo(opts) {
    const cfg = PLANTS.mimo;
    const fs = Number(opts.fs) || cfg.fs;
    const duration = Number(opts.duration) || cfg.duration;
    const n = Math.max(64, Math.round(duration * fs));
    const t = [];
    for (let i = 0; i < n; i++) t.push(i / fs);
    const r = rng(opts.seed || 42);
    const hold = 10;
    const u1 = [],
      u2 = [];
    let a = 0.8,
      b = 0.8;
    for (let i = 0; i < n; i++) {
      if (i % hold === 0) {
        a = r() > 0.5 ? 1.4 : 0.2;
        b = r() > 0.5 ? 1.4 : 0.2;
      }
      u1.push(a);
      u2.push(b);
    }
    const tau1 = 8,
      tau2 = 12;
    let x1 = 0,
      x2 = 0;
    const y1 = [],
      y2 = [];
    const noise = Math.max(0, Number(opts.noise) || 0);
    for (let i = 0; i < n; i++) {
      const dt = 1 / fs;
      x1 += (dt / tau1) * (-x1 + 0.9 * u1[i] + 0.3 * u2[i]);
      x2 += (dt / tau2) * (-x2 + 0.2 * u1[i] + 1.1 * u2[i]);
      y1.push(x1 + (noise ? gauss(r) * noise : 0));
      y2.push(x2 + (noise ? gauss(r) * noise : 0));
    }
    return {
      t,
      u: u1,
      y: y1,
      U: [u1, u2],
      Y: [y1, y2],
      plant: "mimo",
      truth: { ...cfg.truth },
      meta: {
        units: { u: "u1", uEn: "u1", y: "y1", yEn: "y1", u2: "u2", y2: "y2" },
        uMin: Math.min(...u1, ...u2),
        uMax: Math.max(...u1, ...u2),
        closedLoop: false,
        source: "prbs",
        excitation: "prbs",
        fs,
        duration,
        noise,
      },
    };
  }

  function virtualChirp(opts) {
    const cfg = PLANTS[opts.plant];
    if (!cfg) throw new Error("Unknown plant");
    const fs = Number(opts.fs) || (cfg.id === "thermal" ? 5 : 50);
    const duration = Number(opts.duration) || (cfg.id === "thermal" ? 300 : 12);
    const n = Math.max(64, Math.round(duration * fs));
    const t = [];
    for (let i = 0; i < n; i++) t.push(i / fs);
    const u = chirpInput(cfg, t);
    const clean = simulateInput(cfg, t, u, 0);
    const r = rng(opts.seed || 42);
    const noise = Math.max(0, Number(opts.noise) || 0);
    const y = clean.map((v) => v + (noise ? gauss(r) * noise : 0));
    return {
      t,
      u,
      y,
      plant: cfg.id,
      truth: { ...cfg.truth },
      meta: {
        units: { u: cfg.unitIn, uEn: cfg.unitInEn, y: cfg.unitOut, yEn: cfg.unitOutEn },
        uMin: Math.min(...u),
        uMax: Math.max(...u),
        closedLoop: false,
        source: "chirp",
        excitation: "chirp",
        fs,
        duration,
        noise,
      },
    };
  }

  function virtualPRBS(opts) {
    const cfg = PLANTS[opts.plant];
    if (!cfg) throw new Error("Unknown plant");
    const fs = Number(opts.fs) || (cfg.id === "thermal" ? 5 : 50);
    const duration = Number(opts.duration) || (cfg.id === "thermal" ? 300 : 12);
    const n = Math.max(64, Math.round(duration * fs));
    const t = [];
    for (let i = 0; i < n; i++) t.push(i / fs);
    const u = prbsInput(cfg, t, opts.seed || 42);
    const clean = simulateInput(cfg, t, u, 0);
    const r = rng(opts.seed || 42);
    const noise = Math.max(0, Number(opts.noise) || 0);
    const y = clean.map((v) => v + (noise ? gauss(r) * noise : 0));
    return {
      t,
      u,
      y,
      plant: cfg.id,
      truth: { ...cfg.truth },
      meta: {
        units: { u: cfg.unitIn, uEn: cfg.unitInEn, y: cfg.unitOut, yEn: cfg.unitOutEn },
        uMin: Math.min(...u),
        uMax: Math.max(...u),
        closedLoop: false,
        source: "prbs",
        excitation: "prbs",
        fs,
        duration,
        noise,
      },
    };
  }

  function list() {
    return Object.values(PLANTS).map((p) => ({
      id: p.id,
      name: p.name,
      nameEn: p.nameEn,
      unitIn: p.unitIn,
      unitInEn: p.unitInEn,
      unitOut: p.unitOut,
      unitOutEn: p.unitOutEn,
      kind: p.truth.kind,
      defaultAmp: p.truth.amp,
      defaultFs: p.fs,
      defaultDuration: p.duration,
      defaultNoise: p.noise,
    }));
  }

  return { PLANTS, list, virtualStep, virtualChirp, virtualPRBS, virtualMimo };
});
