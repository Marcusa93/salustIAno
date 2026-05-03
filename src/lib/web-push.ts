import 'server-only';

import webpush from 'web-push';

import { env } from '@/lib/env';

let configured = false;

/**
 * Configura web-push con los VAPID keys del env. Idempotente — si ya
 * estaba configurado, no hace nada. Llamar antes de cualquier sendNotification.
 *
 * Si las keys no están seteadas, devuelve false y el caller debería abortar
 * con un mensaje "el admin todavía no configuró las notificaciones".
 */
export function ensurePushConfigured(): boolean {
  if (configured) return true;
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(
    `mailto:${env.VAPID_EMAIL}`,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

export interface SaluPushPayload {
  title: string;
  body: string;
  /** URL relativa para abrir al hacer click. Default '/home'. */
  url?: string;
  /** Tag para coalescencia (mismo tag = reemplaza notificación previa). */
  tag?: string;
}

/**
 * Envía una notificación a un endpoint+keys. Devuelve `gone: true` cuando el
 * navegador rechaza con 410 (suscripción inválida) — el caller debería
 * marcar la subscription como invalidated_at.
 */
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: SaluPushPayload,
): Promise<{ ok: true } | { ok: false; gone: boolean; error: string }> {
  if (!ensurePushConfigured()) {
    return { ok: false, gone: false, error: 'web-push no configurado.' };
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    // web-push usa `statusCode` en sus errores HTTP.
    const status = (err as { statusCode?: number }).statusCode;
    const message = err instanceof Error ? err.message : 'unknown';
    return { ok: false, gone: status === 404 || status === 410, error: message };
  }
}
