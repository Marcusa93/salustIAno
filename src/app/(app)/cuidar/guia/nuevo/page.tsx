import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { CareGuideForm } from '../_components/care-guide-form';
import { createCareGuideAction } from '../actions';

export const metadata: Metadata = {
  title: 'Nueva entrada · Guía de cuidado',
};

export default function NewCareGuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar/guia' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Guía
      </Button>

      <PageHeader
        eyebrow="Cuidar · Guía"
        title="Agregar entrada."
        description="Anotá lo que aprendiste o lo que te dijeron. Vas a poder editarlo después."
      />

      <CareGuideForm onSubmitAction={createCareGuideAction} submitLabel="Guardar entrada" />
    </div>
  );
}
