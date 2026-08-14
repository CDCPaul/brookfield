/**
 * Service worker for push notifications.
 *
 * It does nothing else on purpose — no offline caching, no request
 * interception. A cache here would serve stale court availability, which is
 * worse than no app at all when two people are trying to book the same hour.
 */

// A new worker should take over straight away rather than wait for every tab
// to close, or a wording fix would sit unused on the one device that matters.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'BrookSide Bounce',
    body: 'Open the app to see what changed.',
    url: '/',
  };

  let data = fallback;
  try {
    data = { ...fallback, ...(event.data ? event.data.json() : {}) };
  } catch {
    // A payload we cannot read is still worth surfacing: something happened.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      // Replaces an earlier notification about the same booking instead of
      // stacking a second one the reader has to reconcile.
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      requireInteraction: Boolean(data.important),
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        // Reuse a tab that is already open — opening a third copy of the app
        // is how people end up acting on a stale screen.
        for (const client of windows) {
          if (client.url === target && 'focus' in client) return client.focus();
        }
        for (const client of windows) {
          if ('navigate' in client && 'focus' in client) {
            return client.navigate(target).then((c) => c && c.focus());
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
