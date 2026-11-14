/*
 * WanderZenAI service worker — lets a trip page open without signal.
 *
 * Network first, always: when online every request goes to the network exactly as before,
 * so deploys are never hidden behind a stale cache. Only when the network fails do we fall
 * back to the last copy: the app page (/index.html) for any navigation, and the built
 * /assets/* files (hashed names, so a cached copy is always the right one). API calls,
 * other sites and non-GET requests are never touched; the trip data itself is saved by the
 * page in localStorage.
 */
const CACHE = 'wz-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('wz-shell-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })());
  }
});
