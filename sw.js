const release = '11';
const prefix = 'off-work-countdown-v';
const cacheName = prefix + release;
const html = './index.html?v=' + release;
const versioned = [
  './catalog.js', './countdown.js', './hourglass.js', './earnings.js', './work-calendar.js',
  './digits.js', './pig-effects.js', './wallet-client.js', './wallet-rules.js', './cdk-catalog.js',
  './wardrobe.js', './wardrobe.css', './skin-motion.js', './dice.js', './piggy-gold.png',
  './skins/B01.png',
  './skins/B02.png',
  './skins/B03.png',
  './skins/B04.png',
  './skins/B05.png',
  './skins/B06.png',
  './skins/B07.png',
  './skins/B08.png',
  './skins/B09.png',
  './skins/B10.png',
  './skins/B11.png',
  './skins/B12.png',
  './skins/B13.png',
  './skins/B14.png',
  './skins/B15.png',
  './skins/B16.png',
  './skins/B17.png',
  './skins/B18.png',
  './skins/B19.png',
  './skins/B20.png',
  './skins/C01.png',
  './skins/C02.png',
  './skins/C03.png',
  './skins/C04.png',
  './skins/egg-B.png',
  './skins/egg-C.png',
  './skins/egg-G.png',
  './skins/egg-P.png',
  './skins/egg-R.png',
  './skins/machine.png',
  './skins/P01.png',
  './skins/P02.png',
  './skins/P03.png',
  './skins/P04.png',
  './skins/P05.png',
  './skins/P06.png',
  './skins/P07.png',
  './skins/P08.png',
  './skins/P09.png',
  './skins/P10.png',
  './skins/P11.png',
  './skins/P12.png',
  './skins/R01.png',
  './skins/R02.png',
  './skins/R03.png',
  './skins/R04.png',
  './skins/R05.png',
  './skins/R06.png',
];
const assets = [
  html, ...versioned.map(file => file + '?v=' + release),
  './piggy-bank.png', './piggy-tail.png', './coin.png', './manifest.webmanifest', './icon.svg', './off-work.png'
];
const scope = self.registration.scope;
const cacheKeys = new Set(assets.map(file => new URL(file, scope).href));
const entryPaths = [new URL(scope).pathname, new URL('index.html', scope).pathname];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName)
    .then(cache => cache.addAll([...cacheKeys].map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin !== self.location.origin || !entryPaths.includes(url.pathname) || url.searchParams.get('v') === release) continue;
      url.searchParams.set('v', release);
      // Navigation can complete after this worker finishes activating.
      client.navigate(url.href).catch(() => {});
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && entryPaths.includes(url.pathname)) {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw Error('navigation');
      return response;
    }).catch(async () => (await (await caches.open(cacheName)).match(new URL(html, scope))) || Response.error()));
  } else if (cacheKeys.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(request)).then(hit => hit || fetch(request)));
  }
});
