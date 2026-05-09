import { formatDateAr, formatTimeAr } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';
import {
  BREAST_SIDE_LABELS,
  type BreastSide,
  DIAPER_TYPE_LABELS,
  type DiaperType,
  FEEDING_TYPE_LABELS,
  type FeedingType,
  SLEEP_QUALITY_LABELS,
  type SleepQuality,
} from '@/lib/validators/events';
import type { Metadata } from 'next';
import { AutoPrint } from './auto-print';

export const metadata: Metadata = {
  title: 'Resumen para imprimir',
  robots: 'noindex, nofollow',
};

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

interface TimelineRow {
  event_type: 'feeding' | 'sleep' | 'diaper' | 'measurement' | 'note' | 'media';
  id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

function parseDateOrFallback(input: string | undefined, fallback: Date): Date {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return fallback;
  const d = new Date(`${input}T00:00:00`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function formatDay(iso: string): string {
  return formatDateAr(iso, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return formatTimeAr(iso);
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function describeEvent(row: TimelineRow): string {
  if (row.event_type === 'feeding') {
    const type = row.payload.type as FeedingType | undefined;
    const side = row.payload.side as BreastSide | undefined;
    const duration = row.payload.duration_minutes as number | null | undefined;
    const amount = row.payload.amount_ml as number | null | undefined;
    const parts: string[] = [];
    parts.push(type ? FEEDING_TYPE_LABELS[type] : 'Toma');
    if (type === 'breastfeeding' && side) parts.push(BREAST_SIDE_LABELS[side]);
    if (duration) parts.push(`${duration} min`);
    if (amount) parts.push(`${amount} ml`);
    return parts.join(' · ');
  }
  if (row.event_type === 'sleep') {
    const quality = row.payload.quality as SleepQuality | undefined;
    const isNap = row.payload.is_nap as boolean | undefined;
    const startedAt = row.payload.started_at as string | undefined;
    const endedAt = row.payload.ended_at as string | null | undefined;
    const parts: string[] = [isNap ? 'Siesta' : 'Sueño'];
    if (startedAt && endedAt) {
      const min = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
      const dur =
        min < 60
          ? `${min} min`
          : `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`;
      parts.push(dur);
    }
    if (quality) parts.push(SLEEP_QUALITY_LABELS[quality]);
    return parts.join(' · ');
  }
  if (row.event_type === 'diaper') {
    const type = row.payload.type as DiaperType | undefined;
    const parts: string[] = ['Pañal'];
    if (type) parts.push(DIAPER_TYPE_LABELS[type]);
    const photoAnalysis = row.payload.photo_analysis as { alarm?: boolean } | null | undefined;
    if (photoAnalysis?.alarm) parts.push('⚠ Conviene mostrar al pediatra');
    return parts.join(' · ');
  }
  if (row.event_type === 'note') {
    const content = row.payload.content as string | undefined;
    return `Nota: ${content?.slice(0, 200) ?? ''}`;
  }
  if (row.event_type === 'measurement') {
    const w = row.payload.weight_grams as number | null | undefined;
    const h = row.payload.height_cm as number | null | undefined;
    const hc = row.payload.head_circumference_cm as number | null | undefined;
    const parts: string[] = ['Medición'];
    if (w) parts.push(`${w} g`);
    if (h) parts.push(`${h} cm`);
    if (hc) parts.push(`PC ${hc} cm`);
    return parts.join(' · ');
  }
  return row.event_type;
}

/**
 * Vista limpia para imprimir / exportar a PDF un período del timeline.
 * Usa el print-only CSS de globals + el AutoPrint client component que
 * dispara window.print() apenas la página termina de hidratar.
 *
 * Query params:
 *   ?desde=YYYY-MM-DD (default: hace 7 días)
 *   ?hasta=YYYY-MM-DD (default: hoy)
 */
export default async function TimelinePrintPage({ searchParams }: PageProps) {
  const { desde, hasta } = await searchParams;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const fromDate = parseDateOrFallback(desde, weekAgo);
  const toDate = parseDateOrFallback(hasta, today);
  // El usuario puede pasar `hasta` < `desde` por error — swap si pasa.
  const start = fromDate <= toDate ? fromDate : toDate;
  const end = fromDate <= toDate ? toDate : fromDate;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const events: TimelineRow[] = child
    ? (
        (
          await supabase.rpc('get_timeline', {
            p_child_id: child.id,
            p_event_types: ['feeding', 'sleep', 'diaper', 'note', 'measurement'],
            p_from: start.toISOString(),
            p_to: end.toISOString(),
            p_limit: 5000,
            p_offset: 0,
          })
        ).data ?? []
      ).map((r) => ({
        event_type: r.event_type as TimelineRow['event_type'],
        id: r.id,
        occurred_at: r.occurred_at,
        payload: r.payload as Record<string, unknown>,
      }))
    : [];

  // Ordenamos asc para imprimir en orden cronológico natural.
  events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  // Agrupamos por día.
  const byDay = new Map<string, TimelineRow[]>();
  for (const e of events) {
    const k = dayKey(e.occurred_at);
    let arr = byDay.get(k);
    if (!arr) {
      arr = [];
      byDay.set(k, arr);
    }
    arr.push(e);
  }

  // Totales para el header.
  const totals = events.reduce(
    (acc, e) => {
      acc[e.event_type] = (acc[e.event_type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const periodLabel = `Del ${formatDateAr(start, { day: 'numeric', month: 'long', year: 'numeric' })} al ${formatDateAr(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <div
      data-print-area
      className="mx-auto max-w-4xl px-6 py-8 font-sans text-foreground print:px-0 print:py-0"
    >
      <AutoPrint />

      <header className="mb-8 flex flex-col gap-2 border-border border-b pb-4">
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.22em]">
          Salu — resumen
        </span>
        <h1 className="font-display text-3xl text-foreground tracking-tight">
          {child?.name ?? 'Bebé'} · {periodLabel}
        </h1>
        <p className="text-muted-foreground text-sm">
          Total: {events.length} eventos.
          {totals.feeding ? ` ${totals.feeding} tomas.` : ''}
          {totals.sleep ? ` ${totals.sleep} sueños.` : ''}
          {totals.diaper ? ` ${totals.diaper} pañales.` : ''}
          {totals.note ? ` ${totals.note} notas.` : ''}
          {totals.measurement ? ` ${totals.measurement} mediciones.` : ''}
        </p>
      </header>

      {events.length === 0 ? (
        <p className="text-muted-foreground">No hay eventos registrados en este período.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(byDay.entries()).map(([k, rows]) => {
            const first = rows[0];
            if (!first) return null;
            return (
              <section key={k} className="break-inside-avoid">
                <h2 className="mb-2 font-display font-medium text-foreground text-lg tracking-tight">
                  {formatDay(first.occurred_at)}
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {rows.map((row) => (
                    <li
                      key={`${row.event_type}-${row.id}`}
                      className="flex items-baseline gap-3 text-sm leading-snug"
                    >
                      <span className="w-12 shrink-0 font-mono text-muted-foreground tabular-nums">
                        {formatTime(row.occurred_at)}
                      </span>
                      <span className="text-foreground">{describeEvent(row)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <footer className="mt-10 border-border border-t pt-4 text-muted-foreground text-xs italic leading-relaxed">
        Resumen generado por Salu — el lugar de Salustiano. No reemplaza la consulta con el pediatra
        ni interpreta los datos clínicamente.
      </footer>
    </div>
  );
}
