import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { listStoriesAction } from './actions';
import { CuentoTabs } from './cuento-tabs';

export const metadata: Metadata = {
  title: 'Cuento personalizado',
};

export default async function CrearCuentoPage() {
  const library = await listStoriesAction();
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
        eyebrow="Crear · Cuento"
        title="Cuento personalizado."
        description="Contame quién es el protagonista, cómo se siente y qué momento del día estamos viviendo. Yo armo el cuento. Queda guardado en la biblioteca."
      />

      <CuentoTabs initialLibrary={library} />
    </div>
  );
}
