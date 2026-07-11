'use client';

import { cn } from '@/lib/utils';
import type { DayStat } from '../actions';

interface Props {
  days: DayStat[];
  avgIntervalHours: number | null;
}

// ---- SVG mini bar chart -------------------------------------------------------
interface BarChartProps {
  data: Array<{ label: string; value: number; isToday: boolean }>;
  max: number;
  height?: number;
  colorClass: string;
  unit: string;
}

function BarChart({ data, max, height = 72, colorClass, unit }: BarChartProps) {
  if (data.length === 0) return null;
  const effectiveMax = max > 0 ? max : 1;
  const barW = 100 / data.length;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className="w-full overflow-visible"
      style={{ height }}
    >
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / effectiveMax) * (height - 8));
        const x = i * barW + barW * 0.1;
        const w = barW * 0.8;
        const y = height - barH;
        return (
          <rect
            key={d.label}
            x={x}
            y={y}
            width={w}
            height={barH}
            rx="1.5"
            className={cn(
              'transition-opacity',
              d.isToday ? colorClass : 'opacity-40',
              !d.isToday && colorClass,
            )}
          />
        );
      })}
    </svg>
  );
}

// ---- Etiquetas de fechas (cada 7 días) ----------------------------------------
function DateLabels({ days }: { days: DayStat[] }) {
  if (days.length === 0) return null;
  const indices = [0, Math.floor(days.length / 2), days.length - 1];
  return (
    <div className="relative flex">
      {days.map((d, i) => {
        if (!indices.includes(i)) return <div key={d.date} className="flex-1" />;
        const [, mm, dd] = d.date.split('-');
        return (
          <div
            key={d.date}
            className={cn(
              'flex-1 text-center text-[9px] text-muted-foreground/60',
              i === days.length - 1 && 'font-medium text-muted-foreground',
            )}
          >
            {dd}/{mm}
          </div>
        );
      })}
    </div>
  );
}

// ---- Componente principal -------------------------------------------------------
export function TrendCharts({ days, avgIntervalHours }: Props) {
  if (days.length < 3) return null;

  const today = days[days.length - 1]?.date ?? '';

  const sleepData = days.map((d) => ({
    label: d.date,
    value: d.sleepHours ?? 0,
    isToday: d.date === today,
  }));
  const feedingData = days.map((d) => ({
    label: d.date,
    value: d.feedingCount,
    isToday: d.date === today,
  }));

  const maxSleep = Math.max(...sleepData.map((d) => d.value), 1);
  const maxFeeding = Math.max(...feedingData.map((d) => d.value), 1);

  const todaySleep = days[days.length - 1]?.sleepHours;
  const todayFeedings = days[days.length - 1]?.feedingCount ?? 0;

  const intervalLabel = avgIntervalHours
    ? avgIntervalHours < 1
      ? `${Math.round(avgIntervalHours * 60)} min`
      : avgIntervalHours % 1 === 0
        ? `${avgIntervalHours}h`
        : `${Math.floor(avgIntervalHours)}h ${Math.round((avgIntervalHours % 1) * 60)}min`
    : null;

  return (
    <div className="animate-stagger-up flex flex-col gap-3">
      <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
        Tendencia — últimos {days.length} días
      </span>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {/* Sueño */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-card/80 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">
              Sueño / día
            </span>
            {todaySleep != null && (
              <span className="font-semibold tabular-nums text-foreground text-sm">
                {todaySleep}h
                <span className="ml-0.5 font-normal text-[10px] text-muted-foreground/60">hoy</span>
              </span>
            )}
          </div>
          <BarChart data={sleepData} max={maxSleep} colorClass="fill-[var(--chart-2)]" unit="h" />
          <DateLabels days={days} />
        </div>

        {/* Tomas */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-card/80 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">
              Tomas / día
            </span>
            <span className="font-semibold tabular-nums text-foreground text-sm">
              {todayFeedings}
              <span className="ml-0.5 font-normal text-[10px] text-muted-foreground/60">hoy</span>
            </span>
          </div>
          <BarChart
            data={feedingData}
            max={maxFeeding}
            colorClass="fill-[var(--chart-1)]"
            unit=""
          />
          <DateLabels days={days} />
        </div>
      </div>

      {/* Intervalo entre tomas */}
      {intervalLabel && (
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/80 px-4 py-3">
          <span className="text-muted-foreground text-sm">Intervalo promedio entre tomas</span>
          <span className="font-semibold tabular-nums text-foreground">{intervalLabel}</span>
        </div>
      )}
    </div>
  );
}
