import { Card } from '@/components/ui/card';
import { ClipboardCheck, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { SummaryGenerator } from './_components/summary-generator';

export const metadata: Metadata = {
  title: 'Borrador para el control',
};

export default function ControlPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ClipboardCheck className="size-6" aria-hidden />
        </div>
        <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
          Borrador para el control
        </h1>
        <p className="text-muted-foreground">
          Un resumen del último período, listo para llevarle al pediatra. Tomas, sueños, pañales,
          mediciones y preguntas que te conviene hacer.
        </p>
      </header>

      <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-foreground">Es un borrador, no un diagnóstico.</p>
          <p className="text-muted-foreground">
            Solo describe lo que cargaron. La pediatra interpreta. Ideal para no olvidarse de nada
            en el consultorio.
          </p>
        </div>
      </Card>

      <SummaryGenerator />
    </div>
  );
}
