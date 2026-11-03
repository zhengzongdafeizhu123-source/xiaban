var CACHE_NAME = 'off-work-countdown-v4';
var ASSETS = [
  '.',
  './index.html',
  './countdown.js',
  './hourglass.js',
  './earnings.js',
  './work-calendar.js',
  './piggy-bank.png',
  './piggy-tail.png',
  './piggy-nose.png',
  './coin.png',
  './manifest.webmanifest',
  './icon.svg',
  './off-work.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
