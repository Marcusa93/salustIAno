import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { WeekSummary } from '../actions';

interface Props {
  current: WeekSummary;
  previous: WeekSummary | null;
}

interface StatCell {
  key: string;
  label: string;
  currentValue: string;
  delta: string | null;
  deltaDir: 'up' | 'down' | null;
}

function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.abs((a - b) / b);
}

function buildCells(current: WeekSummary, previous: WeekSummary | null): StatCell[] {
  const feedDiff =
    previous !== null && pct(current.feedingCountPerDay, previous.feedingCountPerDay) >= 0.05
      ? current.feedingCountPerDay - previous.feedingCountPerDay
      : null;

  const sleepDiff =
    previous !== null && pct(current.sleepHoursPerDay, previous.sleepHoursPerDay) >= 0.05
      ? current.sleepHoursPerDay - previous.sleepHoursPerDay
      : null;

  const mlCurrent = current.feedingMlPerDay;
  const mlPrevious = previous?.feedingMlPerDay ?? null;
  const mlDiff =
    previous !== null &&
    mlCurrent !== null &&
    mlPrevious !== null &&
    pct(mlCurrent, mlPrevious) >= 0.05
      ? mlCurrent - mlPrevious
      : null;

  const diaperDiff =
    previous !== null && pct(current.diaperCountPerDay, previous.diaperCountPerDay) >= 0.05
      ? current.diaperCountPerDay - previous.diaperCountPerDay
      : null;

  return [
    {
      key: 'feedings',
      label: 'Tomas/día',
      currentValue: current.feedingCountPerDay.toFixed(1),
      delta: feedDiff !== null ? `${feedDiff > 0 ? '+' : ''}${feedDiff.toFixed(1)}` : null,
      deltaDir: feedDiff !== null ? (feedDiff > 0 ? 'up' : 'down') : null,
    },
    {
      key: 'sleep',
      label: 'Sueño/día',
      currentValue: `${current.sleepHoursPerDay.toFixed(1)}h`,
      delta: sleepDiff !== null ? `${sleepDiff > 0 ? '+' : ''}${sleepDiff.toFixed(1)}h` : null,
      deltaDir: sleepDiff !== null ? (sleepDiff > 0 ? 'up' : 'down') : null,
    },
    {
      key: 'formula',
      label: 'Fórmula/día',
      currentValue: mlCurrent !== null ? `${mlCurrent}ml` : '—',
      delta: mlDiff !== null ? `${mlDiff > 0 ? '+' : ''}${Math.round(mlDiff)}ml` : null,
      deltaDir: mlDiff !== null ? (mlDiff > 0 ? 'up' : 'down') : null,
    },
    {
      key: 'diapers',
      label: 'Pañales/día',
      currentValue: current.diaperCountPerDay.toFixed(1),
      delta: diaperDiff !== null ? `${diaperDiff > 0 ? '+' : ''}${diaperDiff.toFixed(1)}` : null,
      deltaDir: diaperDiff !== null ? (diaperDiff > 0 ? 'up' : 'down') : null,
    },
  ];
}

export function WeeklyStats({ current, previous }: Props) {
  const cells = buildCells(current, previous);

  return (
    <div className="animate-stagger-up flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
          Últimos 7 días
        </span>
        {previous && (
          <span className="text-[10px] text-muted-foreground/60">vs semana anterior</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {cells.map((cell) => (
          <StatCard key={cell.key} cell={cell} hasPrevious={previous !== null} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ cell, hasPrevious }: { cell: StatCell; hasPrevious: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-card/80 px-3 py-2.5">
      <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">
        {cell.label}
      </span>
      <span className="font-semibold tabular-nums text-xl text-foreground">
        {cell.currentValue}
      </span>
      {cell.delta ? (
        <span
          className={cn(
            'flex items-center gap-0.5 text-[11px]',
            cell.deltaDir === 'up'
              ? 'text-green-600 dark:text-green-400'
              : 'text-muted-foreground',
          )}
        >
          {cell.deltaDir === 'up' ? (
            <TrendingUp className="size-3 shrink-0" aria-hidden />
          ) : (
            <TrendingDown className="size-3 shrink-0" aria-hidden />
          )}
          {cell.delta}
        </span>
      ) : hasPrevious ? (
        <span className="text-[11px] text-muted-foreground/50">sin cambio</span>
      ) : (
        <span className="text-[11px] text-muted-foreground/50">primera semana</span>
      )}
    </div>
  );
}
