'use client';

import { registerServiceWorker } from '@/lib/pwa/service-worker';
import { useEffect } from 'react';

/**
 * Registra el service worker en todas las páginas (antes solo se registraba
 * al entrar a /perfil, así que la caché offline nunca arrancaba). Esperamos
 * al `load` para no competir con la carga inicial.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (document.readyState === 'complete') {
      void registerServiceWorker();
      return;
    }
    const onLoad = () => void registerServiceWorker();
    window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
