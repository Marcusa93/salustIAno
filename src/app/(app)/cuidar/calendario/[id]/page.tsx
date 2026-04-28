import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import {
  MILESTONE_CATEGORY_LABELS,
  type MilestoneCategory,
  deriveStatus,
} from '@/lib/validators/milestone';
import { ChevronLeft, Pencil } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MilestoneActions } from './_components/milestone-actions';

export const metadata: Metadata = {
  title: 'Hito · Calendario de controles',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_BADGE: Record<ReturnType<typeof deriveStatus>, { label: string; cls: string }> = {
  pending: {
    label: 'Pendiente',
    cls: 'bg-primary/10 text-primary',
  },
  overdue: {
    label: 'Vencido',
    cls: 'bg-destructive/10 text-destructive',
  },
  completed: {
    label: 'Hecho',
    cls: 'bg-muted text-muted-foreground',
  },
};

export default async function MilestoneDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: milestone, error } = await supabase
    .from('medical_milestones')
    .select(
      'id, title, description, category, due_at, completed_at, notes, family_group_id, created_at',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !milestone) notFound();

  const { data: userData } = await supabase.auth.getUser();

  // Para saber si el user puede editar/marcar/borrar, consultamos su rol
  // dentro de la familia del milestone. Solo admin puede.
  let canEdit = false;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('family_group_id', milestone.family_group_id)
      .is('deleted_at', null)
      .maybeSingle();
    canEdit = membership?.role === 'admin';
  }

  const status = deriveStatus(milestone.due_at, milestone.completed_at);
  const badge = STATUS_BADGE[status];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href="/cuidar/calendario" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
            {MILESTONE_CATEGORY_LABELS[milestone.category as MilestoneCategory]}
          </span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          {milestone.title}
        </h1>
        <p className="text-muted-foreground">
          {milestone.completed_at
            ? `Hecho el ${formatDate(milestone.completed_at)}`
            : `Programado: ${formatDate(milestone.due_at)}`}
        </p>
      </header>

      {milestone.description && (
        <Card className="p-6">
          <h2 className="mb-2 font-medium text-foreground text-sm uppercase tracking-wider">
            Qué es
          </h2>
          <p className="whitespace-pre-wrap text-base text-foreground leading-relaxed">
            {milestone.description}
          </p>
        </Card>
      )}

      {milestone.notes && (
        <Card className="p-6">
          <h2 className="mb-2 font-medium text-foreground text-sm uppercase tracking-wider">
            Notas
          </h2>
          <p className="whitespace-pre-wrap text-base text-foreground leading-relaxed">
            {milestone.notes}
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4 border-border border-t pt-4">
        <MilestoneActions
          id={milestone.id}
          title={milestone.title}
          isCompleted={milestone.completed_at !== null}
          canEdit={canEdit}
        />
        {canEdit && (
          <Button
            render={<Link href={`/cuidar/calendario/${milestone.id}/editar` as Route} />}
            variant="ghost"
            size="sm"
            className="self-start"
          >
            <Pencil className="size-4" aria-hidden />
            Editar detalles
          </Button>
        )}
      </div>
    </div>
  );
}
