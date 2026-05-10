import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, Sparkles } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { HourlyHeatmap } from './_components/hourly-heatmap';
import { getPatternsAction } from './actions';
import { getHourlyHeatmapAction } from './heatmap-actions';
import { PatternsView } from './patterns-view';

export const metadata: Metadata = {
  title: 'Patrones',
};

/**
 * Página /cuidar/patrones — observaciones descriptivas (no diagnósticas) de
 * los últimos 14 días con el bebé. Genera al primer load y cachea client-side
 * en localStorage por 6 horas para no repetir costos.
 */
export default async function PatronesPage() {
  // Pre-cargamos las observaciones del server para que el primer paint ya
  // las muestre. La UI puede regenerar a demanda.
  const [initial, heatmap] = await Promise.all([getPatternsAction(), getHourlyHeatmapAction()]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
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
        title="Cómo viene la rutina."
        description="Observaciones cariñosas sobre los últimos 14 días — promedios y ritmos visibles en los datos. Nada de diagnósticos ni recomendaciones."
      />

      <Card className="animate-stagger-up flex flex-col gap-4 border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-accent/15 p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            <Sparkles className="size-4" />
          </span>
          <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
            Observaciones IA
          </span>
        </div>

        <PatternsView initial={initial} />
      </Card>

      <Card className="animate-stagger-up flex flex-col gap-4 border-border/60 p-5">
        <HourlyHeatmap data={heatmap} />
      </Card>
    </div>
  );
}
