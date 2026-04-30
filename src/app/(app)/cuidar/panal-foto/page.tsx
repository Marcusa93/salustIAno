import { Card } from '@/components/ui/card';
import { Camera, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { DiaperPhotoForm } from './_components/diaper-photo-form';

export const metadata: Metadata = {
  title: 'Pañal con foto',
};

export default function PanalFotoPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Camera className="size-6" aria-hidden />
        </div>
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          Mirá esto
        </h1>
        <p className="text-muted-foreground">
          Subí una foto del pañal y SalustIA te describe qué ve: color, consistencia, lo que llama
          la atención.
        </p>
      </header>

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

      <DiaperPhotoForm />
    </div>
  );
}
