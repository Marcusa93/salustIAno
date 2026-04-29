import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import type { BloodType } from '@/lib/validators/child-profile';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChildProfileForm } from '../../_components/child-profile-form';
import { updateChildAction } from '../../actions';

export const metadata: Metadata = {
  title: 'Editar perfil del bebé',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function isoToInputDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function timeToInputTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

export default async function EditChildPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: child, error } = await supabase
    .from('child_profiles')
    .select(
      'id, name, birth_date, birth_time, birth_place, birth_weight_grams, birth_height_cm, gestational_weeks_at_birth, pediatrician_name, pediatrician_phone, health_insurance, blood_type, notes',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !child) notFound();

  const onSubmit = updateChildAction.bind(null, child.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href={`/familia/bebe/${child.id}` as Route} />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          Editar perfil
        </h1>
      </header>

      <ChildProfileForm
        defaultValues={{
          name: child.name,
          birth_date: isoToInputDate(child.birth_date),
          birth_time: timeToInputTime(child.birth_time),
          birth_place: child.birth_place ?? '',
          birth_weight_grams: child.birth_weight_grams ?? undefined,
          birth_height_cm: child.birth_height_cm ?? undefined,
          gestational_weeks_at_birth: child.gestational_weeks_at_birth ?? undefined,
          pediatrician_name: child.pediatrician_name ?? '',
          pediatrician_phone: child.pediatrician_phone ?? '',
          health_insurance: child.health_insurance ?? '',
          blood_type: (child.blood_type as BloodType | null) ?? '',
          notes: child.notes ?? '',
        }}
        onSubmitAction={onSubmit}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
