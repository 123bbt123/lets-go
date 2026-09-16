// Service Worker：让手机把站点当成真正的应用来安装
// 有了它，桌面图标才会用 manifest 里指定的那张，而不是系统自动生成的。
// 策略：页面走网络优先（保证拿到最新版），带 hash 的静态资源走缓存优先（离线也能开）。

const CACHE = 'lets-go-v1';

// 安装时预缓存的少量核心文件
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先，断网时回落到本地页面
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('./index.html').then(r => r || caches.match('./404.html'))
      )
    );
    return;
  }

  // manifest 也走网络优先，避免改了配置拿不到新的
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // 静态资源（文件名带 hash，内容不会变）：缓存优先
  if (/\.(js|css|png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req)
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
