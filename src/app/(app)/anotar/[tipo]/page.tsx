import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type QuickLogKind, getBottlePresets, parseQuickLogKind } from '@/lib/quick-log';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { QuickLogPanel } from './quick-log-panel';

interface Props {
  params: Promise<{ tipo: string }>;
}

const EYEBROW: Record<QuickLogKind, string> = {
  toma: 'Anotar toma',
  sueno: 'Anotar sueño',
  panal: 'Anotar pañal',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = parseQuickLogKind((await params).tipo);
  return { title: kind ? EYEBROW[kind] : 'Anotar' };
}

/**
 * Destino de los atajos del ícono instalado (manifest → shortcuts). Un toque
 * registra con la hora de ahora y vuelve al inicio. Para cargar con más
 * detalle (otra hora, notas, lado del pecho) está el formulario completo.
 */
export default async function AnotarPage({ params }: Props) {
  const kind = parseQuickLogKind((await params).tipo);
  if (!kind) notFound();

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
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:px-6">
        <PageHeader eyebrow={EYEBROW[kind]} title="Falta el perfil del bebé." />
        <Card className="flex flex-col gap-4 p-5">
          <p className="text-muted-foreground text-sm">
            Para anotar tomas, sueños y pañales primero hay que crear el perfil.
          </p>
          <Button render={<Link href="/familia/bebe/nuevo" />} size="lg">
            Crear perfil
          </Button>
        </Card>
      </div>
    );
  }

  const name = ((child.name as string | null) ?? 'Salu').split(' ')[0] || 'Salu';

  let panel: ReactNode;
  let title: string;
  if (kind === 'toma') {
    const { data: bottles } = await supabase
      .from('feeding_events')
      .select('amount_ml')
      .eq('child_id', child.id)
      .eq('type', 'bottle')
      .not('amount_ml', 'is', null)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(15);
    const presets = getBottlePresets(
      ((bottles ?? []) as { amount_ml: number | null }[]).map((b) => b.amount_ml),
    );
    title = `¿Cuánto tomó ${name}?`;
    panel = <QuickLogPanel kind="toma" presets={presets} />;
  } else if (kind === 'sueno') {
    const { data: activeSleep } = await supabase
      .from('sleep_sessions')
      .select('id, started_at, is_nap')
      .eq('child_id', child.id)
      .is('ended_at', null)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    title = activeSleep ? `${name} está durmiendo.` : `¿${name} se durmió?`;
    panel = (
      <QuickLogPanel
        kind="sueno"
        activeSleep={
          activeSleep
            ? {
                id: activeSleep.id as string,
                startedAt: activeSleep.started_at as string,
                isNap: Boolean(activeSleep.is_nap),
              }
            : null
        }
      />
    );
  } else {
    title = '¿Cómo vino el pañal?';
    panel = <QuickLogPanel kind="panal" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow={EYEBROW[kind]}
        title={title}
        description="Un toque y queda anotado con la hora de ahora."
      />
      {panel}
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 self-start text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Ir al inicio (ahí está el formulario completo)
      </Link>
    </div>
  );
}
