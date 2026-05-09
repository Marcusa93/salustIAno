import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDateAr } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { Baby, BookHeart, ChevronLeft, ChevronRight, Milk, Moon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Calendario mensual',
};

interface PageProps {
  searchParams: Promise<{ mes?: string }>;
}

interface TimelineRow {
  event_type: 'feeding' | 'sleep' | 'diaper' | 'measurement' | 'note' | 'media';
  occurred_at: string;
}

interface DayBucket {
  feeding: number;
  sleep: number;
  diaper: number;
  note: number;
  media: number;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Parse param `?mes=YYYY-MM`. Si está vacío o inválido, usa el mes actual.
 * Acepta solo años 2024-2050 (cota razonable para no romper formatos).
 */
function parseMonthParam(param: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (!param || !/^\d{4}-\d{2}$/.test(param)) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [yearStr, monthStr] = param.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (year < 2024 || year > 2050 || month < 1 || month > 12) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year, month };
}

/**
 * Devuelve el rango ISO inclusivo del mes pasado (1° del mes a las 00:00,
 * último día del mes a las 23:59:59.999).
 */
function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999); // day 0 of next month = last day of this month
  return { start, end };
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthShift(year: number, month: number, delta: number): string {
  // Clamp para no salir del rango aceptado.
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default async function TimelineMesPage({ searchParams }: PageProps) {
  const { mes } = await searchParams;
  const { year, month } = parseMonthParam(mes);
  const { start, end } = monthRange(year, month);

  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const events: TimelineRow[] = child
    ? (
        (
          await supabase.rpc('get_timeline', {
            p_child_id: child.id,
            p_from: start.toISOString(),
            p_to: end.toISOString(),
            p_limit: 1500, // generoso — un mes de 5-7 eventos/día = ~150-210
            p_offset: 0,
          })
        ).data ?? []
      ).map((r) => ({
        event_type: r.event_type as TimelineRow['event_type'],
        occurred_at: r.occurred_at,
      }))
    : [];

  // Agrupar por día.
  const byDay = new Map<string, DayBucket>();
  for (const e of events) {
    const k = dateKey(new Date(e.occurred_at));
    let bucket = byDay.get(k);
    if (!bucket) {
      bucket = { feeding: 0, sleep: 0, diaper: 0, note: 0, media: 0 };
      byDay.set(k, bucket);
    }
    if (e.event_type === 'feeding') bucket.feeding += 1;
    else if (e.event_type === 'sleep') bucket.sleep += 1;
    else if (e.event_type === 'diaper') bucket.diaper += 1;
    else if (e.event_type === 'note') bucket.note += 1;
    else if (e.event_type === 'media') bucket.media += 1;
  }

  // Construir grid: la primera fila empieza en lunes, así que rellenamos
  // celdas vacías al inicio (días del mes anterior) y al final.
  // getDay() devuelve 0 (Dom) - 6 (Sáb). Convertimos a 0 (Lun) - 6 (Dom).
  const firstDayWeekIdx = (start.getDay() + 6) % 7;
  const totalDaysInMonth = end.getDate();
  const cellCount = Math.ceil((firstDayWeekIdx + totalDaysInMonth) / 7) * 7;

  const cells: Array<{ date: Date | null; isToday: boolean; bucket: DayBucket | null }> = [];
  const today = new Date();
  const todayKey = dateKey(today);
  for (let i = 0; i < cellCount; i++) {
    const dayNum = i - firstDayWeekIdx + 1;
    if (dayNum < 1 || dayNum > totalDaysInMonth) {
      cells.push({ date: null, isToday: false, bucket: null });
      continue;
    }
    const date = new Date(year, month - 1, dayNum);
    const key = dateKey(date);
    cells.push({
      date,
      isToday: key === todayKey,
      bucket: byDay.get(key) ?? null,
    });
  }

  // Día 15 a midday UTC = no cambia de mes al convertirse a TZ AR.
  // Necesario para que el label muestre el mes correcto cuando corre en
  // Vercel UTC (un Date al primer día del mes a las 00:00 UTC se ve como
  // el último día del mes anterior a las 21:00 AR).
  const monthLabel = capitalize(
    formatDateAr(new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)), {
      month: 'long',
      year: 'numeric',
    }),
  );

  const prevMonth = monthShift(year, month, -1);
  const nextMonth = monthShift(year, month, 1);

  // Totales del mes para mostrar en el header.
  const totals = events.reduce(
    (acc, e) => {
      if (e.event_type === 'feeding') acc.feeding += 1;
      else if (e.event_type === 'sleep') acc.sleep += 1;
      else if (e.event_type === 'diaper') acc.diaper += 1;
      return acc;
    },
    { feeding: 0, sleep: 0, diaper: 0 },
  );

  const description =
    child && events.length > 0
      ? `${events.length} eventos · ${totals.feeding} tomas, ${totals.sleep} sueños, ${totals.diaper} pañales.`
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/timeline' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Registro
      </Button>

      <PageHeader
        eyebrow="Registro · Calendario mensual"
        title={`${monthLabel}.`}
        description={description}
        action={
          <>
            <Button variant="outline" size="icon-sm" render={<Link href={`?mes=${prevMonth}`} />}>
              <ChevronLeft className="size-4" aria-hidden />
              <span className="sr-only">Mes anterior</span>
            </Button>
            <Button variant="outline" size="icon-sm" render={<Link href={`?mes=${nextMonth}`} />}>
              <ChevronRight className="size-4" aria-hidden />
              <span className="sr-only">Mes siguiente</span>
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-1 py-2 text-center font-medium text-[11px] text-muted-foreground uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
          {cells.map((cell, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: cells son grid posicional, idx es el orden estable.
            <DayCell key={idx} cell={cell} />
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
        <Legend Icon={Milk} label="Toma" />
        <Legend Icon={Moon} label="Sueño" />
        <Legend Icon={Baby} label="Pañal" />
        <Legend Icon={BookHeart} label="Nota" />
      </div>
    </div>
  );
}

function DayCell({
  cell,
}: { cell: { date: Date | null; isToday: boolean; bucket: DayBucket | null } }) {
  if (!cell.date) {
    return <div className="aspect-square rounded-lg bg-muted/20" aria-hidden />;
  }
  const total =
    (cell.bucket?.feeding ?? 0) +
    (cell.bucket?.sleep ?? 0) +
    (cell.bucket?.diaper ?? 0) +
    (cell.bucket?.note ?? 0);
  const dayNum = cell.date.getDate();
  return (
    <div
      className={cn(
        'flex aspect-square flex-col gap-0.5 overflow-hidden rounded-lg border p-1.5 transition-colors',
        cell.isToday
          ? 'border-primary/40 bg-primary/5'
          : total > 0
            ? 'border-border/60 bg-card hover:bg-muted/30'
            : 'border-border/30 bg-muted/10',
      )}
      title={cell.bucket ? buildTooltip(cell.bucket) : undefined}
    >
      <span
        className={cn(
          'font-medium text-[11px]',
          cell.isToday ? 'text-primary' : total > 0 ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {dayNum}
      </span>
      {cell.bucket && (
        <div className="flex min-h-0 flex-1 flex-wrap items-end gap-x-1.5 gap-y-0.5">
          {cell.bucket.feeding > 0 && (
            <CellChip Icon={Milk} count={cell.bucket.feeding} tone="bg-primary/15 text-primary" />
          )}
          {cell.bucket.sleep > 0 && (
            <CellChip
              Icon={Moon}
              count={cell.bucket.sleep}
              tone="bg-secondary text-secondary-foreground"
            />
          )}
          {cell.bucket.diaper > 0 && (
            <CellChip
              Icon={Baby}
              count={cell.bucket.diaper}
              tone="bg-accent text-accent-foreground"
            />
          )}
          {cell.bucket.note > 0 && (
            <CellChip
              Icon={BookHeart}
              count={cell.bucket.note}
              tone="bg-muted text-muted-foreground"
            />
          )}
        </div>
      )}
    </div>
  );
}

function CellChip({
  Icon,
  count,
  tone,
}: {
  Icon: typeof Milk;
  count: number;
  tone: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 font-medium text-[9px] tabular-nums sm:text-[10px]',
        tone,
      )}
    >
      <Icon className="size-2.5" aria-hidden />
      {count}
    </span>
  );
}

function Legend({ Icon, label }: { Icon: typeof Milk; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

function buildTooltip(b: DayBucket): string {
  const parts: string[] = [];
  if (b.feeding > 0) parts.push(`${b.feeding} tomas`);
  if (b.sleep > 0) parts.push(`${b.sleep} sueños`);
  if (b.diaper > 0) parts.push(`${b.diaper} pañales`);
  if (b.note > 0) parts.push(`${b.note} notas`);
  if (b.media > 0) parts.push(`${b.media} fotos`);
  return parts.join(' · ');
}
