// Reminders Service Worker v2
var CACHE = 'reminders-v2';
var FILES = [
  '/Reminders/',
  '/Reminders/index.html',
  '/Reminders/manifest.json'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request);
    })
  );
});

// Scheduled reminders
var timers = {};

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SCHEDULE') {
    var r = e.data.reminder;
    var delay = e.data.delay;
    if (timers[r.id]) clearTimeout(timers[r.id]);
    if (delay > 0 && delay < 2000000000) {
      timers[r.id] = setTimeout(function() {
        var platform = r.platform === 'wa' ? 'WhatsApp' : 'Instagram';
        var contact  = r.platform === 'wa' ? r.ph : '@' + r.ig;
        self.registration.showNotification('🎉 Time to wish ' + r.name + '!', {
          body: (r.occ || 'Special occasion') + ' · Send via ' + platform + ' to ' + contact,
          tag: 'rm-' + r.id,
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 400],
          data: { id: r.id, platform: r.platform, ph: r.ph, ig: r.ig, msg: r.msg }
        });
        self.clients.matchAll({ type: 'window' }).then(function(clients) {
          clients.forEach(function(c) { c.postMessage({ type: 'DUE', id: r.id }); });
        });
      }, delay);
    }
  }
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var d = e.notification.data;
  if (!d) return;
  var url = d.platform === 'wa'
    ? 'https://wa.me/' + d.ph.replace(/[\s\-\+\(\)]/g,'') + '?text=' + encodeURIComponent(d.msg)
    : 'https://www.instagram.com/' + d.ig + '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      if (clients.length) return clients[0].focus().then(function(c) { return c.navigate(url); });
      return self.clients.openWindow(url);
    })
  );
});
