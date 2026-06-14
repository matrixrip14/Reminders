// ── Reminders Service Worker ──
const CACHE_NAME = 'reminders-v1';
const ASSETS = [
  '/Reminders/',
  '/Reminders/index.html',
  '/Reminders/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

const scheduledTimers = {};

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    const { reminder, delay } = e.data;
    const id = reminder.id;
    if (scheduledTimers[id]) clearTimeout(scheduledTimers[id]);
    if (delay > 0 && delay < 2147483647) {
      scheduledTimers[id] = setTimeout(() => {
        fireNotification(reminder);
      }, delay);
    }
  }
});

function fireNotification(r) {
  const platform = r.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram';
  const contact  = r.platform === 'whatsapp' ? r.phone : '@' + r.ig;

  self.registration.showNotification(`🎉 Time to wish ${r.name}!`, {
    body: `${r.occasion || 'Special occasion'} · Send via ${platform} to ${contact}`,
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎉</text></svg>',
    tag: 'reminder-' + r.id,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
    actions: [
      { action: 'open', title: `Open ${platform}` },
      { action: 'dismiss', title: 'Later' }
    ],
    data: { reminder: r }
  });

  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'REMINDER_DUE', id: r.id });
    });
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const r = e.notification.data && e.notification.data.reminder;
  if (!r) return;

  if (e.action === 'open' || !e.action) {
    let url;
    if (r.platform === 'whatsapp') {
      const phone = r.phone.replace(/[\s\-\+\(\)]/g, '');
      url = `https://wa.me/${phone}?text=${encodeURIComponent(r.message)}`;
    } else {
      url = `https://www.instagram.com/${r.ig}/`;
    }
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => client.navigate(url));
          }
        }
        return self.clients.openWindow(url);
      })
    );
  }
});
