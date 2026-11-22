'use server';

import { formatTimeAr } from '@/lib/format-ar';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { pushEndpointSchema, pushSubscriptionSchema } from '@/lib/validators/push-subscription';
import {
  type PushSubscriptionKeys,
  type SaluPushPayload,
  describePushFailure,
  ensurePushConfigured,
  isGoneStatus,
  sendPush,
} from '@/lib/web-push';

type ActionResult = { ok: true } | { ok: false; error: string };

const UNIQUE_VIOLATION = '23505';

/**
 * Persiste la suscripción del browser para el user actual.
 *
 * No usamos upsert: `push_subscriptions` no tiene policy de UPDATE y un
 * `INSERT ... ON CONFLICT DO UPDATE` choca con RLS justo cuando el endpoint ya
 * existe (volver a activar en el mismo celu). En su lugar reemplazamos:
 * borramos la fila propia con ese endpoint (policy de DELETE) e insertamos
 * una nueva. /perfil la llama también al abrir, para re-sincronizar.
 */
export async function subscribeUserToPushAction(input: unknown): Promise<ActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Suscripción inválida.' };
  const sub = parsed.data;

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

  const row = {
    user_id: userData.user.id,
    family_group_id: membership.family_group_id,
    endpoint: sub.endpoint,
    keys: sub.keys,
    user_agent: sub.userAgent ?? null,
  };

  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  let { error } = await supabase.from('push_subscriptions').insert(row);

  if (error?.code === UNIQUE_VIOLATION) {
    // El endpoint sigue a nombre de otra cuenta: alguien cambió de usuario en
    // este mismo navegador. El endpoint identifica al navegador (y es secreto
    // de él), no a la persona, así que lo liberamos con el admin client —RLS
    // no deja borrar filas ajenas— y reintentamos.
    await createAdminClient().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    ({ error } = await supabase.from('push_subscriptions').insert(row));
  }

  if (error) return { ok: false, error: 'No pudimos guardar la suscripción.' };
  return { ok: true };
}

export async function unsubscribeUserFromPushAction(endpoint: unknown): Promise<ActionResult> {
  const parsed = pushEndpointSchema.safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: 'Endpoint inválido.' };
  const supabase = await createClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data);
  if (error) return { ok: false, error: 'No pudimos remover la suscripción.' };
  return { ok: true };
}

export type TestPushResult =
  | { ok: true; sent: number }
  /** `resubscribe`: la suscripción ya no sirve; hay que volver a activar. */
  | { ok: false; error: string; resubscribe: boolean };

/**
 * Manda una notificación de prueba. Con `endpoint`, solo a ese dispositivo
 * (el que tiene la persona en la mano); sin él, a todos los suyos. Lee con
 * el cliente de la sesión: RLS deja ver solo las suscripciones propias.
 */
export async function sendTestPushAction(endpoint?: unknown): Promise<TestPushResult> {
  if (!ensurePushConfigured()) {
    return {
      ok: false,
      error: 'Las notificaciones no están configuradas en el servidor.',
      resubscribe: false,
    };
  }

  const target = endpoint === undefined ? null : pushEndpointSchema.safeParse(endpoint);
  if (target && !target.success) {
    return { ok: false, error: 'Endpoint inválido.', resubscribe: true };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.', resubscribe: false };

  let query = supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .is('invalidated_at', null);
  if (target) query = query.eq('endpoint', target.data);

  const { data: subs } = await query;
  if (!subs || subs.length === 0) {
    return {
      ok: false,
      error:
        endpoint === undefined
          ? 'Todavía no tenés ningún dispositivo suscripto.'
          : 'Este dispositivo no quedó registrado. Volvé a activar las notificaciones.',
      resubscribe: true,
    };
  }

  const payload: SaluPushPayload = {
    title: 'Salu',
    body: `¡Funciona! Prueba de las ${formatTimeAr(new Date())}.`,
    url: '/perfil',
    tag: 'salu-test',
  };

  let sent = 0;
  let lastStatus: number | null = null;
  for (const s of subs as Array<{ id: string } & PushSubscriptionKeys>) {
    // Urgencia alta y TTL corto: una prueba que llega en 2 horas no sirve.
    const result = await sendPush({ endpoint: s.endpoint, keys: s.keys }, payload, {
      ttlSeconds: 300,
      urgency: 'high',
    });
    if (result.ok) {
      sent += 1;
      continue;
    }
    lastStatus = result.status;
    if (result.gone) {
      await supabase.from('push_subscriptions').delete().eq('id', s.id);
    }
  }

  if (sent === 0) {
    return {
      ok: false,
      error: describePushFailure(lastStatus),
      resubscribe: isGoneStatus(lastStatus) || lastStatus === 401 || lastStatus === 403,
    };
  }
  return { ok: true, sent };
}
