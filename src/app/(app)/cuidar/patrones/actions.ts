'use server';

import { findPatterns } from '@/lib/ai/agents/pattern-finder';
import { createClient } from '@/lib/supabase/server';
import { chronologicalAgeDays } from '@/lib/validators/child-profile';

export type PatternsResult =
  | {
      ok: true;
      observations: string[];
      tone: string;
      daysWithData: number;
    }
  | { ok: false; error: string };

const WINDOW_DAYS = 14;

/**
 * Genera 2-4 observaciones descriptivas sobre los últimos 14 días con el
 * bebé. Solo lee datos agregados — el modelo nunca ve eventos individuales.
 *
 * Si no hay perfil del bebé o tenés <3 días con datos, devolvemos un mensaje
 * amable invitando a anotar más.
 */
export async function getPatternsAction(): Promise<PatternsResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Sesión expirada.' };

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date, family_group_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return { ok: false, error: 'Todavía no hay perfil del bebé.' };

  const since = new Date();
  since.setDate(since.getDate() - (WINDOW_DAYS - 1));
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [{ data: sleepRows }, { data: feedingRows }, { data: diaperRows }] = await Promise.all([
    supabase
      .from('sleep_sessions')
      .select('started_at, ended_at, is_nap')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('started_at', sinceIso)
      .order('started_at', { ascending: true }),
    supabase
      .from('feeding_events')
      .select('occurred_at, amount_ml')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: true }),
    supabase
      .from('diaper_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: true }),
  ]);

  // Agregamos por fecha local YYYY-MM-DD.
  const byDate = new Map<
    string,
    {
      feedingCount: number;
      sleepCount: number;
      diaperCount: number;
      sleepDurationsMin: number[];
      feedingMl: number;
    }
  >();

  function ensure(date: string) {
    let bucket = byDate.get(date);
    if (!bucket) {
      bucket = {
        feedingCount: 0,
        sleepCount: 0,
        diaperCount: 0,
        sleepDurationsMin: [],
        feedingMl: 0,
      };
      byDate.set(date, bucket);
    }
    return bucket;
  }

  function dateKey(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  for (const s of (sleepRows ?? []) as Array<{
    started_at: string;
    ended_at: string | null;
  }>) {
    const bucket = ensure(dateKey(s.started_at));
    bucket.sleepCount += 1;
    if (s.ended_at) {
      const dur = Math.round(
        (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
      );
      if (dur > 0 && dur < 60 * 24) bucket.sleepDurationsMin.push(dur);
    }
  }

  for (const f of (feedingRows ?? []) as Array<{ occurred_at: string; amount_ml: number | null }>) {
    const bucket = ensure(dateKey(f.occurred_at));
    bucket.feedingCount += 1;
    if (typeof f.amount_ml === 'number') bucket.feedingMl += f.amount_ml;
  }

  for (const d of (diaperRows ?? []) as Array<{ occurred_at: string }>) {
    const bucket = ensure(dateKey(d.occurred_at));
    bucket.diaperCount += 1;
  }

  // Orden cronológico ascendente.
  const days = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, b]) => ({
      date,
      feedingCount: b.feedingCount,
      sleepCount: b.sleepCount,
      diaperCount: b.diaperCount,
      sleepMinutesAvg:
        b.sleepDurationsMin.length > 0
          ? Math.round(b.sleepDurationsMin.reduce((s, x) => s + x, 0) / b.sleepDurationsMin.length)
          : null,
      sleepMinutesMax: b.sleepDurationsMin.length > 0 ? Math.max(...b.sleepDurationsMin) : null,
      feedingTotalMl: b.feedingMl > 0 ? b.feedingMl : null,
    }));

  if (days.length < 3) {
    return {
      ok: true,
      observations: [
        'Todavía hay pocos días registrados como para sacar tendencias. Anotá unos días más y volvé a mirar.',
      ],
      tone: 'pocos datos',
      daysWithData: days.length,
    };
  }

  try {
    const result = await findPatterns(
      {
        childName: (child.name as string) ?? 'el bebé',
        ageDays: chronologicalAgeDays((child.birth_date as string | null) ?? null),
        days,
      },
      {
        familyGroupId: (child.family_group_id as string) ?? undefined,
        childId: child.id as string,
        actorUserId: userData.user.id,
      },
    );
    return {
      ok: true,
      observations: result.observations,
      tone: result.tone,
      daysWithData: days.length,
    };
  } catch {
    return { ok: false, error: 'No pudimos generar las observaciones. Probá en un rato.' };
  }
}
