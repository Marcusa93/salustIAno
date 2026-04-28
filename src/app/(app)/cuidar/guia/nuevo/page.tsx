import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CareGuideForm } from '../_components/care-guide-form';
import { createCareGuideAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nueva entrada · Guía de cuidado',
};

export default function NewCareGuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href="/cuidar/guia" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Agregar entrada
          </h1>
          <p className="text-muted-foreground">
            Anotá lo que aprendiste o lo que te dijeron. Vas a poder editarlo después.
          </p>
        </div>
      </header>

      <CareGuideForm onSubmitAction={createCareGuideAction} submitLabel="Guardar entrada" />
    </div>
  );
}
