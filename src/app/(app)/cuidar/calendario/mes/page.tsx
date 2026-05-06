import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import {
  MILESTONE_CATEGORY_LABELS,
  type MilestoneCategory,
  deriveStatus,
} from '@/lib/validators/milestone';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Calendario · Vista mensual',
};

interface PageProps {
  searchParams: Promise<{ mes?: string }>;
}

interface MilestoneRow {
  id: string;
  title: string;
  category: MilestoneCategory;
  due_at: string | null;
  completed_at: string | null;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const CATEGORY_ICON: Record<MilestoneCategory, typeof Stethoscope> = {
  control_pediatrico: Stethoscope,
  pesquisa: ListChecks,
  estudio: ListChecks,
  vacuna: Syringe,
  otro: CalendarClock,
};

const CATEGORY_TONE: Record<MilestoneCategory, string> = {
  control_pediatrico: 'bg-primary/15 text-primary',
  pesquisa: 'bg-secondary text-secondary-foreground',
  estudio: 'bg-accent text-accent-foreground',
  vacuna: 'bg-destructive/15 text-destructive',
  otro: 'bg-muted text-muted-foreground',
};

function parseMonthParam(param: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (!param || !/^\d{4}-\d{2}$/.test(param)) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [y, m] = param.split('-');
  const year = Number(y);
  const month = Number(m);
  if (year < 2024 || year > 2050 || month < 1 || month > 12) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year, month };
}

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthShift(year: number, month: number, delta: number): string {
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Vista mensual de turnos médicos. Reusa el mismo patrón visual que
 * /timeline/mes pero consume `medical_milestones` en lugar de eventos
 * de timeline. Cada celda muestra hasta 2 turnos del día con su ícono
 * de categoría; el resto se cuenta como "+N" con tooltip.
 */
export default async function CalendarioMesPage({ searchParams }: PageProps) {
  const { mes } = await searchParams;
  const { year, month } = parseMonthParam(mes);
  const { start, end } = monthRange(year, month);

  const supabase = await createClient();
  // Fetch milestones del mes — pendientes y completados, sin borrados.
  const { data: rows } = await supabase
    .from('medical_milestones')
    .select('id, title, category, due_at, completed_at')
    .is('deleted_at', null)
    .gte('due_at', start.toISOString())
    .lte('due_at', end.toISOString())
    .order('due_at', { ascending: true });

  const milestones = (rows ?? []) as MilestoneRow[];

  // Agrupar por día.
  const byDay = new Map<string, MilestoneRow[]>();
  for (const m of milestones) {
    if (!m.due_at) continue;
    const k = dateKey(new Date(m.due_at));
    let arr = byDay.get(k);
    if (!arr) {
      arr = [];
      byDay.set(k, arr);
    }
    arr.push(m);
  }

  // Construir grid: primera fila comienza en lunes.
  const firstDayWeekIdx = (start.getDay() + 6) % 7;
  const totalDaysInMonth = end.getDate();
  const cellCount = Math.ceil((firstDayWeekIdx + totalDaysInMonth) / 7) * 7;
  const today = new Date();
  const todayKey = dateKey(today);

  const cells: Array<{
    date: Date | null;
    isToday: boolean;
    isPast: boolean;
    items: MilestoneRow[];
  }> = [];
  for (let i = 0; i < cellCount; i++) {
    const dayNum = i - firstDayWeekIdx + 1;
    if (dayNum < 1 || dayNum > totalDaysInMonth) {
      cells.push({ date: null, isToday: false, isPast: false, items: [] });
      continue;
    }
    const date = new Date(year, month - 1, dayNum);
    const key = dateKey(date);
    cells.push({
      date,
      isToday: key === todayKey,
      isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      items: byDay.get(key) ?? [],
    });
  }

  const monthLabel = capitalize(
    new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    }),
  );

  const prevMonth = monthShift(year, month, -1);
  const nextMonth = monthShift(year, month, 1);

  // Próximos 3 turnos del mes mostrado, para resumen rápido.
  const upcoming = milestones
    .filter((m) => !m.completed_at && m.due_at && new Date(m.due_at) >= today)
    .slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Button render={<Link href={'/cuidar/calendario' as Route} />} variant="ghost" size="sm">
            <ChevronLeft className="size-4" aria-hidden /> Lista
          </Button>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" render={<Link href={`?mes=${prevMonth}`} />}>
              <ChevronLeft className="size-4" aria-hidden />
              <span className="sr-only">Mes anterior</span>
            </Button>
            <Button variant="outline" size="icon-sm" render={<Link href={`?mes=${nextMonth}`} />}>
              <ChevronRight className="size-4" aria-hidden />
              <span className="sr-only">Mes siguiente</span>
            </Button>
            <Button render={<Link href="/cuidar/calendario/nuevo" />} size="sm" className="ml-1">
              <Plus className="size-4" aria-hidden />
              Agregar
            </Button>
          </div>
        </div>
        <span className="font-medium text-[11px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Calendario · vista mensual
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
          {monthLabel}
        </h1>
        {milestones.length > 0 && (
          <p className="text-muted-foreground">
            {milestones.length} turno{milestones.length === 1 ? '' : 's'} este mes.
          </p>
        )}
      </header>

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
            // biome-ignore lint/suspicious/noArrayIndexKey: grid posicional, idx estable.
            <DayCell key={idx} cell={cell} />
          ))}
        </div>
      </Card>

      {/* Próximos turnos del mes — atajo para no tener que escanear el grid. */}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-sm">Próximos del mes</h2>
          <ul className="flex flex-col gap-2">
            {upcoming.map((m) => (
              <li key={m.id}>
                <UpcomingRow milestone={m} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Leyenda de categorías */}
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
        {(['control_pediatrico', 'pesquisa', 'estudio', 'vacuna', 'otro'] as const).map((cat) => {
          const Icon = CATEGORY_ICON[cat];
          return (
            <span key={cat} className="inline-flex items-center gap-1">
              <span
                className={cn(
                  'inline-flex size-4 items-center justify-center rounded-full',
                  CATEGORY_TONE[cat],
                )}
              >
                <Icon className="size-2.5" aria-hidden />
              </span>
              {MILESTONE_CATEGORY_LABELS[cat]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  cell,
}: {
  cell: {
    date: Date | null;
    isToday: boolean;
    isPast: boolean;
    items: MilestoneRow[];
  };
}) {
  if (!cell.date) {
    return <div className="aspect-square rounded-lg bg-muted/20" aria-hidden />;
  }
  const dayNum = cell.date.getDate();
  const visibleItems = cell.items.slice(0, 2);
  const hiddenCount = cell.items.length - visibleItems.length;

  return (
    <div
      className={cn(
        'flex aspect-square flex-col gap-0.5 overflow-hidden rounded-lg border p-1.5 transition-colors',
        cell.isToday
          ? 'border-primary/40 bg-primary/5'
          : cell.items.length > 0
            ? 'border-border/60 bg-card hover:bg-muted/30'
            : 'border-border/30 bg-muted/10',
        cell.isPast && cell.items.length === 0 && 'opacity-50',
      )}
      title={cell.items.map((m) => m.title).join('\n')}
    >
      <span
        className={cn(
          'font-medium text-[11px]',
          cell.isToday
            ? 'text-primary'
            : cell.items.length > 0
              ? 'text-foreground'
              : 'text-muted-foreground',
        )}
      >
        {dayNum}
      </span>
      {visibleItems.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5">
          {visibleItems.map((m) => {
            const Icon = CATEGORY_ICON[m.category];
            const isDone = m.completed_at !== null;
            return (
              <Link
                key={m.id}
                href={`/cuidar/calendario/${m.id}` as Route}
                className={cn(
                  'inline-flex items-center gap-1 truncate rounded-full px-1 py-0.5 text-[9px] transition-opacity hover:opacity-80 sm:text-[10px]',
                  CATEGORY_TONE[m.category],
                  isDone && 'opacity-50 line-through',
                )}
                title={m.title}
              >
                <Icon className="size-2.5 shrink-0" aria-hidden />
                <span className="truncate">{m.title}</span>
              </Link>
            );
          })}
          {hiddenCount > 0 && (
            <span className="px-1 font-medium text-[9px] text-muted-foreground">
              +{hiddenCount} más
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function UpcomingRow({ milestone }: { milestone: MilestoneRow }) {
  const status = deriveStatus(milestone.due_at, milestone.completed_at);
  const Icon = CATEGORY_ICON[milestone.category];
  const date = milestone.due_at ? new Date(milestone.due_at) : null;
  const dateLabel = date
    ? capitalize(
        date.toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
      )
    : 'Sin fecha';
  const hasTime = date && (date.getHours() !== 0 || date.getMinutes() !== 0);
  const timeLabel = hasTime
    ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <Link
      href={`/cuidar/calendario/${milestone.id}` as Route}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        status === 'overdue'
          ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
          : 'border-border/50 bg-card/40 hover:bg-muted/30',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          CATEGORY_TONE[milestone.category],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-foreground text-sm">{milestone.title}</span>
        <span className="truncate text-muted-foreground text-xs">
          {MILESTONE_CATEGORY_LABELS[milestone.category]} · {dateLabel}
          {timeLabel ? ` · ${timeLabel}` : ''}
        </span>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
    </Link>
  );
}
