import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MeasurementForm } from '../_components/measurement-form';
import { createMeasurementAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nueva medición',
};

export default function NewMeasurementPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar/mediciones' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Mediciones
      </Button>

      <PageHeader
        eyebrow="Cuidar · Mediciones"
        title="Cargar medición."
        description="Lo que te dieron en el control. Solo los admins de la familia pueden cargar mediciones (ADR 0004)."
      />

      <MeasurementForm onSubmitAction={createMeasurementAction} submitLabel="Guardar" />
    </div>
  );
}
