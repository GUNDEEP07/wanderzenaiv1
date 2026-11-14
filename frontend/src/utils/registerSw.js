/**
 * Registers the offline service worker (public/sw.js) in production builds only. It is
 * network-first, so it never changes what an online visitor sees; it only serves the last
 * copy of the app when there is no connection. Failure is harmless and silent.
 */
export function registerServiceWorker(env = import.meta.env) {
  if (!env?.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is optional */ });
  });
}
