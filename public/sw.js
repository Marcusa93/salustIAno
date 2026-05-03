/* eslint-env serviceworker */
/* global self, clients */

/**
 * Service worker mínimo de Salu.
 *
 * Responsabilidades actuales (v1):
 *   1. Recibir push events y mostrar la notificación.
 *   2. Manejar click en notificación → abrir/foco en la app.
 *
 * NO hace caching offline todavía — eso requiere estrategia (workbox o
 * mano) y queremos hacerlo controlado en una iteración aparte.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  /** @type {{ title?: string; body?: string; url?: string; icon?: string; tag?: string }} */
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }

  const title = data.title || 'Salu';
  const options = {
    body: data.body || 'Nueva actividad',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/home' },
    vibrate: [60, 30, 60],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/home';

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Si ya hay una ventana abierta con la app, hacemos focus + navigate.
      for (const c of allClients) {
        if (c.url.includes(self.registration.scope)) {
          await c.focus();
          if ('navigate' in c) {
            try {
              await c.navigate(targetUrl);
            } catch {
              /* navegación no soportada */
            }
          }
          return;
        }
      }
      await clients.openWindow(targetUrl);
    })(),
  );
});
