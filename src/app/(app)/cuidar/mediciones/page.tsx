import { EmptyState } from '@/components/salu/empty-state';
import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { ChevronLeft, Plus, Ruler } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { MeasurementsChart } from './_components/measurements-chart';

export const metadata: Metadata = {
  title: 'Mediciones',
};

interface MeasurementRow {
  id: string;
  measured_at: string;
  weight_grams: number | null;
  height_cm: number | null;
  head_circumference_cm: number | null;
  notes: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtWeight(g: number | null): string {
  if (g === null) return '—';
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g} g`;
}

function fmtCm(cm: number | null): string {
  return cm === null ? '—' : `${cm} cm`;
}

/**
 * Devuelve el último valor no-null de `field` y el penúltimo no-null,
 * para mostrar "valor actual" y "Δ desde antes".
 */
function pickLatest(
  rows: MeasurementRow[],
  field: 'weight_grams' | 'height_cm' | 'head_circumference_cm',
) {
  const filtered = rows.filter((r) => r[field] !== null);
  return {
    latest: filtered[0] ?? null,
    previous: filtered[1] ?? null,
  };
}

export default async function MeasurementsListPage() {
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
        <PageHeader eyebrow="Cuidar" title="Mediciones." />
        <EmptyState
          icon={Ruler}
          title="Creá el perfil del bebé."
          description="Para empezar a cargar mediciones necesitamos primero el perfil."
          action={{ label: 'Crear perfil', href: '/familia/bebe/nuevo' as Route }}
        />
      </div>
    );
  }

  const { data: rowsData, error } = await supabase
    .from('child_measurements')
    .select('id, measured_at, weight_grams, height_cm, head_circumference_cm, notes')
    .eq('child_id', child.id)
    .is('deleted_at', null)
    .order('measured_at', { ascending: false });

  const rows = (rowsData ?? []) as MeasurementRow[];

  const weight = pickLatest(rows, 'weight_grams');
  const height = pickLatest(rows, 'height_cm');
  const head = pickLatest(rows, 'head_circumference_cm');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
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
        title="Cómo va creciendo."
        description={`Lo que te entregan en cada control. Vas a ver cómo crece ${child.name} con el tiempo.`}
        action={
          <Button render={<Link href="/cuidar/mediciones/nueva" />} size="sm">
            <Plus className="size-4" aria-hidden />
            Cargar medición
          </Button>
        }
      />

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar las mediciones.
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Todavía no cargaste mediciones."
          description="Después de cada control, cargá lo que te dijo la pediatra. Vas a poder ver la evolución a lo largo del tiempo."
          action={{ label: 'Cargar la primera', href: '/cuidar/mediciones/nueva' as Route }}
        />
      ) : (
        <>
          {/* Gráfico de evolución */}
          <MeasurementsChart
            points={rows.map((m) => ({
              measuredAt: m.measured_at,
              weightGrams: m.weight_grams ?? null,
              heightCm: m.height_cm ?? null,
              headCm: m.head_circumference_cm ?? null,
            }))}
          />

          {/* Resumen de últimos valores */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Peso"
              latest={weight.latest?.weight_grams ?? null}
              previous={weight.previous?.weight_grams ?? null}
              format={fmtWeight}
              latestAt={weight.latest?.measured_at ?? null}
            />
            <SummaryCard
              label="Talla"
              latest={height.latest?.height_cm ?? null}
              previous={height.previous?.height_cm ?? null}
              format={fmtCm}
              latestAt={height.latest?.measured_at ?? null}
            />
            <SummaryCard
              label="Cabeza"
              latest={head.latest?.head_circumference_cm ?? null}
              previous={head.previous?.head_circumference_cm ?? null}
              format={fmtCm}
              latestAt={head.latest?.measured_at ?? null}
            />
          </div>

          {/* Lista completa */}
          <section className="flex flex-col gap-3">
            <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
              Histórico
            </h2>
            <ul className="flex flex-col gap-2">
              {rows.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/cuidar/mediciones/${m.id}` as Route}
                    className="block rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Card className="flex flex-col gap-1.5 border-border/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
                      <span className="font-medium text-foreground text-sm">
                        {formatDate(m.measured_at)}
                      </span>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                        {m.weight_grams !== null && <span>Peso: {fmtWeight(m.weight_grams)}</span>}
                        {m.height_cm !== null && <span>Talla: {fmtCm(m.height_cm)}</span>}
                        {m.head_circumference_cm !== null && (
                          <span>Cabeza: {fmtCm(m.head_circumference_cm)}</span>
                        )}
                      </div>
                      {m.notes && (
                        <p className="line-clamp-2 text-muted-foreground/80 text-xs italic">
                          {m.notes}
                        </p>
                      )}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  latest,
  previous,
  format,
  latestAt,
}: {
  label: string;
  latest: number | null;
  previous: number | null;
  format: (v: number | null) => string;
  latestAt: string | null;
}) {
  const delta = latest !== null && previous !== null ? latest - previous : null;
  return (
    <Card className="flex flex-col gap-1 border-border/60 bg-gradient-to-b from-card to-muted/15 p-4">
      <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
        {label}
      </span>
      <span className="font-display text-2xl text-foreground tracking-tight">{format(latest)}</span>
      {delta !== null && (
        <span className={`font-medium text-xs ${delta >= 0 ? 'text-primary' : 'text-destructive'}`}>
          {delta > 0 ? '+' : ''}
          {format(delta)} vs. anterior
        </span>
      )}
      {latestAt && <span className="text-muted-foreground text-xs">{formatDate(latestAt)}</span>}
    </Card>
  );
}
