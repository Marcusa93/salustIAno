import { Card } from '@/components/ui/card';
import { durationLabel } from '@/lib/baby-age';
import { type Prediction, formatPredictionTime } from '@/lib/predictions';
import { Baby, Milk, Moon, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LastEventsStripProps {
  lastFeedingAt: string | null;
  lastDiaperAt: string | null;
  /**
   * Último sueño cerrado (no incluye el activo). Si hay un sueño activo
   * lo omitimos a propósito: el hero ya muestra el estado "está durmiendo".
   */
  lastSleepClosedAt: string | null;
  todayCounts: { feeding: number; sleep: number; diaper: number };
  /**
   * Predicciones rule-based. Si null, no se muestra el "próxima". El
   * hero ya provee la sugerencia para sueño con wake-windows, así que
   * acá no duplicamos predicción de sueño.
   */
  nextFeeding?: Prediction | null;
  nextDiaper?: Prediction | null;
}

interface CellProps {
  Icon: LucideIcon;
  label: string;
  whenISO: string | null;
  todayCount: number;
  prediction?: Prediction | null;
}

/**
 * Tira con tres celdas — toma, pañal, sueño — mostrando "hace cuánto" en
 * lugar del contador puro y, opcionalmente, una estimación de cuándo
 * viene la próxima ("~17:00"). Cuando no hay registros, queda en
 * silencio ("Sin registros") en vez de "0".
 */
export function LastEventsStrip({
  lastFeedingAt,
  lastDiaperAt,
  lastSleepClosedAt,
  todayCounts,
  nextFeeding,
  nextDiaper,
}: LastEventsStripProps) {
  return (
    <section
      className="animate-stagger-up grid grid-cols-1 gap-3 sm:grid-cols-3"
      style={{ animationDelay: '180ms' }}
    >
      <Cell
        Icon={Milk}
        label="Última toma"
        whenISO={lastFeedingAt}
        todayCount={todayCounts.feeding}
        prediction={nextFeeding}
      />
      <Cell
        Icon={Baby}
        label="Último pañal"
        whenISO={lastDiaperAt}
        todayCount={todayCounts.diaper}
        prediction={nextDiaper}
      />
      <Cell
        Icon={Moon}
        label="Último sueño"
        whenISO={lastSleepClosedAt}
        todayCount={todayCounts.sleep}
      />
    </section>
  );
}

function Cell({ Icon, label, whenISO, todayCount, prediction }: CellProps) {
  const when = whenISO ? `Hace ${durationLabel(whenISO)}` : 'Sin registros';
  const time = whenISO
    ? new Date(whenISO).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null;
  return (
    <Card className="flex flex-col gap-2 border-border/60 bg-gradient-to-b from-card to-muted/15 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
            {label}
          </span>
          <span className="font-medium text-foreground text-sm leading-tight">{when}</span>
          <span className="text-muted-foreground text-xs">
            {time ? `${time} · ` : ''}
            {todayCount > 0 ? `${todayCount} hoy` : 'sin registros hoy'}
          </span>
        </div>
      </div>
      {prediction && (
        <div className="flex items-center gap-1.5 border-border/40 border-t pt-2 text-[11px] text-muted-foreground/90">
          <Sparkles className="size-3 text-primary/70" aria-hidden />
          <span>
            <span className="text-muted-foreground/70">Próxima ~</span>
            <span className="font-medium text-foreground/85 tabular-nums">
              {formatPredictionTime(prediction.expectedAt)}
            </span>
            <span className="text-muted-foreground/70">
              {' '}
              · cada {Math.round((prediction.medianIntervalMinutes / 60) * 10) / 10}h
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}
