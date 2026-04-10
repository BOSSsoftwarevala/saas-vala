/*
 * Service worker kill-switch.
 * Keeps file path stable (/sw.js) so existing clients update to this script,
 * clears old Workbox caches, and unregisters itself.
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch {
        // no-op
      }

      await self.clients.claim();
      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_KILLED' });
      }
    })()
  );
});

self.addEventListener('fetch', () => {
  // Intentionally empty: network should be handled by browser directly.
});
