import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush } from '@/lib/web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Horario activo en Argentina (UTC-3): no molestar fuera de 7-22h. */
function currentHourAr(): number {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }),
  ).getHours();
}

/** Verifica el header de autorización del cron de Vercel. */
function isAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) return true; // dev local sin secret configurado
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hour = currentHourAr();
  if (hour < 7 || hour >= 22) {
    return Response.json({ skipped: 'quiet_hours', hour });
  }

  const admin = createAdminClient();

  // Todos los endpoints activos, agrupados por familia.
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, user_id, family_group_id, endpoint, keys')
    .is('invalidated_at', null);

  if (!subs || subs.length === 0) {
    return Response.json({ sent: 0, reason: 'no_subscriptions' });
  }

  // Mapa family_group_id → [ { userId, subId, endpoint, keys } ]
  type SubRow = {
    id: string;
    user_id: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  const byFamily = new Map<string, SubRow[]>();
  for (const s of subs as Array<SubRow & { family_group_id: string }>) {
    const list = byFamily.get(s.family_group_id) ?? [];
    list.push({
      id: s.id,
      user_id: s.user_id,
      endpoint: s.endpoint,
      keys: s.keys as { p256dh: string; auth: string },
    });
    byFamily.set(s.family_group_id, list);
  }

  // Umbral: si el último evento fue hace menos de 1.5h, no molestamos.
  const THRESHOLD_MS = 1.5 * 3_600_000;
  const thresholdIso = new Date(Date.now() - THRESHOLD_MS).toISOString();

  let totalSent = 0;
  let totalSkipped = 0;

  for (const [familyGroupId, familySubs] of byFamily) {
    // Perfil del bebé para el nombre y childId.
    const { data: child } = await admin
      .from('child_profiles')
      .select('id, name')
      .eq('family_group_id', familyGroupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!child) continue;

    const childId = child.id as string;
    const childName = (child.name as string | undefined) ?? 'Salu';

    // Último evento registrado en cualquier tabla de eventos.
    const [{ data: lastFeeding }, { data: lastSleep }, { data: lastDiaper }] = await Promise.all([
      admin
        .from('feeding_events')
        .select('occurred_at')
        .eq('child_id', childId)
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('sleep_sessions')
        .select('started_at')
        .eq('child_id', childId)
        .is('deleted_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('diaper_events')
        .select('occurred_at')
        .eq('child_id', childId)
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const candidates = [
      lastFeeding?.occurred_at,
      lastSleep?.started_at,
      lastDiaper?.occurred_at,
    ].filter((t): t is string => typeof t === 'string');

    const lastEventAt = candidates.length > 0 ? (candidates.sort().at(-1) ?? null) : null;

    // Si el último evento fue hace menos de 1.5h, la familia está activa — no interrumpir.
    if (lastEventAt && lastEventAt > thresholdIso) {
      totalSkipped++;
      continue;
    }

    // Calculamos cuánto tiempo pasó para personalizar el mensaje.
    const sinceMs = lastEventAt ? Date.now() - new Date(lastEventAt).getTime() : null;
    const sinceLabel = sinceMs
      ? sinceMs < 3_600_000
        ? `${Math.round(sinceMs / 60_000)} min`
        : `${Math.round(sinceMs / 3_600_000)} h`
      : null;

    const body = sinceLabel
      ? `Hace ${sinceLabel} sin registro. ¿Toma, pañal o algo más?`
      : `¿Qué pasó con ${childName} en las últimas horas? Tap para registrar.`;

    // Agrupamos subs por usuario para revisar prefs una vez por user.
    const subsByUser = new Map<string, SubRow[]>();
    for (const sub of familySubs) {
      const list = subsByUser.get(sub.user_id) ?? [];
      list.push(sub);
      subsByUser.set(sub.user_id, list);
    }

    for (const [userId, userSubs] of subsByUser) {
      // Preferencia del usuario — si no tiene fila, el default es ON.
      const { data: prefRow } = await admin
        .from('notification_prefs')
        .select('prefs')
        .eq('user_id', userId)
        .maybeSingle();

      const prefs = prefRow?.prefs as { reminder_2h?: boolean } | null;
      const wantsReminder = prefs?.reminder_2h ?? true;
      if (!wantsReminder) continue;

      for (const sub of userSubs) {
        const result = await sendPush(
          { endpoint: sub.endpoint, keys: sub.keys },
          {
            title: `${childName} — recordatorio`,
            body,
            url: '/home',
            tag: `reminder-${familyGroupId}`,
          },
        );

        if (result.ok) {
          totalSent++;
        } else if (result.gone) {
          await admin
            .from('push_subscriptions')
            .update({ invalidated_at: new Date().toISOString() })
            .eq('id', sub.id);
        }
      }
    }
  }

  return Response.json({ sent: totalSent, skipped: totalSkipped, hour });
}
