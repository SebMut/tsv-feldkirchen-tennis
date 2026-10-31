import type { APIRoute } from 'astro';
const base = import.meta.env.BASE_URL;
const source = `
const BASE = ${JSON.stringify(base)};
const CACHE = 'tsv-tennis-public-v1';
const SHELL = [BASE, BASE+'termine/', BASE+'mannschaften/', BASE+'spieltag/'];
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
  // No private data, API requests or authenticated admin pages are cached.
  if (!url.pathname.startsWith(BASE) || (url.pathname.startsWith(BASE+'admin/') || url.pathname.startsWith(BASE+'verwaltung/'))
      || url.search || request.mode !== 'navigate') return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(request).then(response => response || caches.match(BASE))));
});
`;
export const GET: APIRoute = () => new Response(source, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control':'no-cache' } });
