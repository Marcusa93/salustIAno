import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChildProfileForm } from '../_components/child-profile-form';
import { createChildAction } from '../actions';

export const metadata: Metadata = {
  title: 'Crear perfil del bebé',
};

export default function NewChildPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/familia" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Crear el perfil
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Cargá lo que ya sabés. Podés volver y completar el resto cuando lo tengas.
          </p>
        </div>
      </header>

      <ChildProfileForm onSubmitAction={createChildAction} submitLabel="Crear perfil" />
    </div>
  );
}
