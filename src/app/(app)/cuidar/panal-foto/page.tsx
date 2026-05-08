import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { DiaperPhotoAnalyzer } from './_components/diaper-photo-analyzer';

export const metadata: Metadata = {
  title: 'Aquitapp',
};

export default function PanalFotoPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Cuidar
      </Button>

      <PageHeader
        eyebrow="Cuidar"
        title="Aquitapp."
        description="Subí una foto del pañal y SalustIA te describe qué ve: color, consistencia, lo que llama la atención."
      />

      <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-foreground">No diagnostica, describe.</p>
          <p className="text-muted-foreground">
            La foto se procesa en el momento y no se guarda. Si ves algo que te preocupa, mostrale
            el resultado al pediatra.
          </p>
        </div>
      </Card>

      <DiaperPhotoAnalyzer />
    </div>
  );
}
