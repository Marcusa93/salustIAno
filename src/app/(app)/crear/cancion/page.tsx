import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { listLullabiesAction } from './actions';
import { CancionTabs } from './cancion-tabs';

export const metadata: Metadata = {
  title: 'Canción para Salu',
};

export default async function CrearCancionPage() {
  const library = await listLullabiesAction();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/crear' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Crear
      </Button>

      <PageHeader
        eyebrow="Crear · Canción"
        title="Canción para Salu."
        description="Decime para qué momento, con qué tono, y SalustIA arma una canción cantable. Quedan guardadas en la biblioteca — no se regeneran."
      />

      <CancionTabs initialLibrary={library} />
    </div>
  );
}
