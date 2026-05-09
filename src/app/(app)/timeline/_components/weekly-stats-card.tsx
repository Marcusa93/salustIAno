import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Tarjeta de stats semanales: 7 columnas (una por día) con la altura
 * relativa al máximo de la serie. Muestra promedio del período y la
 * comparación de hoy contra el promedio.
 *
 * Es una decisión consciente NO usar una librería de gráficos: con 7
 * barras CSS alcanza, pesa cero KB, y el muted/foreground se ajusta solo
 * a dark/light mode. Cuando crezcan las series (3 meses, 6 meses) ahí
 * sumamos algo más serio.
 */

interface SparklineSeries {
  /** Nombre legible — "Tomas", "Pañales", "Sueño". */
  label: string;
  Icon: LucideIcon;
  /** Conteo por día, índice 0 = hace 6 días, índice 6 = hoy. */
  daily: ReadonlyArray<number>;
  /** Unidad para mostrar en el título de la barra (ej "tomas"). */
  unit?: string;
}

interface WeeklyStatsCardProps {
  series: ReadonlyArray<SparklineSeries>;
}

const DAY_LABELS_AR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Devuelve labels para los últimos 7 días terminando en hoy. Usa la
 * inicial del día (L M X J V S D) en orden cronológico.
 */
function dayLabelsForLast7(): ReadonlyArray<string> {
  const today = new Date();
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // getDay: 0=Dom, 1=Lun, ..., 6=Sáb. Mapeamos a nuestro array L=0.
    const dow = (d.getDay() + 6) % 7;
    out.push(DAY_LABELS_AR[dow] ?? '');
  }
  return out;
}

export function WeeklyStatsCard({ series }: WeeklyStatsCardProps) {
  const totalEvents = series.reduce((acc, s) => acc + s.daily.reduce((a, b) => a + b, 0), 0);
  if (totalEvents === 0) return null;

  const labels = dayLabelsForLast7();
  return (
    <Card className="flex flex-col gap-4 border-border/60 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.18em]">
            Últimos 7 días
          </h2>
          <p className="text-muted-foreground/80 text-xs">
            {totalEvents} eventos · promedio diario de {(totalEvents / 7).toFixed(1)}.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {series.map((s) => (
          <Sparkline key={s.label} series={s} dayLabels={labels} />
        ))}
      </div>
    </Card>
  );
}

interface SparklineProps {
  series: SparklineSeries;
  dayLabels: ReadonlyArray<string>;
}

function Sparkline({ series, dayLabels }: SparklineProps) {
  const total = series.daily.reduce((a, b) => a + b, 0);
  const max = series.daily.reduce((a, b) => Math.max(a, b), 0);
  const today = series.daily[series.daily.length - 1] ?? 0;
  const previousAvg =
    series.daily.length > 1
      ? series.daily.slice(0, -1).reduce((a, b) => a + b, 0) / (series.daily.length - 1)
      : 0;

  // Diferencia hoy vs promedio de los 6 días previos. Solo mostramos el
  // chip de tendencia si la diferencia es ≥1 — evitamos ruido por
  // fluctuaciones de medio evento.
  const delta = today - previousAvg;
  const showTrend = Math.abs(delta) >= 1;
  const isUp = delta > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
            <series.Icon className="size-3.5" aria-hidden />
          </span>
          <span className="font-medium text-foreground text-sm">{series.label}</span>
        </div>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="font-display font-medium text-foreground text-lg leading-none">
            {total}
          </span>
          {showTrend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium text-[10px]',
                isUp
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground ring-1 ring-border/40',
              )}
              title={`Hoy ${today} · promedio previo ${previousAvg.toFixed(1)}`}
            >
              {isUp ? (
                <TrendingUp className="size-2.5" aria-hidden />
              ) : (
                <TrendingDown className="size-2.5" aria-hidden />
              )}
              {isUp ? '+' : ''}
              {delta.toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Sparkline 7 barras */}
      <div className="flex h-12 items-end gap-1.5" aria-hidden>
        {series.daily.map((n, i) => {
          const pct = max > 0 ? (n / max) * 100 : 0;
          const isToday = i === series.daily.length - 1;
          return (
            <div
              key={`${series.label}-${i}-${dayLabels[i]}`}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${dayLabels[i]}: ${n} ${series.unit ?? ''}`.trim()}
            >
              <div
                className={cn(
                  'w-full rounded-sm transition-colors',
                  n === 0
                    ? 'bg-border/30'
                    : isToday
                      ? 'bg-primary'
                      : 'bg-primary/30 hover:bg-primary/50',
                )}
                style={{ height: `${Math.max(pct, n > 0 ? 8 : 4)}%` }}
              />
              <span
                className={cn(
                  'font-medium text-[9px] tabular-nums',
                  isToday ? 'text-primary' : 'text-muted-foreground/70',
                )}
              >
                {dayLabels[i]?.[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
