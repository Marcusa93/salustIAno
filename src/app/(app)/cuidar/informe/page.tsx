import { Button } from '@/components/ui/button';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { type Sex, percentileForMeasurement } from '@/lib/who-growth';
import { ChevronLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PrintButton } from './print-button';

export const metadata: Metadata = {
  title: 'Informe para la pediatra',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function fmtWeight(g: number | null): string {
  if (g === null) return '—';
  if (g >= 1000) return `${(g / 1000).toFixed(3)} kg`;
  return `${g} g`;
}

function fmtCm(cm: number | null): string {
  return cm === null ? '—' : `${cm} cm`;
}

function pctChip(p: number | null) {
  if (p === null) return null;
  const r = Math.round(p);
  const tone =
    r < 3 || r > 97
      ? 'bg-amber-500/15 text-amber-700'
      : r < 15 || r > 85
        ? 'bg-secondary text-secondary-foreground'
        : 'bg-primary/10 text-primary';
  return (
    <span className={cn('inline-block rounded-full px-1.5 py-0.5 font-mono text-[9px]', tone)}>
      p{r}
    </span>
  );
}

interface MeasurementRow {
  id: string;
  measured_at: string;
  weight_grams: number | null;
  height_cm: number | null;
  head_circumference_cm: number | null;
  notes: string | null;
}

export default async function InformePage() {
  const supabase = await createClient();

  const { data: child } = await supabase
    .from('child_profiles')
    .select(
      'id, name, birth_date, sex, blood_type, health_insurance, pediatrician_name, pediatrician_phone, gestational_weeks_at_birth, is_preterm',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const childId = child?.id as string | undefined;
  const birthDate = (child?.birth_date as string | null | undefined) ?? null;
  const rawSex = (child?.sex as string | null | undefined) ?? null;
  const childSex: Sex | null = rawSex === 'male' || rawSex === 'female' ? rawSex : null;

  const [measData, medData, formulaData] = await Promise.all([
    childId
      ? supabase
          .from('child_measurements')
          .select('id, measured_at, weight_grams, height_cm, head_circumference_cm, notes')
          .eq('child_id', childId)
          .is('deleted_at', null)
          .order('measured_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: null }),
    childId
      ? supabase
          .from('medication_doses')
          .select('id, medication_name, dose_amount, interval_hours, given_at, next_dose_at, notes')
          .eq('child_id', childId)
          .is('deleted_at', null)
          .gte('given_at', new Date(Date.now() - 14 * 24 * 3_600_000).toISOString())
          .order('given_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
    childId
      ? supabase
          .from('formula_stock')
          .select('brand, current_boxes, ml_per_box, alert_threshold')
          .eq('child_id', childId)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const measurements = (measData.data ?? []) as MeasurementRow[];
  const medications = (medData.data ?? []) as Array<{
    id: string;
    medication_name: string;
    dose_amount: string | null;
    interval_hours: number | null;
    given_at: string;
    next_dose_at: string | null;
    notes: string | null;
  }>;
  const formula = formulaData.data as {
    brand: string | null;
    current_boxes: number;
    ml_per_box: number;
    alert_threshold: number;
  } | null;

  function pctFor(
    kind: 'weight' | 'length' | 'head_circumference',
    value: number | null,
    measuredAt: string,
  ): number | null {
    if (!birthDate || !childSex || value === null) return null;
    const ageDays = Math.floor(
      (new Date(measuredAt).getTime() - new Date(birthDate).getTime()) / 86_400_000,
    );
    const v = kind === 'weight' ? value / 1000 : value;
    return percentileForMeasurement({ sex: childSex, kind, value: v, ageDays });
  }

  const age = child?.birth_date ? babyAgeFromBirth(child.birth_date as string) : null;
  const generatedAt = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  // Dedup medicamentos: agrupar por nombre y mostrar la más reciente.
  const dedupedMeds = Object.values(
    medications.reduce<
      Record<
        string,
        {
          medication_name: string;
          dose_amount: string | null;
          interval_hours: number | null;
          given_at: string;
          next_dose_at: string | null;
          notes: string | null;
        }
      >
    >((acc, med) => {
      if (!acc[med.medication_name]) acc[med.medication_name] = med;
      return acc;
    }, {}),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14 print:p-0 print:py-0">
      {/* Controles de pantalla — se ocultan al imprimir */}
      <div className="flex items-center justify-between print:hidden">
        <Button
          render={<Link href={'/cuidar' as Route} />}
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Cuidar
        </Button>
        <PrintButton />
      </div>

      {/* Documento imprimible */}
      <article className="flex flex-col gap-8 print:gap-6">
        {/* Encabezado del documento */}
        <header className="flex flex-col gap-1 border-border border-b pb-5 print:pb-4">
          <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            Salu — Sistema familiar de crianza
          </p>
          <h1 className="font-display text-2xl text-foreground tracking-tight sm:text-3xl">
            Resumen para la pediatra.
          </h1>
          <p className="text-muted-foreground text-sm">Generado el {generatedAt}</p>
        </header>

        {/* Sección: Datos del bebé */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Datos del bebé</SectionTitle>
          {child ? (
            <div className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2 print:grid-cols-2 print:rounded-none print:border-0 print:p-0">
              <DataRow label="Nombre" value={child.name as string} />
              {age && !age.unborn && <DataRow label="Edad" value={age.label} />}
              {birthDate && <DataRow label="Fecha de nacimiento" value={fmtDate(birthDate)} />}
              {rawSex && (
                <DataRow
                  label="Sexo"
                  value={rawSex === 'male' ? 'Varón' : rawSex === 'female' ? 'Nena' : 'Otro'}
                />
              )}
              {(child.is_preterm as boolean | null) &&
                (child.gestational_weeks_at_birth as number | null) && (
                  <DataRow
                    label="Prematurez"
                    value={`Prematuro — ${child.gestational_weeks_at_birth as number} semanas`}
                  />
                )}
              {(child.blood_type as string | null) && (
                <DataRow label="Grupo sanguíneo" value={child.blood_type as string} />
              )}
              {(child.health_insurance as string | null) && (
                <DataRow label="Obra social" value={child.health_insurance as string} />
              )}
              {(child.pediatrician_name as string | null) && (
                <DataRow
                  label="Pediatra"
                  value={`${child.pediatrician_name as string}${child.pediatrician_phone ? ` · ${child.pediatrician_phone as string}` : ''}`}
                />
              )}
            </div>
          ) : (
            <EmptyNote>No hay perfil del bebé configurado.</EmptyNote>
          )}
        </section>

        {/* Sección: Mediciones */}
        <section className="flex flex-col gap-3">
          <SectionTitle>
            Mediciones (últimas {measurements.length > 0 ? measurements.length : '0'})
          </SectionTitle>
          {measurements.length === 0 ? (
            <EmptyNote>No hay mediciones registradas.</EmptyNote>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border print:rounded-none print:border-x-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border border-b bg-muted/40 print:bg-transparent">
                    <Th>Fecha</Th>
                    <Th>Peso</Th>
                    <Th>p%</Th>
                    <Th>Talla</Th>
                    <Th>p%</Th>
                    <Th>Cabeza</Th>
                    <Th>Notas</Th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, i) => {
                    const wPct = pctFor('weight', m.weight_grams, m.measured_at);
                    const hPct = pctFor('length', m.height_cm, m.measured_at);
                    return (
                      <tr
                        key={m.id}
                        className={cn(
                          'border-border/60 border-b last:border-0',
                          i % 2 === 0 ? 'bg-card' : 'bg-muted/20 print:bg-transparent',
                        )}
                      >
                        <Td>{fmtDate(m.measured_at)}</Td>
                        <Td>{fmtWeight(m.weight_grams)}</Td>
                        <Td>{pctChip(wPct) ?? <span className="text-muted-foreground">—</span>}</Td>
                        <Td>{fmtCm(m.height_cm)}</Td>
                        <Td>{pctChip(hPct) ?? <span className="text-muted-foreground">—</span>}</Td>
                        <Td>{fmtCm(m.head_circumference_cm)}</Td>
                        <Td className="max-w-[140px] truncate text-muted-foreground text-xs">
                          {m.notes ?? '—'}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {childSex && (
            <p className="text-muted-foreground/70 text-xs">
              Percentiles según curvas OMS 0-24 meses para{' '}
              {childSex === 'male' ? 'varones' : 'nenas'}. Referencia orientativa.
            </p>
          )}
        </section>

        {/* Sección: Medicamentos */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Medicamentos (últimos 14 días)</SectionTitle>
          {dedupedMeds.length === 0 ? (
            <EmptyNote>Sin medicamentos registrados en los últimos 14 días.</EmptyNote>
          ) : (
            <div className="flex flex-col gap-2">
              {dedupedMeds.map((med) => (
                <div
                  key={med.medication_name}
                  className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-3 print:rounded-none print:border-x-0 print:px-0"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-foreground text-sm">
                      {med.medication_name}
                    </span>
                    {med.dose_amount && (
                      <span className="text-muted-foreground text-xs">{med.dose_amount}</span>
                    )}
                    {med.interval_hours && (
                      <span className="text-muted-foreground text-xs">
                        · c/{med.interval_hours}h
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Última dosis: {fmtDate(med.given_at)}
                    {med.next_dose_at && ` · Próxima: ${fmtDate(med.next_dose_at)}`}
                  </span>
                  {med.notes && (
                    <span className="text-muted-foreground/80 text-xs italic">{med.notes}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección: Fórmula */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Fórmula</SectionTitle>
          {formula ? (
            <div className="rounded-xl border border-border bg-card p-4 print:rounded-none print:border-x-0 print:px-0">
              <div className="grid gap-2 text-sm sm:grid-cols-2 print:grid-cols-2">
                {formula.brand && <DataRow label="Marca" value={formula.brand} />}
                <DataRow label="Presentación" value={`${formula.ml_per_box} ml por caja`} />
                <DataRow
                  label="Stock actual"
                  value={`${formula.current_boxes} caja${formula.current_boxes === 1 ? '' : 's'}`}
                />
                <DataRow
                  label="Alerta en"
                  value={`${formula.alert_threshold} caja${formula.alert_threshold === 1 ? '' : 's'}`}
                />
              </div>
            </div>
          ) : (
            <EmptyNote>Sin fórmula configurada.</EmptyNote>
          )}
        </section>

        {/* Footer impreso */}
        <footer className="border-border border-t pt-4 text-muted-foreground text-xs print:mt-4">
          <p>
            Este informe fue generado por Salu el {generatedAt}. No reemplaza el criterio clínico de
            la pediatra.
          </p>
        </footer>
      </article>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.22em]">
      {children}
    </h2>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm italic">{children}</p>;
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2 text-foreground', className)}>{children}</td>;
}
