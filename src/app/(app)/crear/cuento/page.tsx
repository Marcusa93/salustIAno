import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { listStoriesAction } from './actions';
import { CuentoTabs } from './cuento-tabs';

export const metadata: Metadata = {
  title: 'Cuento personalizado',
};

export default async function CrearCuentoPage() {
  const library = await listStoriesAction();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/crear" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
            Crear · Cuento
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
            Cuento personalizado
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Contame quién es el protagonista, cómo se siente y qué momento del día estamos viviendo.
            Yo armo el cuento. Quedan guardados en la biblioteca.
          </p>
        </div>
      </header>

      <CuentoTabs initialLibrary={library} />
    </div>
  );
}
