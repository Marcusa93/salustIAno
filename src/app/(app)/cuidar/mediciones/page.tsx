import { EmptyState } from '@/components/salu/empty-state';
import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { type Sex, percentileForMeasurement } from '@/lib/who-growth';
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
    timeZone: 'America/Argentina/Buenos_Aires',
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
    .select('id, name, birth_date, sex, birth_weight_grams, birth_height_cm')
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

  const childId = child.id as string;
  const childName = (child.name as string | undefined) ?? 'el bebé';
  const { data: rowsData, error } = await supabase
    .from('child_measurements')
    .select('id, measured_at, weight_grams, height_cm, head_circumference_cm, notes')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('measured_at', { ascending: false });

  const rows = (rowsData ?? []) as MeasurementRow[];

  const weight = pickLatest(rows, 'weight_grams');
  const height = pickLatest(rows, 'height_cm');
  const head = pickLatest(rows, 'head_circumference_cm');

  // Datos del bebé que necesitamos para los percentiles OMS.
  const birthDate = (child.birth_date as string | null | undefined) ?? null;
  const rawSex = (child.sex as string | null | undefined) ?? null;
  const childSex: Sex | 'other' | null =
    rawSex === 'male' || rawSex === 'female' || rawSex === 'other' ? rawSex : null;

  // Helper para calcular percentil de la última medición (si tenemos
  // birthDate + sex válidos). Devuelve null cuando no se puede.
  function pctFor(
    kind: 'weight' | 'length' | 'head_circumference',
    value: number | null,
    measuredAt: string | null,
  ): number | null {
    if (!birthDate || !childSex || value === null || !measuredAt) return null;
    const ageDays = Math.floor(
      (new Date(measuredAt).getTime() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    // weight viene en gramos en BD, OMS lo espera en kg.
    const v = kind === 'weight' ? value / 1000 : value;
    return percentileForMeasurement({ sex: childSex, kind, value: v, ageDays });
  }

  const weightPct = pctFor(
    'weight',
    weight.latest?.weight_grams ?? null,
    weight.latest?.measured_at ?? null,
  );
  const heightPct = pctFor(
    'length',
    height.latest?.height_cm ?? null,
    height.latest?.measured_at ?? null,
  );
  const headPct = pctFor(
    'head_circumference',
    head.latest?.head_circumference_cm ?? null,
    head.latest?.measured_at ?? null,
  );

  const birthWeightGrams = (child.birth_weight_grams as number | null | undefined) ?? null;
  const birthHeightCm = (child.birth_height_cm as number | null | undefined) ?? null;
  const birthPoint =
    birthDate && (birthWeightGrams !== null || birthHeightCm !== null)
      ? {
          measuredAt: `${birthDate}T12:00:00.000Z`,
          weightGrams: birthWeightGrams,
          heightCm: birthHeightCm,
          headCm: null as number | null,
          isBirth: true as const,
        }
      : null;
  const chartPoints = [
    ...(birthPoint ? [birthPoint] : []),
    ...rows.map((m) => ({
      measuredAt: m.measured_at,
      weightGrams: m.weight_grams ?? null,
      heightCm: m.height_cm ?? null,
      headCm: m.head_circumference_cm ?? null,
    })),
  ];
  const rowsWithPct = rows.map((m) => ({
    ...m,
    wPct: pctFor('weight', m.weight_grams, m.measured_at),
    hPct: pctFor('length', m.height_cm, m.measured_at),
    cPct: pctFor('head_circumference', m.head_circumference_cm, m.measured_at),
  }));

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
        description={`Lo que te entregan en cada control. Vas a ver cómo crece ${childName} con el tiempo.`}
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
          {/* Gráfico de evolución con bandas OMS de fondo cuando hay
              birth_date + sex. */}
          <MeasurementsChart
            points={chartPoints}
            birthDate={birthDate}
            sex={childSex === 'male' || childSex === 'female' ? childSex : null}
          />

          {/* Resumen de últimos valores con percentil OMS al lado. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Peso"
              latest={weight.latest?.weight_grams ?? null}
              previous={weight.previous?.weight_grams ?? null}
              format={fmtWeight}
              latestAt={weight.latest?.measured_at ?? null}
              percentile={weightPct}
            />
            <SummaryCard
              label="Talla"
              latest={height.latest?.height_cm ?? null}
              previous={height.previous?.height_cm ?? null}
              format={fmtCm}
              latestAt={height.latest?.measured_at ?? null}
              percentile={heightPct}
            />
            <SummaryCard
              label="Cabeza"
              latest={head.latest?.head_circumference_cm ?? null}
              previous={head.previous?.head_circumference_cm ?? null}
              format={fmtCm}
              latestAt={head.latest?.measured_at ?? null}
              percentile={headPct}
            />
          </div>

          {/* Disclaimer OMS — siempre visible cuando hay percentiles. */}
          {(weightPct !== null || heightPct !== null || headPct !== null) && (
            <p className="text-muted-foreground/80 text-xs leading-relaxed">
              Percentiles según las curvas oficiales de la OMS para{' '}
              {childSex === 'male' ? 'varones' : 'nenas'} 0-24 meses. Son una referencia
              orientativa, no un diagnóstico — la pediatra es la que interpreta el contexto.
            </p>
          )}

          {/* Lista completa */}
          <section className="flex flex-col gap-3">
            <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
              Histórico
            </h2>
            <ul className="flex flex-col gap-2">
              {rowsWithPct.map((m) => (
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
                        {m.weight_grams !== null && (
                          <span className="flex items-center gap-1.5">
                            Peso: {fmtWeight(m.weight_grams)}
                            {m.wPct !== null && (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[9px]',
                                  percentileTone(m.wPct),
                                )}
                              >
                                p{Math.round(m.wPct)}
                              </span>
                            )}
                          </span>
                        )}
                        {m.height_cm !== null && (
                          <span className="flex items-center gap-1.5">
                            Talla: {fmtCm(m.height_cm)}
                            {m.hPct !== null && (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[9px]',
                                  percentileTone(m.hPct),
                                )}
                              >
                                p{Math.round(m.hPct)}
                              </span>
                            )}
                          </span>
                        )}
                        {m.head_circumference_cm !== null && (
                          <span className="flex items-center gap-1.5">
                            Cabeza: {fmtCm(m.head_circumference_cm)}
                            {m.cPct !== null && (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[9px]',
                                  percentileTone(m.cPct),
                                )}
                              >
                                p{Math.round(m.cPct)}
                              </span>
                            )}
                          </span>
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
  percentile,
}: {
  label: string;
  latest: number | null;
  previous: number | null;
  format: (v: number | null) => string;
  latestAt: string | null;
  percentile: number | null;
}) {
  const delta = latest !== null && previous !== null ? latest - previous : null;
  return (
    <Card className="flex flex-col gap-1 border-border/60 bg-gradient-to-b from-card to-muted/15 p-4">
      <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl text-foreground tracking-tight">
          {format(latest)}
        </span>
        {percentile !== null && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 font-mono font-medium text-[10px] tracking-wider',
              percentileTone(percentile),
            )}
            title={percentileExplain(percentile)}
          >
            p{Math.round(percentile)}
          </span>
        )}
      </div>
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

/**
 * Color-codea el chip del percentil. La idea es comunicar visualmente
 * "está en el medio" (verde-azul, neutro/positivo) vs "extremo" (ámbar
 * para llamar la atención, sin alarmismo) — los pediatras hablan de
 * "fuera del rango p3-p97" como bandera.
 */
function percentileTone(p: number): string {
  if (p < 3 || p > 97) return 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25';
  if (p < 15 || p > 85) return 'bg-secondary text-secondary-foreground';
  return 'bg-primary/12 text-primary ring-1 ring-primary/15';
}

function percentileExplain(p: number): string {
  const r = Math.round(p);
  if (r < 3) return 'Más chico que el 97% de los bebés de su edad. Conversalo con la pediatra.';
  if (r > 97) return 'Más grande que el 97% de los bebés de su edad. Conversalo con la pediatra.';
  if (r >= 25 && r <= 75) return `Está en el medio sano (p${r}). Mismo porte que la mayoría.`;
  if (r < 25) return `Más chico que el promedio (p${r}). Dentro del rango normal.`;
  return `Más grande que el promedio (p${r}). Dentro del rango normal.`;
}
