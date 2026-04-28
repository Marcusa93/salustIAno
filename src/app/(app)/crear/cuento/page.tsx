import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StoryForm } from './story-form';

export const metadata: Metadata = {
  title: 'Cuento personalizado',
};

export default function CrearCuentoPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/crear" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Cuento personalizado
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Contame quién es el protagonista, cómo se siente y qué momento del día estamos viviendo.
            Yo armo el cuento.
          </p>
        </div>
      </header>

      <StoryForm />
    </div>
  );
}
