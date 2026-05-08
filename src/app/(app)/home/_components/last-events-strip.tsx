import { Card } from '@/components/ui/card';
import { durationLabel } from '@/lib/baby-age';
import { Baby, Milk, Moon } from 'lucide-react';
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
}

interface CellProps {
  Icon: LucideIcon;
  label: string;
  whenISO: string | null;
  todayCount: number;
}

/**
 * Tira con tres celdas — toma, pañal, sueño — mostrando "hace cuánto" en
 * lugar del contador puro. Cuando no hay registros, queda en silencio
 * ("Sin registros") en vez de "0".
 *
 * Reemplaza la grilla previa de tres `SummaryCard` con AnimatedCount.
 * Trade: perdimos el conteo grande, ganamos saber cuándo fue lo último —
 * que es la pregunta real que se hace la familia con el bebé encima.
 */
export function LastEventsStrip({
  lastFeedingAt,
  lastDiaperAt,
  lastSleepClosedAt,
  todayCounts,
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
      />
      <Cell
        Icon={Baby}
        label="Último pañal"
        whenISO={lastDiaperAt}
        todayCount={todayCounts.diaper}
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

function Cell({ Icon, label, whenISO, todayCount }: CellProps) {
  const when = whenISO ? `Hace ${durationLabel(whenISO)}` : 'Sin registros';
  const time = whenISO
    ? new Date(whenISO).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <Card className="flex items-center gap-3 border-border/60 bg-gradient-to-b from-card to-muted/15 p-4">
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
    </Card>
  );
}
