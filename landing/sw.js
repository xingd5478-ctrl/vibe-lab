/* vibe-lab service worker: precache shell, offline fallback */
const CACHE = "vibe-lab-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./robots.txt",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./about/",
  "./about/index.html",
  "./about/style.css",
  "./imu/",
  "./imu/index.html",
  "./imu/style.css",
  "./imu/app.js",
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
  "./control/manual.js",
  "./simulink/",
  "./simulink/index.html",
  "./simulink/style.css",
  "./simulink/app.js",
  "./simulink/course.html",
  "./simulink/course.js",
  "./simulink/lessons.js",
  "./simulink/control.js",
  "./simulink/chart.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
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

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const network = fetch(req)
      .then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => hit || caches.match("./imu/"));
    return hit || network;
  })());
});
