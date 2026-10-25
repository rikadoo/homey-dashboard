// Service worker: maakt het dashboard installeerbaar en laat de schil laden als de server even weg is.
const CACHE = 'dash-v4';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/i18n.js', '/graphics.js', '/extras.js', '/live.js', '/vendor/sortable/Sortable.min.js', '/vendor/font/index.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/photos/') || url.pathname === '/ws' || url.pathname === '/health') return;
  if (url.pathname.startsWith('/vendor/')) {
    // Iconen en lettertypen: eerst uit de cache
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
    return;
  }
  // App-bestanden: altijd eerst de nieuwste versie proberen, cache als terugval
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request)));
});
