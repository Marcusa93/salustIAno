import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { ChevronLeft, Plus, Ruler } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            Mediciones
          </h1>
        </header>
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <Ruler className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground text-sm">
            Creá el perfil del bebé para empezar a cargar mediciones.
          </p>
          <Button render={<Link href="/familia/bebe/nuevo" />}>
            <Plus className="size-4" aria-hidden />
            Crear perfil
          </Button>
        </Card>
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/cuidar" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
              Cuidar · Mediciones
            </span>
            <h1 className="font-display text-[clamp(2rem,5vw,3rem)] text-foreground leading-[1.05] tracking-tight">
              Cómo va creciendo
            </h1>
            <p className="max-w-prose text-muted-foreground">
              Lo que te entregan en cada control. Vas a ver cómo crece {child.name} con el tiempo.
            </p>
          </div>
          <Button render={<Link href="/cuidar/mediciones/nueva" />} size="sm">
            <Plus className="size-4" aria-hidden />
            Cargar medición
          </Button>
        </div>
      </header>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar las mediciones.
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Ruler className="size-6" aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="font-medium text-foreground text-lg">Todavía no cargaste mediciones.</h2>
            <p className="max-w-md text-muted-foreground text-sm">
              Después de cada control, cargá lo que te dijo la pediatra. Vas a poder ver la
              evolución a lo largo del tiempo.
            </p>
          </div>
          <Button render={<Link href="/cuidar/mediciones/nueva" />}>
            <Plus className="size-4" aria-hidden />
            Cargar la primera
          </Button>
        </Card>
      ) : (
        <>
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
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
              Histórico
            </h2>
            <ul className="flex flex-col gap-3">
              {rows.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/cuidar/mediciones/${m.id}` as Route}
                    className="block rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                  >
                    <Card className="flex flex-col gap-2 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {formatDate(m.measured_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
                        {m.weight_grams !== null && <span>Peso: {fmtWeight(m.weight_grams)}</span>}
                        {m.height_cm !== null && <span>Talla: {fmtCm(m.height_cm)}</span>}
                        {m.head_circumference_cm !== null && (
                          <span>Cabeza: {fmtCm(m.head_circumference_cm)}</span>
                        )}
                      </div>
                      {m.notes && <p className="text-muted-foreground text-xs italic">{m.notes}</p>}
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
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className="font-display text-2xl text-foreground">{format(latest)}</span>
      {delta !== null && (
        <span className={`text-xs ${delta >= 0 ? 'text-primary' : 'text-destructive'}`}>
          {delta > 0 ? '+' : ''}
          {format(delta)} vs. anterior
        </span>
      )}
      {latestAt && <span className="text-muted-foreground text-xs">{formatDate(latestAt)}</span>}
    </Card>
  );
}
