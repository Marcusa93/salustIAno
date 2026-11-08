import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, ChevronLeft, ShieldCheck, Utensils } from 'lucide-react';
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

      <Link
        href={'/comidas/informe' as Route}
        className="flex items-center gap-3 rounded-2xl bg-solid-soft p-4 ring-1 ring-solid/25 transition-transform active:scale-[0.99] print:hidden"
      >
        <Utensils className="size-5 shrink-0 text-solid-foreground" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
          <span className="font-medium text-solid-foreground">Informe de alimentación</span>
          <span className="text-solid-foreground/80">
            Alérgenos, reacciones, texturas y preguntas sobre las comidas, listo para imprimir.
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-solid-foreground" aria-hidden />
      </Link>

      <SummaryGenerator />
    </div>
  );
}
