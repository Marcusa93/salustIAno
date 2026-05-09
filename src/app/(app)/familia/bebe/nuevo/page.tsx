import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ChildProfileForm } from '../_components/child-profile-form';
import { createChildAction } from '../actions';

export const metadata: Metadata = {
  title: 'Crear perfil del bebé',
};

export default function NewChildPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/familia' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Familia
      </Button>

      <PageHeader
        eyebrow="Familia"
        title="Crear el perfil del bebé."
        description="Cargá lo que ya sabés. Podés volver y completar el resto cuando lo tengas."
      />

      <ChildProfileForm onSubmitAction={createChildAction} submitLabel="Crear perfil" />
    </div>
  );
}
