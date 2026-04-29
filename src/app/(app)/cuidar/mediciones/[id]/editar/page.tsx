import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MeasurementForm } from '../../_components/measurement-form';
import { updateMeasurementAction } from '../../actions';

export const metadata: Metadata = {
  title: 'Editar medición',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default async function EditMeasurementPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: measurement, error } = await supabase
    .from('child_measurements')
    .select('id, measured_at, weight_grams, height_cm, head_circumference_cm, notes')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !measurement) notFound();

  const onSubmit = updateMeasurementAction.bind(null, measurement.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href={`/cuidar/mediciones/${measurement.id}` as Route} />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          Editar medición
        </h1>
      </header>

      <MeasurementForm
        defaultValues={{
          measured_at: isoToLocalInput(measurement.measured_at),
          weight_grams: measurement.weight_grams ?? undefined,
          height_cm: measurement.height_cm ?? undefined,
          head_circumference_cm: measurement.head_circumference_cm ?? undefined,
          notes: measurement.notes ?? '',
        }}
        onSubmitAction={onSubmit}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
