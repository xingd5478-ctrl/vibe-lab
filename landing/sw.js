/* vibe-lab service worker: precache shell, offline fallback */
const CACHE = "vibe-lab-v36";
const ASSETS = [
  "./",
  "./index.html",
  "./en/",
  "./en/index.html",
  "./en/lessons.html",
  "./en/guide.html",
  "./style.css",
  "./motion.js",
  "./feedback.html",
  "./preview-imu.png",
  "./preview-imu-dark.png",
  "./preview-control.png",
  "./preview-control-dark.png",
  "./preview-simulink.png",
  "./preview-simulink-dark.png",
  "./preview-simulink-en-dark.png",
  "./preview-simulink-en.png",
  "./preview-control-en-dark.png",
  "./preview-control-en.png",
  "./preview-imu-en-dark.png",
  "./preview-imu-en.png",
  "./robots.txt",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./about/",
  "./about/index.html",
  "./about/matlab-en.html",
  "./about/matlab.html",
  "./about/en.html",
  "./about/style.css",
  "./data/matlab-probes.json",
  "./data/feedback.json",
  "./simulink/lab-kit.js",

  "./404.html",
  "./simulink/guide/t01-t08.js",
  "./simulink/guide/t09-t16.js",
  "./simulink/guide/t17-t24.js",
  "./simulink/guide/t25-t32.js",
  "./simulink/guide/t33-t40.js",
  "./simulink/guide/t41-t43.js",
  "./simulink/guide/examples.js",
  "./simulink/guide/cases.js",
  "./shared/sentry-config.js",
  "./shared/observability.js",
  "./shared/i18n.js",
  "./model/",
  "./model/index.html",
  "./model/style.css",
  "./model/app.js",
  "./model/manual.js",
  "./model/core/data.js",
  "./model/core/quality.js",
  "./model/core/identify.js",
  "./model/core/plants.js",
  "./imu/",
  "./imu/index.html",
  "./imu/style.css",
  "./imu/app.js",
  "./imu/manual-en.js",
  "./imu/manual.js",
  "./imu/data.js",
  "./imu/chart.js",
  "./imu/allan-worker.js",
  "./imu/data-worker.js",
  "./imu/kf-worker.js",
  "./imu/allan.js",
  "./imu/kf.js",
  "./imu/fit.js",
  "./control/",
  "./control/index.html",
  "./control/style.css",
  "./control/chart.js",
  "./control/app.js",
  "./control/labs.js",
  "./control/manual-en.js",
  "./control/manual.js",
  "./simulink/",
  "./simulink/index.html",
  "./simulink/style.css",
  "./simulink/app-core.mjs",
  "./simulink/app-demos.mjs",
  "./simulink/app-ui.mjs",
  "./simulink/course.html",
  "./simulink/course.js",
  "./simulink/lessons.js",
  "./simulink/control.js",
  "./simulink/chart.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS);
      try {
        const res = await fetch("simulink/course-src/manifest.json");
        if (res.ok) {
          const files = await res.json();
          await cache.addAll(files.map((f) => "simulink/course-src/" + f));
        }
        const imgRes = await fetch("simulink/course-img/manifest.json");
        if (imgRes.ok) {
          const imgs = await imgRes.json();
          await Promise.all(imgs.map((f) => cache.add("simulink/course-img/" + f).catch(() => {})));
        }
      } catch (e) {
        /* 课程清单不可用时仍可安装 */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\.csv(\.gz)?$/.test(url.pathname)) return; // 不缓存数据文件

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit || caches.match("./imu/"));
      return hit || network;
    })()
  );
});
