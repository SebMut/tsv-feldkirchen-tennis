
const BASE = "/tsv-feldkirchen-tennis/";
const CACHE = 'tsv-tennis-public-v5';
const SHELL = [BASE, BASE+'termine/', BASE+'mannschaften/'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(SHELL.map(path => cache.add(path)))));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tsv-tennis-') && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  const isLiveTickerPage = url.pathname.startsWith(BASE+'spieltag/') || url.pathname.startsWith(BASE+'live/');
  if (isLiveTickerPage && request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // No private data, API requests, authenticated admin pages or live-ticker pages are cached.
  if (!url.pathname.startsWith(BASE) || (url.pathname.startsWith(BASE+'admin/') || url.pathname.startsWith(BASE+'verwaltung/'))
      || isLiveTickerPage || url.search || request.mode !== 'navigate') return;
  event.respondWith(fetch(request, { cache: 'no-store' }).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(request).then(response => response || caches.match(BASE))));
});
