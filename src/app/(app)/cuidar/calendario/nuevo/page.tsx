import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MilestoneForm } from '../_components/milestone-form';
import { createMilestoneAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nuevo hito · Calendario de controles',
};

export default function NewMilestonePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar/calendario' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Calendario
      </Button>

      <PageHeader
        eyebrow="Cuidar · Calendario"
        title="Agregar hito."
        description="Solo los admins de la familia pueden cargar hitos médicos."
      />

      <MilestoneForm onSubmitAction={createMilestoneAction} submitLabel="Guardar hito" />
    </div>
  );
}
