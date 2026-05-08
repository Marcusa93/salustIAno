import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { SummaryGenerator } from './_components/summary-generator';

export const metadata: Metadata = {
  title: 'Borrador para el control',
};

export default function ControlPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <Button
        render={<Link href={'/cuidar' as Route} />}
        variant="ghost"
        size="sm"
        className="-mb-2 self-start text-muted-foreground print:hidden"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Cuidar
      </Button>

      <PageHeader
        eyebrow="Cuidar"
        title="Borrador para el control."
        description="Un resumen del último período listo para llevarle al pediatra. Tomas, sueños, pañales, mediciones y preguntas que conviene hacer."
        className="print:hidden"
      />

      <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4 print:hidden">
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
