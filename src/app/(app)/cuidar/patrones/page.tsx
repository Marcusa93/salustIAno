import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getPatternsAction } from './actions';
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
  const initial = await getPatternsAction();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="animate-stagger-up flex flex-col gap-2">
        <span className="font-medium text-[11px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Cuidar · Patrones
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
          Cómo viene la rutina.
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Observaciones cariñosas sobre los últimos 14 días — promedios y ritmos visibles en los
          datos. Nada de diagnósticos ni recomendaciones.
        </p>
      </header>

      <Card className="flex flex-col gap-4 border-primary/15 bg-gradient-to-br from-primary/[0.06] via-background to-accent/15 p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-primary"
          >
            <Sparkles className="size-4" />
          </span>
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
            Observaciones IA
          </span>
        </div>

        <PatternsView initial={initial} />
      </Card>
    </div>
  );
}
