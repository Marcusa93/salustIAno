import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { createClient } from '@/lib/supabase/server';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MenuForm } from './_components/menu-form';

export const metadata: Metadata = {
  title: '¿Qué puede comer?',
};

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: child } = await supabase
    .from('child_profiles')
    .select('name, birth_date')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const nombre = child?.name ?? 'el bebé';
  const age = babyAgeFromBirth(child?.birth_date ?? null);
  const edadLabel = age?.label ?? 'edad desconocida';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
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
        eyebrow="Alimentación"
        title={`¿Qué puede comer ${nombre}?`}
        description={`Contame qué tenés en casa y te sugiero recetas aptas para sus ${edadLabel}. No reemplaza la guía de tu pediatra.`}
      />

      <MenuForm nombreBebe={nombre} edadLabel={edadLabel} />
    </div>
  );
}
