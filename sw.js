/* «Своё дело» service worker: офлайн для файлов игры. Запросы к API и CDN не кэшируются. */
const CACHE = 'delo-v2';
const ASSETS = ['./', './index.html', './content.js', './city.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const network = fetch(e.request).then(res => { if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; }).catch(() => cached);
    return cached || network;
  }));
});
