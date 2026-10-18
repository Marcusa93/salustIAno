import 'server-only';

import webpush from 'web-push';

import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

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

export interface PushSubscriptionKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface SendPushOptions {
  /** Segundos que el servicio de push guarda el mensaje si el celu está apagado. */
  ttlSeconds?: number;
  /** 'high' despierta al celu aunque esté en ahorro de batería (Apple y FCM lo respetan). */
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

export type SendPushResult =
  | { ok: true }
  | { ok: false; gone: boolean; status: number | null; error: string };

/**
 * Envía una notificación a un endpoint+keys. Devuelve `gone: true` cuando el
 * servicio de push dice que la suscripción ya no existe (404/410) — el caller
 * debería marcarla como invalidated_at.
 */
export async function sendPush(
  subscription: PushSubscriptionKeys,
  payload: SaluPushPayload,
  options: SendPushOptions = {},
): Promise<SendPushResult> {
  if (!ensurePushConfigured()) {
    return { ok: false, gone: false, status: null, error: 'web-push no configurado.' };
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: options.ttlSeconds,
      urgency: options.urgency,
    });
    return { ok: true };
  } catch (err) {
    // web-push usa `statusCode` en sus errores HTTP.
    const status = (err as { statusCode?: number }).statusCode ?? null;
    const message = err instanceof Error ? err.message : 'unknown';
    return { ok: false, gone: isGoneStatus(status), status, error: message };
  }
}

export function isGoneStatus(status: number | null): boolean {
  return status === 404 || status === 410;
}

/**
 * Mensaje para la persona según la respuesta del servicio de push (FCM,
 * Apple, Mozilla). Lo usa el botón "Mandarme una de prueba" de /perfil.
 */
export function describePushFailure(status: number | null): string {
  if (isGoneStatus(status)) {
    return 'Este dispositivo ya no está suscripto. Volvé a activar las notificaciones.';
  }
  if (status === 401 || status === 403) {
    return 'Las claves de notificación cambiaron. Desactivá y volvé a activar los avisos.';
  }
  if (status === 413) return 'La notificación era demasiado grande.';
  if (status === 429) return 'Mandamos demasiadas seguidas. Probá de nuevo en un rato.';
  if (status !== null && status >= 500) {
    return 'El servicio de notificaciones no respondió. Probá de nuevo en un rato.';
  }
  return 'No pudimos entregar la notificación.';
}

/**
 * Manda una notificación a TODOS los miembros activos de una familia,
 * excluyendo opcionalmente un user (el que hizo la acción). Usa el admin
 * client porque lee suscripciones de otras personas.
 *
 * Vive acá (server-only) y no en un archivo 'use server': cualquier export de
 * esos se puede invocar desde el navegador como Server Action, y esta
 * función no debe ser llamable por un cliente.
 */
export async function sendPushToFamily(
  familyGroupId: string,
  payload: SaluPushPayload,
  excludeUserId?: string,
): Promise<{ sent: number; failed: number }> {
  if (!ensurePushConfigured()) return { sent: 0, failed: 0 };

  const adminClient = createAdminClient();
  let query = adminClient
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('family_group_id', familyGroupId)
    .is('invalidated_at', null);
  if (excludeUserId) query = query.neq('user_id', excludeUserId);

  const { data: subs } = await query;
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const s of subs as Array<{ id: string } & PushSubscriptionKeys>) {
    const result = await sendPush({ endpoint: s.endpoint, keys: s.keys }, payload);
    if (result.ok) {
      sent += 1;
      continue;
    }
    failed += 1;
    if (result.gone) {
      await adminClient
        .from('push_subscriptions')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('id', s.id);
    }
  }
  return { sent, failed };
}
