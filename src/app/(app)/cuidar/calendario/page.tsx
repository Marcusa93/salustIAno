import { EmptyState } from '@/components/salu/empty-state';
import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import {
  MILESTONE_CATEGORY_LABELS,
  type MilestoneCategory,
  type MilestoneStatus,
  deriveStatus,
} from '@/lib/validators/milestone';
import { CalendarClock, CalendarDays, ChevronLeft, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Calendario de controles',
};

interface MilestoneRow {
  id: string;
  title: string;
  description: string | null;
  category: MilestoneCategory;
  due_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysFromNow(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Próximos',
  overdue: 'Vencidos',
  completed: 'Hechos',
};

const STATUS_DESCRIPTIONS: Record<MilestoneStatus, string> = {
  pending: 'Lo que tenés que tener en el radar.',
  overdue: 'Pasó la fecha y todavía no está marcado como hecho.',
  completed: 'Ya está, archivado para el historial.',
};

export default async function MilestonesListPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('medical_milestones')
    .select('id, title, description, category, due_at, completed_at, notes')
    .is('deleted_at', null)
    .order('due_at', { ascending: true, nullsFirst: false });

  // Particionamos por status derivado en server (la tabla no tiene status como columna).
  const groups: Record<MilestoneStatus, MilestoneRow[]> = {
    pending: [],
    overdue: [],
    completed: [],
  };
  for (const row of (rows ?? []) as MilestoneRow[]) {
    const status = deriveStatus(row.due_at, row.completed_at);
    groups[status].push(row);
  }

  const total = (rows ?? []).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Cuidar
      </Button>

      <PageHeader
        eyebrow="Cuidar"
        title="Calendario de controles."
        description="Pesquisa neonatal, ecografías, vacunas, fondo de ojo. Lo que viene y lo que ya hicieron."
        action={
          <>
            <Button
              render={<Link href={'/cuidar/calendario/mes' as Route} />}
              size="sm"
              variant="outline"
            >
              <CalendarDays className="size-4" aria-hidden />
              Vista mensual
            </Button>
            <Button render={<Link href="/cuidar/calendario/nuevo" />} size="sm">
              <Plus className="size-4" aria-hidden />
              Agregar hito
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar el calendario. Probá refrescar la página.
        </Card>
      ) : total === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Empezá a cargar los controles."
          description="Cargá el primer control pediátrico, la pesquisa, la ecografía de cadera. Cuando llegue la fecha, los vas marcando como hechos."
          action={{ label: 'Agregar el primer hito', href: '/cuidar/calendario/nuevo' as Route }}
        />
      ) : (
        <div className="flex flex-col gap-7">
          {(['overdue', 'pending', 'completed'] as MilestoneStatus[]).map((status) => {
            const items = groups[status];
            if (items.length === 0) return null;
            return (
              <section key={status} className="flex flex-col gap-3">
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
                      {STATUS_LABELS[status]}
                    </h2>
                    <p className="text-muted-foreground text-xs">{STATUS_DESCRIPTIONS[status]}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs',
                      status === 'overdue'
                        ? 'bg-destructive/10 text-destructive'
                        : status === 'completed'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary',
                    )}
                  >
                    {items.length}
                  </span>
                </header>
                <ul className="flex flex-col gap-2">
                  {items.map((m) => (
                    <li key={m.id}>
                      <MilestoneRowCard row={m} status={status} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MilestoneRowCard({ row, status }: { row: MilestoneRow; status: MilestoneStatus }) {
  const dueText = row.completed_at ? formatDate(row.completed_at) : formatDate(row.due_at);
  const days = status === 'pending' ? daysFromNow(row.due_at) : null;
  const inDaysText =
    days === null ? null : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;

  return (
    <Link
      href={`/cuidar/calendario/${row.id}` as Route}
      className="block rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card
        className={cn(
          'group/m flex flex-col gap-2 border-border/60 p-4 transition-all duration-200',
          'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5',
          status === 'overdue' && 'border-destructive/40 bg-destructive/[0.03]',
          status === 'completed' && 'opacity-75',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[10.5px] text-primary uppercase tracking-wider">
            {MILESTONE_CATEGORY_LABELS[row.category]}
          </span>
          <span
            className={cn(
              'text-xs',
              status === 'overdue' ? 'font-medium text-destructive' : 'text-muted-foreground',
            )}
          >
            {row.completed_at ? `Hecho · ${dueText}` : dueText}
          </span>
          {inDaysText && (
            <span className="font-medium text-muted-foreground/80 text-xs">· {inDaysText}</span>
          )}
        </div>
        <h3 className="font-medium text-base text-foreground leading-tight">{row.title}</h3>
        {row.description && (
          <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
            {row.description}
          </p>
        )}
      </Card>
    </Link>
  );
}
