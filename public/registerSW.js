// Legacy compatibility: if old HTML requests /registerSW.js, force-unregister workers.
(function cleanupServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.getRegistrations().then((regs) => {
    return Promise.all(regs.map((reg) => reg.unregister()));
  }).catch(() => {
    // no-op
  });

  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {
      // no-op
    });
  }
})();
