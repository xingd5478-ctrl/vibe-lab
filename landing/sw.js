/* vibe-lab service worker: precache shell, offline fallback */
const CACHE = "vibe-lab-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./robots.txt",
  "./about/",
  "./about/index.html",
  "./about/style.css",
  "./imu/",
  "./imu/index.html",
  "./imu/style.css",
  "./imu/app.js",
  "./imu/allan.js",
  "./imu/kf.js",
  "./imu/fit.js",
  "./control/",
  "./control/index.html",
  "./control/style.css",
  "./control/app.js",
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

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./imu/"));
    })
  );
});
