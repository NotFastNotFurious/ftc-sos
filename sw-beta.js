// SOS Tool (Beta) — service worker
//
// Only job: satisfy PWA installability (Chrome requires a registered service
// worker) and make the app shell open instantly / work offline-ish. It does
// NOT cache live data. ftcscout API responses, the xlsx CDN script, and the
// GoatCounter beacon are all cross-origin and simply pass straight through —
// this worker never touches them.
//
// Bump CACHE_NAME whenever the precached shell files change so old caches
// get cleaned up. skipWaiting + clients.claim make a new version take over
// immediately on the next load instead of waiting for every open tab to
// close first — given how often "why isn't my change showing up" has come
// up in this project from plain browser/CDN caching, a service worker that
// silently held onto a stale beta.html would be its own new version of that
// same problem, so this deliberately does the opposite: prefer network,
// only fall back to cache when offline.

const CACHE_NAME = 'sos-tool-beta-v1';

const PRECACHE_URLS = [
  './beta.html',
  './manifest-beta.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle our own shell files (same-origin, GET, one of the precached
  // URLs). Everything else — ftcscout/api.ftcscout.org data, the xlsx CDN
  // script, GoatCounter — is left completely alone so it always goes
  // straight to the network with normal browser caching rules.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShellFile = PRECACHE_URLS.some((p) => url.pathname.endsWith(p.replace('./', '/')));
  if (url.origin !== self.location.origin || !isShellFile) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
