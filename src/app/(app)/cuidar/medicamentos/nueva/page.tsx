import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import type { MedicationDoseInput } from '@/lib/validators/medication';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MedicationForm } from '../_components/medication-form';
import { createMedicationDoseAction } from '../actions';

export const metadata: Metadata = {
  title: 'Registrar dosis',
};

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function NewMedicationDosePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { from } = await searchParams;

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Últimos 5 medicamentos distintos para el datalist.
  const { data: recent } = child
    ? await supabase
        .from('medication_doses')
        .select('medication_name')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .order('given_at', { ascending: false })
        .limit(50)
    : { data: null };

  const suggestions: string[] = Array.from(
    new Set<string>((recent ?? []).map((r: { medication_name: string }) => r.medication_name)),
  ).slice(0, 5);

  // Si viene ?from=<id>, pre-llenamos con los datos de esa dosis.
  let prefilled: Partial<MedicationDoseInput> | undefined;
  if (from && child) {
    const { data: source } = await supabase
      .from('medication_doses')
      .select('medication_name, dose_amount, interval_hours')
      .eq('id', from)
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (source) {
      prefilled = {
        medication_name: source.medication_name as string,
        dose_amount: (source.dose_amount as string | null) ?? undefined,
        interval_hours: (source.interval_hours as number | null) ?? undefined,
      };
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar/medicamentos' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Medicamentos
      </Button>

      <PageHeader
        eyebrow="Cuidar · Medicamentos"
        title={prefilled ? `${prefilled.medication_name}.` : 'Registrar dosis.'}
        description={
          prefilled
            ? 'Ajustá la hora si hace falta — el medicamento y la dosis ya están precargados.'
            : 'Anotá qué medicamento diste, cuándo y cada cuántas horas — el sistema calcula la próxima.'
        }
      />

      <MedicationForm
        suggestions={suggestions}
        defaultValues={prefilled}
        onSubmitAction={createMedicationDoseAction}
      />
    </div>
  );
}
