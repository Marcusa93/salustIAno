import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MedicationForm } from '../_components/medication-form';
import { createMedicationDoseAction } from '../actions';

export const metadata: Metadata = {
  title: 'Registrar dosis',
};

export default async function NewMedicationDosePage() {
  const supabase = await createClient();

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
        title="Registrar dosis."
        description="Anotá qué medicamento diste, cuándo y cada cuántas horas — el sistema calcula la próxima."
      />

      <MedicationForm suggestions={suggestions} onSubmitAction={createMedicationDoseAction} />
    </div>
  );
}
