'use server';

import { type PediatricInput, type PediatricSummary, generatePediatricPrep } from '@/lib/ai/agents';
import {
  AIConfigError,
  AIError,
  AINetworkError,
  AIParseError,
  AIProviderError,
  AIValidationError,
} from '@/lib/ai/errors';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_DAYS = [7, 14, 30] as const;
type AllowedDays = (typeof ALLOWED_DAYS)[number];

export type GenerateSummaryResult =
  | { ok: true; summary: PediatricSummary; daysBack: AllowedDays; latencyMs: number }
  | {
      ok: false;
      error: {
        type: 'validation' | 'config' | 'network' | 'provider' | 'parse';
        message: string;
      };
    };

interface TimelineRow {
  event_type: 'feeding' | 'sleep' | 'diaper' | 'measurement' | 'note' | 'media';
  id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

interface SleepRow {
  started_at: string;
  ended_at: string | null;
  is_nap: boolean;
  quality: string | null;
}

interface MeasurementRow {
  measured_at: string;
  weight_grams: number | null;
  height_cm: number | null;
  head_circumference_cm: number | null;
}

interface MilestoneRow {
  title: string;
  due_at: string | null;
  category: string | null;
}

const FEEDING_SAMPLE_LIMIT = 20;
const SLEEP_SAMPLE_LIMIT = 30;
const DIAPER_NOTES_LIMIT = 20;

/**
 * Genera el borrador del resumen pediátrico para el último período.
 *
 * 1. Resuelve user + child desde la sesión Supabase (RLS hace el filtrado).
 * 2. Trae eventos, mediciones y hitos pendientes.
 * 3. Agrega contadores por tipo, totales, samples representativos.
 * 4. Llama al agente pediatric-prep.
 *
 * Importante: la action no acepta childId del cliente — usa el primer
 * child del family group del user actual. RLS garantiza que solo vea
 * datos de su familia.
 */
export async function generatePediatricSummaryAction(
  daysBack: number,
): Promise<GenerateSummaryResult> {
  if (!ALLOWED_DAYS.includes(daysBack as AllowedDays)) {
    return {
      ok: false,
      error: {
        type: 'validation',
        message: 'Período no permitido. Usá 7, 14 o 30 días.',
      },
    };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: { type: 'validation', message: 'Sesión expirada.' } };
  }

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date, is_preterm')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) {
    return {
      ok: false,
      error: {
        type: 'validation',
        message: 'Todavía no hay un perfil de bebé creado.',
      },
    };
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const startedAt = Date.now();

