/**
 * Registro del service worker (`public/sw.js`), compartido entre el
 * registrador global y el toggle de notificaciones.
 *
 * En desarrollo lo registramos con `?dev=1`: el SW maneja push igual, pero
 * no cachea nada para no servir chunks viejos encima del hot reload.
 */
export const SERVICE_WORKER_URL = process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw.js?dev=1';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: '/',
      // El navegador siempre revisa sw.js contra la red al buscar updates.
      updateViaCache: 'none',
    });
  } catch {
    // http sin localhost, modo privado de algunos navegadores, etc.
    return null;
  }
}
