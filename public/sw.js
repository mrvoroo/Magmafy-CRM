// Magmafy CRM service worker: makes the installed app open without a connection.
// The build fills in VERSION and PRECACHE (vite.config.ts → prodHtml). API calls (script.google.com) are never cached.
const VERSION = '__BUILD__';
const PRECACHE = [/*__PRECACHE__*/];
const CACHE = 'mg-crm-' + VERSION;
const SHELL = new URL('./', self.registration.scope).href;

self.addEventListener('install', (e) => {
  // Every file of this version, so pages opened for the first time offline still work.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(['./', ...PRECACHE].map((u) => c.add(u).catch(() => {})))));
});

// A new version waits until the user taps «حدّث» (or every tab is closed), so a page in use never loses its files.
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('mg-crm-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first (always the latest page), the saved shell when offline.
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(SHELL, copy)); }
      return res;
    }).catch(() => caches.match(SHELL).then((r) => r || caches.match(new URL('index.html', self.registration.scope).href))));
    return;
  }
  if (/\.(js|css|woff2|svg|png|webp|jpg|webmanifest)$/.test(url.pathname)) {
    // Hashed files never change: cache first.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
