// Service Worker for Cuidarte Pachuca (SICSF)
// Handles background push notifications, notification clicks, and offline persistence.

const CACHE_NAME = 'cuidarte-cache-v1';
const OFFLINE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      }),
    ])
  );
});

// Listen for background push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'Notificación de Cuidarte Pachuca',
    body: 'Tienes una nueva actualización clínica o de guardia.',
    icon: 'https://cuidartepachuca.com/wp-content/uploads/2025/09/cuidarte-pachuca-agencia-de-enfermeria-en-pachuca_.webp',
    badge: 'https://cuidartepachuca.com/wp-content/uploads/2025/09/cuidarte-pachuca-agencia-de-enfermeria-en-pachuca_.webp',
    tag: 'cuidarte-notif-' + Date.now(),
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'https://cuidartepachuca.com/wp-content/uploads/2025/09/cuidarte-pachuca-agencia-de-enfermeria-en-pachuca_.webp',
    badge: data.badge || 'https://cuidartepachuca.com/wp-content/uploads/2025/09/cuidarte-pachuca-agencia-de-enfermeria-en-pachuca_.webp',
    tag: data.tag || 'cuidarte-notification',
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle custom message commands from main thread (e.g. showNotification via Service Worker in background)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        icon: 'https://cuidartepachuca.com/wp-content/uploads/2025/09/cuidarte-pachuca-agencia-de-enfermeria-en-pachuca_.webp',
        badge: 'https://cuidartepachuca.com/wp-content/uploads/2025/09/cuidarte-pachuca-agencia-de-enfermeria-en-pachuca_.webp',
        vibrate: [200, 100, 200],
        ...options,
      })
    );
  }
});

// Handle user clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          if (event.notification.data && event.notification.data.actionType) {
            client.postMessage({
              type: 'NOTIFICATION_ACTION_CLICK',
              actionType: event.notification.data.actionType,
              actionPayload: event.notification.data.actionPayload,
            });
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
