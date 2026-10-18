import { type DeviceInfo, iosSupportsWebPush } from '@/lib/pwa/platform';

/**
 * Qué puede hacer este navegador con web push, antes de mirar permisos:
 *  - 'available': hay service worker, PushManager y Notification.
 *  - 'ios-install-required': iPhone/iPad en Safari. Push existe, pero solo
 *    dentro de la app instalada desde Compartir → Agregar a inicio.
 *  - 'ios-update-required': iOS anterior a 16.4, no hay push web.
 *  - 'unsupported': navegador sin soporte.
 */
export type PushAvailability =
  | 'available'
  | 'ios-install-required'
  | 'ios-update-required'
  | 'unsupported';

export interface PushApis {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
}

export function getPushAvailability(device: DeviceInfo, apis: PushApis): PushAvailability {
  if (device.platform === 'ios') {
    if (device.iosVersion && !iosSupportsWebPush(device.iosVersion)) return 'ios-update-required';
    if (!device.standalone) return 'ios-install-required';
  }
  if (apis.serviceWorker && apis.pushManager && apis.notification) return 'available';
  return 'unsupported';
}

export function readPushApis(): PushApis {
  return {
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
  };
}

/**
 * Estado que ve la persona en /perfil. Se calcula a partir de lo que puede
 * el navegador, si el server tiene VAPID, el permiso y si este dispositivo
 * ya está suscripto.
 */
export type PushStatus =
  | Exclude<PushAvailability, 'available'>
  | 'server-off'
  | 'denied'
  | 'off'
  | 'on';

export function resolvePushStatus(input: {
  availability: PushAvailability;
  serverConfigured: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}): PushStatus {
  if (input.availability !== 'available') return input.availability;
  if (!input.serverConfigured) return 'server-off';
  if (input.permission === 'denied') return 'denied';
  if (input.permission === 'granted' && input.subscribed) return 'on';
  return 'off';
}

/**
 * Convierte la public VAPID key (base64url) al formato que espera
 * `pushManager.subscribe`. Devolvemos un Uint8Array sobre un ArrayBuffer
 * propio (no SharedArrayBuffer) para que TypeScript lo acepte como BufferSource.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * ¿La suscripción existente se hizo con la VAPID key actual? Si las claves
 * del server cambiaron, los pushes a esa suscripción fallan con 403 y hay que
 * suscribirse de nuevo. Si el navegador no expone la key, asumimos que sí.
 */
export function subscriptionMatchesKey(
  applicationServerKey: ArrayBuffer | null | undefined,
  publicKey: string,
): boolean {
  if (!applicationServerKey) return true;
  const current = urlBase64ToUint8Array(publicKey);
  const existing = new Uint8Array(applicationServerKey);
  if (existing.length !== current.length) return false;
  return existing.every((byte, i) => byte === current[i]);
}

/** Mensaje para la persona cuando falla `pushManager.subscribe` u otro paso del navegador. */
export function describeSubscribeError(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return 'El navegador no dio permiso para los avisos.';
  if (name === 'AbortError' || name === 'NetworkError') {
    return 'El servicio de notificaciones no respondió. Probá de nuevo en un rato.';
  }
  if (name === 'InvalidStateError') {
    return 'El navegador quedó en un estado raro. Cerrá Salu, volvé a abrirla y probá de nuevo.';
  }
  return 'No pudimos activar las notificaciones.';
}
