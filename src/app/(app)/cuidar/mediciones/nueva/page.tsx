import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MeasurementForm } from '../_components/measurement-form';
import { createMeasurementAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nueva medición',
};

export default function NewMeasurementPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href="/cuidar/mediciones" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Cargar medición
          </h1>
          <p className="text-muted-foreground">
            Lo que te dieron en el control. Solo los admins de la familia pueden cargar mediciones
            (ADR 0004).
          </p>
        </div>
      </header>

      <MeasurementForm onSubmitAction={createMeasurementAction} submitLabel="Guardar" />
    </div>
  );
}
