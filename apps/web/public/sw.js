/*
 * Minimal service worker for installable PWA support.
 *
 * It deliberately does not cache pages or API responses: the marketplace needs
 * fresh listings, prices and conversations. The fetch listener satisfies the
 * installability requirement while leaving every request on the network.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Network-only by design.
});
