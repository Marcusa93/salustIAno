import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MilestoneForm } from '../_components/milestone-form';
import { createMilestoneAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nuevo hito · Calendario de controles',
};

export default function NewMilestonePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href="/cuidar/calendario" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Agregar hito
          </h1>
          <p className="text-muted-foreground">
            Solo los admins de la familia pueden cargar hitos médicos.
          </p>
        </div>
      </header>

      <MilestoneForm onSubmitAction={createMilestoneAction} submitLabel="Guardar hito" />
    </div>
  );
}
