'use server';

import { type SleepCoachOutput, coachNight } from '@/lib/ai/agents/pediatric-sleep-coach';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { isLateNightAr } from '@/lib/greeting';
import { createClient } from '@/lib/supabase/server';

export type NightCoachResult =
  | { ok: true; output: SleepCoachOutput }
  | { ok: false; reason: 'not_late_night' | 'no_child' | 'session' | 'llm_error' };

/**
 * Lee la situación del bebé a la madrugada y devuelve un diagnóstico
 * armado por el coach pediátrico de sueño.
 *
 * Se invoca client-side desde NightCoachCard cuando la familia abre
 * /home entre 22-06 AR. La card hace cache de 30min en localStorage,
 * así que esta function se llama pocas veces por noche por usuario.
 *
 * Si no estamos en horario nocturno o no hay perfil del bebé, devuelve
 * `ok:false` con un reason claro — la card decide qué mostrar.
 */
export async function getNightCoachAction(): Promise<NightCoachResult> {
  // Gating temporal en el server: aunque la card también chequea,
  // queremos evitar llamadas innecesarias al LLM si alguien hackea el
  // cliente para forzar la pregunta a las 14h.
  if (!isLateNightAr()) {
    return { ok: false, reason: 'not_late_night' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, reason: 'session' };

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, birth_date, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return { ok: false, reason: 'no_child' };

  // Ventana relevante para inputs:
  //   - Última toma / pañal: cualquier registro pasado.
  //   - Sueño activo: el último open (started_at sin ended_at).
  //   - Sueño cerrado más reciente: para saber hace cuánto se despertó.
  //   - Stats últimos 3 días: promedios para tener referencia.
  const since3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [
    { data: lastFeeding },
    { data: lastDiaper },
    { data: activeSleeps },
    { data: lastClosedSleep },
    { data: sleepsLast3d },
  ] = await Promise.all([
    supabase
      .from('feeding_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('diaper_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sleep_sessions')
      .select('started_at, is_nap')
      .eq('child_id', child.id)
      .is('ended_at', null)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(1),
    supabase
      .from('sleep_sessions')
      .select('ended_at, started_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sleep_sessions')
      .select('started_at, ended_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .not('ended_at', 'is', null)
      .gte('started_at', since3d.toISOString())
      .order('started_at', { ascending: true }),
  ]);

  const now = new Date();
  const minutesSince = (iso: string | undefined | null): number | null =>
    iso ? Math.round((now.getTime() - new Date(iso).getTime()) / 60_000) : null;

  const active = (activeSleeps?.[0] ?? null) as { started_at: string; is_nap: boolean } | null;

  // Stats: promedio de duración de sesiones nocturnas (>= 1h, started en
  // ventana 20h-08h AR) + promedio de wake window (gap entre sleep
  // sessions consecutivas).
  const sleepRows = (sleepsLast3d ?? []) as Array<{ started_at: string; ended_at: string }>;
  let avgNightSessionMinutes: number | null = null;
  let avgWakeWindowMinutes: number | null = null;

  if (sleepRows.length > 0) {
    const nightSessions: number[] = [];
    for (const s of sleepRows) {
      const minutes = Math.round(
        (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000,
      );
      if (minutes >= 60) nightSessions.push(minutes);
    }
    if (nightSessions.length > 0) {
      avgNightSessionMinutes = Math.round(
        nightSessions.reduce((a, b) => a + b, 0) / nightSessions.length,
      );
    }
    // Wake windows entre sesiones consecutivas.
    const wakeWindows: number[] = [];
    for (let i = 1; i < sleepRows.length; i++) {
      const prev = sleepRows[i - 1];
      const curr = sleepRows[i];
      if (!prev || !curr) continue;
      const gap = Math.round(
        (new Date(curr.started_at).getTime() - new Date(prev.ended_at).getTime()) / 60_000,
      );
      // Filtramos gaps absurdos (>12h = probablemente cortes de día).
      if (gap > 0 && gap < 720) wakeWindows.push(gap);
    }
    if (wakeWindows.length > 0) {
      avgWakeWindowMinutes = Math.round(
        wakeWindows.reduce((a, b) => a + b, 0) / wakeWindows.length,
      );
    }
  }

  // ISO local AR sin sufijo de timezone — el coach lo lee como
  // referencia visual, no necesita parsearlo.
  const arParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => arParts.find((p) => p.type === t)?.value ?? '';
  const nowAr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;

  const ageDays = babyAgeFromBirth((child.birth_date as string | null) ?? null)?.days ?? null;

  const childIdValue = child.id as string;
  const familyGroupIdValue = child.family_group_id as string | undefined;

  try {
    const result = await coachNight(
      {
        ageDays,
        nowAr,
        lastFeedingMinutesAgo: minutesSince(lastFeeding?.occurred_at as string | null | undefined),
        lastDiaperMinutesAgo: minutesSince(lastDiaper?.occurred_at as string | null | undefined),
        activeSleep: active
          ? {
              startedMinutesAgo: minutesSince(active.started_at) ?? 0,
              isNap: active.is_nap,
            }
          : null,
        lastClosedSleepMinutesAgo: minutesSince(
          (lastClosedSleep?.ended_at as string | null | undefined) ?? null,
        ),
        recentSleepStats: { avgNightSessionMinutes, avgWakeWindowMinutes },
      },
      {
        ...(familyGroupIdValue ? { familyGroupId: familyGroupIdValue } : {}),
        childId: childIdValue,
        actorUserId: userData.user.id,
      },
    );

    return { ok: true, output: result.output };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[getNightCoachAction] coachNight failed:', err);
    }
    return { ok: false, reason: 'llm_error' };
  }
}
