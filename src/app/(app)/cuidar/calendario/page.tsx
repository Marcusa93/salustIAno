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
import { CalendarClock, ChevronLeft, Plus } from 'lucide-react';
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/cuidar" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
              Cuidar · Controles
            </span>
            <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
              Calendario de controles
            </h1>
            <p className="max-w-prose text-muted-foreground">
              Pesquisa neonatal, ecografías, vacunas, fondo de ojo. Lo que viene y lo que ya
              hicieron.
            </p>
          </div>
          <Button render={<Link href="/cuidar/calendario/nuevo" />} size="sm">
            <Plus className="size-4" aria-hidden />
            Agregar hito
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar el calendario. Probá refrescar la página.
        </div>
      ) : total === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="size-6" aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="font-medium text-foreground text-lg">Empezá a cargar los controles.</h2>
            <p className="max-w-md text-muted-foreground text-sm">
              Cargá el primer control pediátrico, la pesquisa, la ecografía de cadera. Cuando llegue
              la fecha, los vas marcando como hechos.
            </p>
          </div>
          <Button render={<Link href="/cuidar/calendario/nuevo" />}>
            <Plus className="size-4" aria-hidden />
            Agregar el primer hito
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {(['overdue', 'pending', 'completed'] as MilestoneStatus[]).map((status) => {
            const items = groups[status];
            if (items.length === 0) return null;
            return (
              <section key={status} className="flex flex-col gap-3">
                <header className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-2xl text-foreground">{STATUS_LABELS[status]}</h2>
                  <span className="text-muted-foreground text-sm">{items.length}</span>
                </header>
                <p className="text-muted-foreground text-sm">{STATUS_DESCRIPTIONS[status]}</p>
                <ul className="flex flex-col gap-3">
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
      className="block rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    >
      <Card
        className={cn(
          'flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md',
          status === 'overdue' && 'border-destructive/40',
          status === 'completed' && 'opacity-80',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
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
          {inDaysText && <span className="text-muted-foreground text-xs">· {inDaysText}</span>}
        </div>
        <h3 className="font-medium text-foreground text-lg">{row.title}</h3>
        {row.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">{row.description}</p>
        )}
      </Card>
    </Link>
  );
}
