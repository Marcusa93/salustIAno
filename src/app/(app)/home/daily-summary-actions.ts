'use server';

import { summarizeDay } from '@/lib/ai/agents/daily-summary';
import { endOfTodayAr, startOfTodayAr } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';
import { chronologicalAgeDays } from '@/lib/validators/child-profile';

export type DailySummaryResult =
  | { ok: true; summary: string; highlight: string; eventCount: number }
  | { ok: false; error: string };

/**
 * Genera el resumen narrativo del día para el bebé. Si no hay perfil de bebé
 * o no hay sesión, devuelve un mensaje neutral.
 *
 * El resultado se cachea client-side en localStorage por (childId, date) —
 * el server no persiste nada todavía. Si cambian eventos durante el día, la
 * familia puede tocar "Regenerar" desde la UI.
 */
export async function generateDailySummaryAction(): Promise<DailySummaryResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: 'Sesión expirada.' };
  }

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) {
    return { ok: false, error: 'Todavía no hay perfil del bebé.' };
  }

  // Eventos de hoy en hora Argentina (forzado, no del runtime — en
  // Vercel UTC la medianoche son las 21h AR del día anterior).
  const todayStart = startOfTodayAr();
  const todayEnd = endOfTodayAr();

  // YYYY-MM-DD en hora AR para mostrar al modelo.
  const arParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => arParts.find((p) => p.type === t)?.value ?? '';
  const isoToday = `${get('year')}-${get('month')}-${get('day')}`;

  const [{ data: sleepRows }, { data: feedingRows }, { data: diaperRows }, { data: noteRows }] =
    await Promise.all([
      supabase
        .from('sleep_sessions')
        .select('started_at, ended_at, is_nap, quality')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('started_at', todayStart.toISOString())
        .lte('started_at', todayEnd.toISOString())
        .order('started_at', { ascending: true }),
      supabase
        .from('feeding_events')
        .select('type, occurred_at, duration_minutes, amount_ml')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('occurred_at', todayStart.toISOString())
        .lte('occurred_at', todayEnd.toISOString())
        .order('occurred_at', { ascending: true }),
      supabase
        .from('diaper_events')
        .select('type, occurred_at')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('occurred_at', todayStart.toISOString())
        .lte('occurred_at', todayEnd.toISOString())
        .order('occurred_at', { ascending: true }),
      supabase
        .from('notes')
        .select('content, category, created_at')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .order('created_at', { ascending: true })
        .limit(3),
    ]);

  const sleeps = (sleepRows ?? []).map((s) => {
    const startedAt = s.started_at as string;
    const endedAt = s.ended_at as string | null;
    const durationMinutes =
      endedAt !== null
        ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
        : null;
    return {
      durationMinutes,
      isNap: (s.is_nap as boolean) ?? false,
      quality: (s.quality as string | null) ?? null,
    };
  });

  const feedings = (feedingRows ?? []).map((f) => ({
    type: (f.type as string) ?? 'unknown',
    durationMinutes: (f.duration_minutes as number | null) ?? null,
    amountMl: (f.amount_ml as number | null) ?? null,
  }));

  const diapers = (diaperRows ?? []).map((d) => ({ type: (d.type as string) ?? 'unknown' }));

  const notes = (noteRows ?? []).map((n) => ({
    excerpt: ((n.content as string) ?? '').slice(0, 120),
    mood: (n.category as string | null) ?? null,
  }));

  const eventCount = sleeps.length + feedings.length + diapers.length + notes.length;

  try {
    const result = await summarizeDay(
      {
        childName: (child.name as string) ?? 'el bebé',
        ageDays: chronologicalAgeDays((child.birth_date as string | null) ?? null),
        date: isoToday,
        counts: {
          feeding: feedings.length,
          sleep: sleeps.length,
          diaper: diapers.length,
        },
        details: { sleeps, feedings, diapers, notes },
      },
      {
        familyGroupId: (child.family_group_id as string) ?? undefined,
        childId: child.id as string,
        actorUserId: userData.user.id,
      },
    );
    return {
      ok: true,
      summary: result.summary,
      highlight: result.highlight,
      eventCount,
    };
  } catch (err) {
    // Mensaje al user opaco a propósito (no exponemos detalle de provider).
    // En dev imprimimos la causa al log para que sea debuggable: si el
    // resumen no aparece, el server log dice si fue config (key faltante),
    // network, parse, etc. El logStore.record server-side ya guarda
    // detalle en ai_logs, pero ese viaje a Supabase es asincrónico y no
    // ayuda a Marco mirando la terminal.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[generateDailySummaryAction] summarizeDay failed:', err);
    }
    return { ok: false, error: 'No pudimos generar el resumen ahora. Probá de nuevo en un rato.' };
  }
}
