/* Landing motion: scroll progress + interactive hero scope. No dependencies. */
(function () {
  "use strict";
  var noMotion = location.protocol === "file:";
  if (noMotion) document.documentElement.classList.add("no-motion");
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bar = document.querySelector(".scroll-progress");
  if (bar) {
    var queued = false;
    var update = function () {
      queued = false;
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + "%";
    };
    addEventListener(
      "scroll",
      function () {
        if (!queued) {
          queued = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  function track(name) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "event/" + name });
    } catch (e) {}
  }

  document.querySelectorAll(".btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var h = btn.getAttribute("href") || "";
      track(h.indexOf("imu") >= 0 ? "cta-imu" : "cta-simulink");
    });
  });
  document.querySelectorAll("[data-target]").forEach(function (a) {
    a.addEventListener("click", function () {
      track("open-" + a.getAttribute("data-target"));
    });
  });

  var errorSent = false;
  function reportError() {
    if (errorSent) return;
    errorSent = true;
    track("js-error");
  }
  window.addEventListener("error", reportError);
  window.addEventListener("unhandledrejection", reportError);

  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function initReveal() {
    var targets = [];
    document.querySelectorAll(".paths h2, .paths-grid a, .section-head, .card, footer").forEach(function (el) {
      targets.push(el);
    });
    targets.forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.setProperty("--reveal-i", String(i % 6));
    });
    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.classList.add("in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
    );
    targets.forEach(function (el) {
      io.observe(el);
    });
  }

  function initCounters() {
    if (reduced || noMotion) return;
    document.querySelectorAll(".proof b").forEach(function (b) {
      var m = b.textContent.match(/^(\d+)(.*)$/);
      if (!m) return;
      var target = Number(m[1]);
      if (!target) return;
      var suffix = m[2];
      var start = performance.now();
      var dur = 420;
      var tick = function (now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        b.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else b.textContent = target + suffix;
      };
      requestAnimationFrame(tick);
    });
  }

  function initTilt() {
    if (!fine || reduced) return;
    document.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("pointermove", function (ev) {
        var r = card.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width;
        var py = (ev.clientY - r.top) / r.height;
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        card.style.setProperty("--ry", ((px - 0.5) * 5).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - py) * 4).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
    document.querySelectorAll(".btn").forEach(function (btn) {
      btn.addEventListener("pointermove", function (ev) {
        var r = btn.getBoundingClientRect();
        var x = (ev.clientX - (r.left + r.width / 2)) / r.width;
        var y = (ev.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.setProperty("--tx", (x * 3).toFixed(1) + "px");
        btn.style.setProperty("--ty", (y * 2).toFixed(1) + "px");
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.setProperty("--tx", "0px");
        btn.style.setProperty("--ty", "0px");
      });
    });
  }

  initReveal();
  initCounters();
  initTilt();

  var canvas = document.getElementById("scope-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var phase = 0.7;
  var raf = 0;
  var running = false;
  var W = 300,
    H = 64;

  function color() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f4e79";
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var w = W,
      h = H,
      mid = h * 0.55;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--line").trim() || "#d8d3c7";
    ctx.lineWidth = 1;
    for (var gx = 1; gx <= 3; gx++) {
      var xg = (w * gx) / 4;
      ctx.beginPath();
      ctx.moveTo(xg, 2);
      ctx.lineTo(xg, h - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = color();
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (var x = 0; x <= w; x += 1) {
      var y =
        mid +
        Math.sin(x * 0.075 + phase) * 9 +
        Math.sin(x * 0.19 - phase * 1.7) * 3.2 +
        Math.sin(x * 0.61 + phase * 2.3) * 1.1;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    if (!r.width) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(120, Math.round(r.width));
    H = Math.max(40, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function play() {
    if (reduced) return;
    track("scope-replay");
    if (running) return;
    running = true;
    var start = 0;
    var duration = 2600;
    function frame(now) {
      if (!start) start = now;
      phase += 0.045;
      draw();
      if (now - start < duration) raf = requestAnimationFrame(frame);
      else {
        running = false;
        raf = 0;
      }
    }
    raf = requestAnimationFrame(frame);
  }

  var scope = document.getElementById("hero-scope") || canvas;
  scope.addEventListener("pointerenter", play);
  scope.addEventListener("click", play);
  scope.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      play();
    }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    }
  });
  if (window.matchMedia) {
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
    } catch (e) {}
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else addEventListener("resize", resize);
  resize();
})();
