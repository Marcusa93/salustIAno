'use server';

import { startOfDayArDaysAgo } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';

const AR_TZ = 'America/Argentina/Buenos_Aires';
const DAYS_WINDOW = 7;

export type HeatmapKind = 'feeding' | 'sleep' | 'diaper';

export interface HourlyHeatmapResult {
  ok: boolean;
  /** YYYY-MM-DD del día más antiguo de la ventana, AR. */
  fromDate: string;
  /** YYYY-MM-DD del día más nuevo (hoy AR). */
  toDate: string;
  /** Matriz 7×24: rows[d][h] = cantidad de eventos. d=0 es el día más viejo. */
  matrices: Record<HeatmapKind, number[][]>;
  /** Etiquetas YYYY-MM-DD para cada fila (length=7). */
  dayLabels: string[];
}

/**
 * Devuelve un grid 7d × 24h con la cantidad de tomas, sueños y pañales
 * registrados a cada hora local AR de la última semana. Sirve para ver
 * patrones de cuándo come / duerme / cambia el bebé sin tener que leer
 * timestamps uno por uno.
 *
 * Cada evento se cuenta una sola vez por su `occurred_at` / `started_at`,
 * así que un sueño largo "pertenece" a la hora en que arrancó.
 */
export async function getHourlyHeatmapAction(): Promise<HourlyHeatmapResult | null> {
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) return null;

  // Ventana de 7 días, arrancando 6 días atrás a medianoche AR.
  const since = startOfDayArDaysAgo(DAYS_WINDOW - 1);
  const sinceIso = since.toISOString();

  const [{ data: feedingRows }, { data: sleepRows }, { data: diaperRows }] = await Promise.all([
    supabase
      .from('feeding_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', sinceIso),
    supabase
      .from('sleep_sessions')
      .select('started_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('started_at', sinceIso),
    supabase
      .from('diaper_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', sinceIso),
  ]);

  // Pre-armamos las 7 etiquetas de día (YYYY-MM-DD AR), de más viejo a más nuevo.
  const dayLabels: string[] = [];
  for (let i = DAYS_WINDOW - 1; i >= 0; i -= 1) {
    const d = startOfDayArDaysAgo(i);
    dayLabels.push(formatDateAr(d));
  }
  const dayIndex = new Map(dayLabels.map((label, idx) => [label, idx]));

  const empty = (): number[][] =>
    Array.from({ length: DAYS_WINDOW }, () => Array(24).fill(0) as number[]);

  const matrices: Record<HeatmapKind, number[][]> = {
    feeding: empty(),
    sleep: empty(),
    diaper: empty(),
  };

  const bump = (kind: HeatmapKind, iso: string) => {
    const parts = formatDateHourAr(new Date(iso));
    const row = dayIndex.get(parts.date);
    if (row === undefined) return;
    const col = parts.hour;
    matrices[kind][row]![col] = (matrices[kind][row]![col] ?? 0) + 1;
  };

  for (const r of (feedingRows ?? []) as Array<{ occurred_at: string }>) {
    bump('feeding', r.occurred_at);
  }
  for (const r of (sleepRows ?? []) as Array<{ started_at: string }>) {
    bump('sleep', r.started_at);
  }
  for (const r of (diaperRows ?? []) as Array<{ occurred_at: string }>) {
    bump('diaper', r.occurred_at);
  }

  return {
    ok: true,
    fromDate: dayLabels[0]!,
    toDate: dayLabels[dayLabels.length - 1]!,
    matrices,
    dayLabels,
  };
}

function formatDateAr(d: Date): string {
  // YYYY-MM-DD en hora AR.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function formatDateHourAr(d: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  // Intl puede devolver '24' a medianoche en algunos runtimes — normalizamos.
  const rawHour = Number.parseInt(get('hour'), 10);
  const hour = Number.isFinite(rawHour) ? rawHour % 24 : 0;
  return { date, hour };
}
