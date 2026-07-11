'use server';

import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { type SaluPushPayload, ensurePushConfigured, sendPush } from '@/lib/web-push';

export interface PushConfig {
  publicKey: string | null;
  isConfigured: boolean;
}

/**
 * Devuelve la public VAPID key para que el cliente la use al suscribirse.
 * Si el admin no configuró VAPID en el env, devuelve null y el cliente
 * muestra un mensaje "no disponible".
 */
export async function getPushConfigAction(): Promise<PushConfig> {
  return {
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    isConfigured: ensurePushConfigured(),
  };
}

interface SerializedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/**
 * Persiste la suscripción del browser para el user actual. Si ya existía
 * una con el mismo endpoint, hacemos upsert (resucita si estaba invalidada).
 */
export async function subscribeUserToPushAction(
  sub: SerializedSubscription,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: 'Suscripción inválida.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membership?.family_group_id) {
    return { ok: false, error: 'No encontramos tu grupo familiar.' };
  }

  // Upsert por endpoint (único globalmente). Si ya existía, actualizamos
  // user_id (por si cambió el dueño del browser) y limpiamos invalidated_at.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userData.user.id,
      family_group_id: membership.family_group_id,
      endpoint: sub.endpoint,
      keys: sub.keys,
      user_agent: sub.userAgent ?? null,
      invalidated_at: null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) return { ok: false, error: 'No pudimos guardar la suscripción.' };
  return { ok: true };
}

export async function unsubscribeUserFromPushAction(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    return { ok: false, error: 'Endpoint inválido.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return { ok: false, error: 'No pudimos remover la suscripción.' };
  return { ok: true };
}

/**
 * Manda una notificación de prueba al usuario actual (todas sus
 * suscripciones activas). Si una falla con 410, la marcamos invalidated_at.
 */
export async function sendTestPushAction(): Promise<
  { ok: true; sent: number } | { ok: false; error: string }
> {
  if (!ensurePushConfigured()) {
    return { ok: false, error: 'Las notificaciones no están configuradas en el servidor.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  const adminClient = createAdminClient();
  const { data: subs } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('user_id', userData.user.id)
    .is('invalidated_at', null);

  if (!subs || subs.length === 0) {
    return { ok: false, error: 'Todavía no tenés ningún device suscripto.' };
  }

  const payload: SaluPushPayload = {
    title: 'Salu',
    body: '¡Funciona! Ya estás recibiendo notificaciones.',
    url: '/home',
    tag: 'salu-test',
  };

  let sent = 0;
  for (const s of subs as Array<{
    id: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>) {
    const result = await sendPush({ endpoint: s.endpoint, keys: s.keys }, payload);
    if (result.ok) {
      sent += 1;
      continue;
    }
    if (result.gone) {
      await adminClient
        .from('push_subscriptions')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('id', s.id);
    }
  }

  if (sent === 0) {
    return { ok: false, error: 'No pudimos entregar la notificación a ningún device.' };
  }
  return { ok: true, sent };
}

/**
 * Helper interno (server-only) para mandar una notificación a TODOS los
 * miembros activos de una familia, excluyendo opcionalmente un user. Útil
 * para "Mamá dejó una nota" — se llamaría desde createNoteAction. No exposto
 * todavía como server action — lo hace el caller cuando triggea el evento.
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
  for (const s of subs as Array<{
    id: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>) {
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
