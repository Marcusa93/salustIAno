import { Card } from '@/components/ui/card';
import {
  type AgeExpectations,
  type CompareStatus,
  type ExpectationRange,
  compareToRange,
  progressPercent,
} from '@/lib/baby-expectations';
import { cn } from '@/lib/utils';
import { Baby, Info, Milk, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

interface ExpectationsCardProps {
  /** Rangos esperados según la edad. Si es null, no renderiza nada. */
  expectations: AgeExpectations | null;
  todayCounts: {
    feedingsCount: number;
    diapersCount: number;
    /** Horas totales de sueño hoy (sumando siestas + nocturno cargado). */
    sleepHours: number;
  };
  /**
   * Promedio diario de los últimos 7 días para cada tipo (cantidad
   * de eventos, no horas). Para sueño cuenta sesiones, no horas.
   * Si están en 0, se omite el sublabel "promedio semanal".
   */
  weeklyAverage: {
    feeding: number;
    diaper: number;
    sleep: number;
  };
  /** Triggers reusables del Sheet de cada quick-add — pasados como render-prop. */
  feedingTrigger: ReactElement;
  diaperTrigger: ReactElement;
  sleepTrigger: ReactElement;
}

/**
 * Card "Cómo va el día (vs lo esperado)". Muestra tres barras —
 * tomas, pañales, sueño — con la comparación contra el rango habitual
 * para la edad. El framing está alrededor de la CARGA de eventos, no de
 * la conducta del bebé: si el conteo está bajo, el copy invita a anotar
 * lo que pueda haber faltado, NO sugiere que el bebé esté
 * comiendo/durmiendo poco.
 *
 * No se muestra si no hay edad razonable (recién nacido sin fecha o
 * mayor de 2 años).
 */
function fmtAvg(n: number): string {
  if (n <= 0) return '';
  return n.toFixed(1).replace(/\.0$/, '');
}

export function ExpectationsCard({
  expectations,
  todayCounts,
  weeklyAverage,
  feedingTrigger,
  diaperTrigger,
  sleepTrigger,
}: ExpectationsCardProps) {
  if (!expectations) return null;

  const feedings = compareToRange(todayCounts.feedingsCount, expectations.feedings);
  const diapers = compareToRange(todayCounts.diapersCount, expectations.diapers);
  // Sueño se compara con horas, no eventos. El copy de "low" para sueño
  // tiene un matiz: las siestas no cerradas no suman, así que lo más
  // probable cuando aparece "low" es que falte cerrar una siesta.
  const sleep = compareToRange(Math.round(todayCounts.sleepHours), expectations.sleepHours);

  return (
    <section
      className="animate-stagger-up flex flex-col gap-3"
      style={{ animationDelay: '150ms' }}
      aria-labelledby="day-progress-heading"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="day-progress-heading"
          className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
        >
          Cómo va el día
        </h2>
        <span className="text-muted-foreground/70 text-xs">{expectations.ageLabel}</span>
      </div>

      <Card className="flex flex-col gap-1 border-border/60 bg-gradient-to-b from-card to-muted/15 p-1">
        <ProgressRow
          Icon={Milk}
          label="Tomas"
          actual={todayCounts.feedingsCount}
          actualLabel={String(todayCounts.feedingsCount)}
          range={expectations.feedings}
          status={feedings}
          unit="hoy"
          weeklyAvg={fmtAvg(weeklyAverage.feeding)}
          lowHint="¿Te faltó anotar alguna toma?"
          highHint="Más cargas de las habituales."
          inRangeHint="Vas en el rango."
          actionTrigger={feedingTrigger}
        />
        <Separator />
        <ProgressRow
          Icon={Baby}
          label="Pañales"
          actual={todayCounts.diapersCount}
          actualLabel={String(todayCounts.diapersCount)}
          range={expectations.diapers}
          status={diapers}
          unit="hoy"
          weeklyAvg={fmtAvg(weeklyAverage.diaper)}
          lowHint="¿Te faltó anotar alguno?"
          highHint="Más cargas que lo habitual."
          inRangeHint="Vas en el rango."
          actionTrigger={diaperTrigger}
        />
        <Separator />
        <ProgressRow
          Icon={Moon}
          label="Sueño"
          actual={Math.round(todayCounts.sleepHours)}
          actualLabel={`${todayCounts.sleepHours.toFixed(1)} h`}
          range={expectations.sleepHours}
          status={sleep}
          unit="h hoy"
          weeklyAvg={fmtAvg(weeklyAverage.sleep)}
          weeklyAvgUnit="siestas/día"
          lowHint="¿Falta cerrar alguna siesta?"
          highHint="Más sueño cargado que lo habitual."
          inRangeHint="Vas en el rango."
          actionTrigger={sleepTrigger}
        />
      </Card>

      <div className="flex items-start gap-2 px-1">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          Rangos orientativos según la AAP. Cada bebé es distinto — vos sabés mejor que la tabla.
          Esto te ayuda a no olvidarte de anotar nada, no es un diagnóstico.
        </p>
      </div>
    </section>
  );
}

interface ProgressRowProps {
  Icon: LucideIcon;
  label: string;
  actual: number;
  actualLabel: string;
  range: ExpectationRange;
  status: CompareStatus;
  unit: string;
  /** Promedio diario de los últimos 7 días, formateado como string. */
  weeklyAvg: string;
  /** Unidad del weeklyAvg si difiere del default ("/día"). */
  weeklyAvgUnit?: string;
  lowHint: string;
  inRangeHint: string;
  highHint: string;
  actionTrigger: ReactNode;
}

function ProgressRow({
  Icon,
  label,
  actual,
  actualLabel,
  range,
  status,
  unit,
  weeklyAvg,
  weeklyAvgUnit = '/día',
  lowHint,
  inRangeHint,
  highHint,
  actionTrigger,
}: ProgressRowProps) {
  const pct = progressPercent(actual, range);
  const hint = status === 'low' ? lowHint : status === 'high' ? highHint : inRangeHint;

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full ring-1',
            status === 'in_range'
              ? 'bg-primary/10 text-primary ring-primary/15'
              : status === 'low'
                ? 'bg-accent/40 text-accent-foreground ring-accent/30'
                : 'bg-secondary text-secondary-foreground ring-secondary',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-medium text-foreground text-sm">{label}</span>
            <span className="font-medium text-foreground/90 text-sm tabular-nums">
              {actualLabel}
            </span>
            <span className="text-muted-foreground/80 text-xs">
              de {range.min}–{range.max} {unit}
            </span>
          </div>
          <span
            className={cn(
              'text-[11px]',
              status === 'in_range' ? 'text-muted-foreground' : 'text-foreground/80',
            )}
          >
            {hint}
            {weeklyAvg && (
              <span className="text-muted-foreground/60">
                {' '}
                · prom 7d {weeklyAvg}
                {weeklyAvgUnit}
              </span>
            )}
          </span>
        </div>
        <div className="shrink-0">{actionTrigger}</div>
      </div>
      {/* Barra visual decorativa — los datos cuantitativos ya están en el
          texto de arriba ("X de min–max hoy"), así que la barra es puramente
          presentacional y no necesita role ARIA. */}
      <div aria-hidden className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
            status === 'in_range' ? 'bg-primary/60' : 'bg-primary/35',
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Marca del mínimo razonable, para que la barra muestre el
            "umbral cariñoso" sin parecer una meta dura. */}
        <span
          className="absolute inset-y-0 w-px bg-foreground/20"
          style={{ left: `${(range.min / range.max) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="mx-3 block h-px bg-border/50" />;
}
