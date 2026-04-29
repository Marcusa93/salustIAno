import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { ChevronLeft, Pencil, Ruler } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteMeasurementButton } from './_components/delete-measurement-button';

export const metadata: Metadata = {
  title: 'Medición',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtWeight(g: number | null): string {
  if (g === null) return '—';
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg (${g} g)`;
  return `${g} g`;
}

interface DataRowProps {
  label: string;
  value: string;
}

function DataRow({ label, value }: DataRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-border border-b py-2 last:border-b-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}

export default async function MeasurementDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: measurement, error } = await supabase
    .from('child_measurements')
    .select('id, child_id, measured_at, weight_grams, height_cm, head_circumference_cm, notes')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !measurement) notFound();

  // Para canEdit consultamos el rol del user (admin only por ADR 0004).
  const { data: userData } = await supabase.auth.getUser();
  let canEdit = false;
  if (userData.user) {
    const { data: child } = await supabase
      .from('child_profiles')
      .select('family_group_id')
      .eq('id', measurement.child_id)
      .maybeSingle();
    if (child) {
      const { data: membership } = await supabase
        .from('family_memberships')
        .select('role')
        .eq('user_id', userData.user.id)
        .eq('family_group_id', child.family_group_id)
        .is('deleted_at', null)
        .maybeSingle();
      canEdit = membership?.role === 'admin';
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button
          render={<Link href="/cuidar/mediciones" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Ruler className="size-7" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
              Medición
            </h1>
            <p className="text-muted-foreground">{formatDateTime(measurement.measured_at)}</p>
          </div>
        </div>
      </header>

      <Card className="p-6">
        <DataRow label="Peso" value={fmtWeight(measurement.weight_grams)} />
        <DataRow
          label="Talla"
          value={measurement.height_cm !== null ? `${measurement.height_cm} cm` : '—'}
        />
        <DataRow
          label="Perímetro cefálico"
          value={
            measurement.head_circumference_cm !== null
              ? `${measurement.head_circumference_cm} cm`
              : '—'
          }
        />
      </Card>

      {measurement.notes && (
        <Card className="p-6">
          <h2 className="mb-3 font-medium text-foreground text-sm uppercase tracking-wider">
            Notas
          </h2>
          <p className="whitespace-pre-wrap text-foreground leading-relaxed">{measurement.notes}</p>
        </Card>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2 border-border border-t pt-4">
          <Button
            render={<Link href={`/cuidar/mediciones/${measurement.id}/editar` as Route} />}
            variant="default"
            size="sm"
          >
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
          <DeleteMeasurementButton id={measurement.id} />
        </div>
      )}
    </div>
  );
}
