import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  MILESTONE_CATEGORY_LABELS,
  type MilestoneCategory,
  deriveStatus,
} from '@/lib/validators/milestone';
import { AlertCircle, CalendarClock, ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

interface UpcomingControlsCardProps {
  rows: Array<{
    id: string;
    title: string;
    category: MilestoneCategory;
    due_at: string | null;
    completed_at: string | null;
  }>;
}

function daysFromNow(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatRelativeDays(days: number | null): string {
  if (days === null) return 'Sin fecha';
  if (days < 0) return `Hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days <= 7) return `En ${days} día${days === 1 ? '' : 's'}`;
  if (days <= 14) return 'En 1 a 2 semanas';
  return `En ${Math.ceil(days / 7)} semanas`;
}

/**
 * Card "Próximos controles" en /home. Muestra hasta 3 hitos vencidos o
 * dentro de los próximos 14 días, con énfasis visual en los vencidos.
 *
 * Si no hay nada en ese rango, no se renderiza (la familia ya tiene
 * /cuidar/calendario para ver el calendario completo).
 */
export function UpcomingControlsCard({ rows }: UpcomingControlsCardProps) {
  if (rows.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <CalendarClock className="size-4" />
        </span>
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          Próximos controles
        </span>
        <Link
          href={'/cuidar/calendario' as Route}
          className="ml-auto inline-flex items-center gap-0.5 text-muted-foreground text-xs hover:text-foreground"
        >
          Ver todos
          <ChevronRight className="size-3" aria-hidden />
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((m) => {
          const status = deriveStatus(m.due_at, m.completed_at);
          const days = daysFromNow(m.due_at);
          const isOverdue = status === 'overdue';
          return (
            <li key={m.id}>
              <Link
                href={`/cuidar/calendario/${m.id}` as Route}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                  isOverdue
                    ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                    : 'border-border/50 bg-card/40 hover:bg-muted/30',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    isOverdue ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary',
                  )}
                >
                  {isOverdue ? (
                    <AlertCircle className="size-4" />
                  ) : (
                    <CalendarClock className="size-4" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium text-foreground text-sm">{m.title}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {MILESTONE_CATEGORY_LABELS[m.category]} · {formatRelativeDays(days)}
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
