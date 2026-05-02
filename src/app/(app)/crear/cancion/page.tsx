import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { listLullabiesAction } from './actions';
import { CancionTabs } from './cancion-tabs';

export const metadata: Metadata = {
  title: 'Canción para Salu',
};

export default async function CrearCancionPage() {
  const library = await listLullabiesAction();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/crear" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Canción para Salu
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Decime para qué momento, con qué tono, y SalustIA arma una canción cantable. Quedan
            guardadas en la biblioteca — no se vuelven a generar.
          </p>
        </div>
      </header>

      <CancionTabs initialLibrary={library} />
    </div>
  );
}
