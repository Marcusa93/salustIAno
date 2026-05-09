import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import type { MilestoneCategory } from '@/lib/validators/milestone';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MilestoneForm } from '../../_components/milestone-form';
import { updateMilestoneAction } from '../../actions';

export const metadata: Metadata = {
  title: 'Editar hito · Calendario de controles',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function isoToInputDate(iso: string | null): string {
  if (!iso) return '';
  // El input type=date pide YYYY-MM-DD. Tomamos solo la parte de fecha.
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function EditMilestonePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: milestone, error } = await supabase
    .from('medical_milestones')
    .select('id, title, category, description, due_at, notes')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !milestone) notFound();

  const onSubmit = updateMilestoneAction.bind(null, milestone.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={`/cuidar/calendario/${milestone.id}` as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Volver al hito
      </Button>

      <PageHeader eyebrow="Cuidar · Calendario" title="Editar hito." />

      <MilestoneForm
        defaultValues={{
          title: milestone.title,
          category: milestone.category as MilestoneCategory,
          description: milestone.description ?? '',
          due_at: isoToInputDate(milestone.due_at),
          notes: milestone.notes ?? '',
        }}
        onSubmitAction={onSubmit}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
