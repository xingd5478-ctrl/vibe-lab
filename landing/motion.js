/* Landing motion: scroll progress + interactive hero scope. No dependencies. */
(function () {
  "use strict";
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bar = document.querySelector(".scroll-progress");
  if (bar) {
    var queued = false;
    var update = function () {
      queued = false;
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + "%";
    };
    addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  var canvas = document.getElementById("scope-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var phase = 0.7;
  var raf = 0;
  var running = false;
  var W = 300, H = 64;

  function color() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f4e79";
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var w = W, h = H, mid = h * 0.55;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--line").trim() || "#d8d3c7";
    ctx.lineWidth = 1;
    for (var gx = 1; gx <= 3; gx++) {
      var xg = (w * gx) / 4;
      ctx.beginPath(); ctx.moveTo(xg, 2); ctx.lineTo(xg, h - 2); ctx.stroke();
    }
    ctx.strokeStyle = color();
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (var x = 0; x <= w; x += 1) {
      var y = mid + Math.sin(x * 0.075 + phase) * 9 + Math.sin(x * 0.19 - phase * 1.7) * 3.2 + Math.sin(x * 0.61 + phase * 2.3) * 1.1;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
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
    if (reduced || running) return;
    running = true;
    var start = 0;
    var duration = 2600;
    function frame(now) {
      if (!start) start = now;
      phase += 0.045;
      draw();
      if (now - start < duration) raf = requestAnimationFrame(frame);
      else { running = false; raf = 0; }
    }
    raf = requestAnimationFrame(frame);
  }

  var scope = document.getElementById("hero-scope") || canvas;
  scope.addEventListener("pointerenter", play);
  scope.addEventListener("click", play);
  scope.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); play(); } });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; running = false; }
  });
  if (window.matchMedia) {
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw); } catch (e) {}
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else addEventListener("resize", resize);
  resize();
})();
