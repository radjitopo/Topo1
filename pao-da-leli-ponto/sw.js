const C = 'leli-ponto-v51';
const assets = ['./', './admin.html', './receitas.html', './api-client.js?v=1', './app-real.js?v=28', './admin-real.js?v=29', './receitas-real.js?v=4', './logo-leli-oficial.jpg?v=2', './favicon-32.png?v=1', './apple-touch-icon.png?v=1', './icon-192.png?v=1', './icon-512.png?v=1', './icon-maskable-512.png?v=1', './manifest.webmanifest?v=5'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(C).then(cache => cache.addAll(assets)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('leli-ponto-') && key !== C).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Sessions, logins and punches must always reach the server.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/leli-api') return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') {
      const page = /^\/admin\/?$/.test(url.pathname) ? './admin.html' : /^\/receitas\/?$/.test(url.pathname) ? './receitas.html' : './';
      const fallback = await caches.match(new URL(page, self.location.href).href);
      if (fallback) return fallback;
    }
    return Response.error();
  }));
});
