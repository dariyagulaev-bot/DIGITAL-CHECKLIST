/* VERO — offline service worker.
 *
 * VERO is designed to run with NO network at all. This worker makes the app
 * shell available offline once it has been loaded (or bundled) on the device:
 *   • the core navigation shell is precached on install;
 *   • every same-origin asset is cached on first use (cache-first) so a later
 *     launch works with the network fully off;
 *   • navigations are network-first with an offline fallback to index.html.
 *
 * It never contacts any external origin — all requests are same-origin only.
 * (Application data — users, forms, images, signatures — lives in IndexedDB,
 * not here; this worker only serves the static app.)
 */
const CACHE = 'vero-cache-v2';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Best-effort per item so a single miss never aborts the whole install.
      await Promise.all(
        CORE.map((url) => cache.add(url).catch(() => {}))
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only ever handle same-origin requests — VERO has no external dependencies.
  if (url.origin !== self.location.origin) return;

  // SPA navigations: try network, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('./index.html').then((r) => r || caches.match('./'))
      )
    );
    return;
  }

  // Static assets (JS/CSS/fonts/images): cache-first, then network + cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((resp) => {
          if (resp && resp.ok && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
