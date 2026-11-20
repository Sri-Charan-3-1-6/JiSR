/* JISR app-shell service worker: offline shell + immutable static assets.
   Live /api/ data is never cached. */
const CACHE = 'jisr-shell-v1';
const SHELL = [
  '/',
  '/about',
  '/resident',
  '/navigator',
  '/health-system',
  '/employer',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];
// App Router client navigations fetch RSC payloads; precache the story routes
// so the guided demo also works offline.
const RSC_ROUTES = [
  '/',
  '/about',
  '/resident',
  '/navigator',
  '/health-system',
  '/employer',
  '/resident/screen/PHQ9',
  '/resident/result/demo-case',
  '/navigator/case/demo-case',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache
          .addAll(SHELL)
          .then(() =>
            Promise.all(
              RSC_ROUTES.map((route) =>
                fetch(route, { headers: { RSC: '1' } }).then((res) => cache.put(route, res)),
              ),
            ),
          ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req, { ignoreVary: true })
            .then((hit) => hit || caches.match('/', { ignoreVary: true })),
        ),
    );
    return;
  }

  if (req.headers.get('RSC') === '1') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          return res;
        })
        .catch(() => caches.match(url.pathname, { ignoreVary: true })),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          }),
      ),
    );
  }
});