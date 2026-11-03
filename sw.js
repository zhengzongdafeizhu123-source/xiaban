var CACHE_NAME = 'off-work-countdown-v5';
var ASSETS = [
  './?v=5', './index.html?v=5', './countdown.js?v=5', './hourglass.js?v=5',
  './earnings.js?v=5', './work-calendar.js?v=5',
  './piggy-bank.png', './piggy-tail.png', './piggy-nose.png', './coin.png',
  './manifest.webmanifest', './icon.svg', './off-work.png'
];
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key.indexOf('off-work-countdown-') === 0 && key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); }).then(function () {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (windows) {
      windows.filter(function (client) { return client.url.indexOf(self.registration.scope) === 0; }).forEach(function (client) {
        // Do not await navigation here: fetch must be allowed to run after activation completes.
        var updated = new URL(client.url);
        updated.searchParams.set('v', '5');
        client.navigate(updated.href).catch(function () {});
      });
    })
  );
});
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  var fresh = event.request.mode === 'navigate' || /\.(?:html|js)$/.test(url.pathname);
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      if (!fresh) return cache.match(event.request).then(function (cached) { return cached || fetch(event.request); });
      return fetch(event.request, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('Update fetch failed');
        cache.put(event.request, response.clone()).catch(function () {});
        return response;
      }).catch(function () {
        return cache.match(event.request).then(function (cached) {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return cache.match('./index.html?v=5');
          return Response.error();
        });
      });
    })
  );
});