  const [timelineRes, sleepRes, measurementsRes, milestonesRes] = await Promise.all([
    supabase.rpc('get_timeline', {
      p_child_id: child.id,
      p_event_types: ['feeding', 'diaper'],
      p_from: fromDate.toISOString(),
      p_limit: 500,
      p_offset: 0,
    }),
    supabase
      .from('sleep_sessions')
      .select('started_at, ended_at, is_nap, quality')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('started_at', fromDate.toISOString())
      .order('started_at', { ascending: false })
      .limit(SLEEP_SAMPLE_LIMIT * 2),
    supabase
      .from('child_measurements')
      .select('measured_at, weight_grams, height_cm, head_circumference_cm')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('measured_at', fromDate.toISOString())
      .order('measured_at', { ascending: false })
      .limit(10),
    supabase
      .from('medical_milestones')
      .select('title, due_at, category')
      .is('deleted_at', null)
      .is('completed_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(20),
  ]);

  const timeline = (timelineRes.data ?? []) as TimelineRow[];
  const sleeps = (sleepRes.data ?? []) as SleepRow[];
  const measurements = (measurementsRes.data ?? []) as MeasurementRow[];
  const milestones = (milestonesRes.data ?? []) as MilestoneRow[];

  // ---- Feeding ----
  const feedingRows = timeline.filter((r) => r.event_type === 'feeding');
  const feedingByType: Record<string, number> = {};
  let feedingTotalMl = 0;
  let feedingMlCount = 0;
  const feedingSample = feedingRows.slice(0, FEEDING_SAMPLE_LIMIT).map((r) => {
    const p = r.payload;
    const type = (p.type as string | undefined) ?? 'unknown';
    feedingByType[type] = (feedingByType[type] ?? 0) + 1;
    const amount = typeof p.amount_ml === 'number' ? p.amount_ml : null;
    if (amount !== null) {
      feedingTotalMl += amount;
      feedingMlCount += 1;
    }
    return {
      occurred_at: r.occurred_at,
      type,
      amount_ml: amount,
      duration_minutes: typeof p.duration_minutes === 'number' ? p.duration_minutes : null,
      side: (p.side as string | null | undefined) ?? null,
    };
  });
  // counts of types in the rest of the rows
  for (const r of feedingRows.slice(FEEDING_SAMPLE_LIMIT)) {
    const type = (r.payload.type as string | undefined) ?? 'unknown';
    feedingByType[type] = (feedingByType[type] ?? 0) + 1;
  }

  // ---- Sleep ----
  let sleepMinutes = 0;
  for (const s of sleeps) {
    if (s.ended_at) {
      const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
      if (ms > 0) sleepMinutes += Math.floor(ms / 60000);
    }
  }
  const sleepSample = sleeps.slice(0, SLEEP_SAMPLE_LIMIT);

  // ---- Diaper ----
  const diaperRows = timeline.filter((r) => r.event_type === 'diaper');
  const diaperByType: Record<string, number> = {};
  const diaperNotes: string[] = [];
  for (const r of diaperRows) {
    const type = (r.payload.type as string | undefined) ?? 'unknown';
    diaperByType[type] = (diaperByType[type] ?? 0) + 1;
    const notes = r.payload.notes as string | null | undefined;
    if (notes && notes.trim().length > 0 && diaperNotes.length < DIAPER_NOTES_LIMIT) {
      diaperNotes.push(notes.trim());
    }
  }

  const input: PediatricInput = {
    daysBack,
    child: {
      name: child.name as string,
      birth_date: (child.birth_date as string | null) ?? null,
      is_preterm: (child.is_preterm as boolean | null) ?? null,
    },
    period: {
      fromIso: fromDate.toISOString(),
      toIso: now.toISOString(),
    },
    feeding: {
      total: feedingRows.length,
      by_type: feedingByType,
      total_amount_ml: feedingMlCount > 0 ? feedingTotalMl : null,
      sample: feedingSample,
    },
    sleep: {
      total: sleeps.length,
      total_minutes_estimated: sleepMinutes,
      sample: sleepSample,
    },
    diaper: {
      total: diaperRows.length,
      by_type: diaperByType,
      notes_with_content: diaperNotes,
    },
    measurements,
    pending_milestones: milestones,
  };

  try {
    const result = await generatePediatricPrep(input, {
      childId: child.id as string,
      actorUserId: userData.user.id,
    });
    return {
      ok: true,
      summary: result.summary,
      daysBack: daysBack as AllowedDays,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    if (err instanceof AIValidationError) {
      return { ok: false, error: { type: 'validation', message: err.message } };
    }
    if (err instanceof AIConfigError) {
      return {
        ok: false,
        error: { type: 'config', message: 'Falta configurar la IA. Avisale al admin.' },
      };
    }
    if (err instanceof AINetworkError) {
      return {
        ok: false,
        error: { type: 'network', message: 'No pudimos conectar con la IA.' },
      };
    }
    if (err instanceof AIProviderError) {
      return {
        ok: false,
        error: { type: 'provider', message: 'La IA tuvo un problema. Intentá de nuevo.' },
      };
    }
    if (err instanceof AIParseError) {
      return {
        ok: false,
        error: { type: 'parse', message: 'La IA devolvió algo raro. Probá de nuevo.' },
      };
    }
    if (err instanceof AIError) {
      return { ok: false, error: { type: 'provider', message: err.message } };
    }
    return {
      ok: false,
      error: { type: 'provider', message: 'Algo salió mal. Probá de nuevo.' },
    };
  }
}
