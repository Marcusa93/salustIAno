import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { chronologicalAgeDays, correctedAgeDays } from '@/lib/validators/child-profile';
import { Baby, ChevronLeft, Pencil } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteChildButton } from './_components/delete-child-button';

export const metadata: Metadata = {
  title: 'Perfil del bebé',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(time: string | null): string {
  if (!time) return '—';
  return time.slice(0, 5);
}

function formatNumber(n: number | null, unit: string): string {
  if (n === null) return '—';
  return `${n} ${unit}`;
}

function formatAge(days: number | null): string {
  if (days === null) return '—';
  if (days < 0)
    return `Falta${days < -1 ? 'n' : ''} ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days < 7) return `${days} día${days === 1 ? '' : 's'}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} semana${weeks === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} mes${months === 1 ? '' : 'es'}`;
  const years = Math.floor(days / 365);
  return `${years} año${years === 1 ? '' : 's'}`;
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

export default async function ChildDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: child, error } = await supabase
    .from('child_profiles')
    .select(
      'id, family_group_id, name, birth_date, birth_time, birth_place, birth_weight_grams, birth_height_cm, gestational_weeks_at_birth, is_preterm, pediatrician_name, pediatrician_phone, health_insurance, blood_type, notes, created_at',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !child) notFound();

  const { data: userData } = await supabase.auth.getUser();

  // Solo admin de la familia ve botones de editar/borrar.
  let canEdit = false;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('family_group_id', child.family_group_id)
      .is('deleted_at', null)
      .maybeSingle();
    canEdit = membership?.role === 'admin';
  }

  const chronological = chronologicalAgeDays(child.birth_date);
  const corrected = correctedAgeDays(child.birth_date, child.gestational_weeks_at_birth);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <Button render={<Link href="/familia" />} variant="ghost" size="sm" className="self-start">
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Baby className="size-7" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl text-foreground tracking-tight sm:text-4xl">
              {child.name}
            </h1>
            <p className="text-muted-foreground">
              {child.birth_date ? `Nació el ${formatDate(child.birth_date)}` : 'Todavía no nació'}
            </p>
            {child.is_preterm && (
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-secondary px-2.5 py-0.5 font-medium text-secondary-foreground text-xs">
                Prematuro
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Edad */}
      {child.birth_date && (
        <Card className="p-6">
          <h2 className="mb-3 font-medium text-foreground text-sm uppercase tracking-wider">
            Edad
          </h2>
          <DataRow label="Cronológica" value={formatAge(chronological)} />
          {corrected !== null && <DataRow label="Corregida" value={formatAge(corrected)} />}
        </Card>
      )}

      {/* Identidad */}
      <Card className="p-6">
        <h2 className="mb-3 font-medium text-foreground text-sm uppercase tracking-wider">
          Identidad
        </h2>
        <DataRow label="Fecha de nacimiento" value={formatDate(child.birth_date)} />
        <DataRow label="Hora" value={formatTime(child.birth_time)} />
        <DataRow label="Lugar" value={child.birth_place || '—'} />
      </Card>

      {/* Al nacer */}
      <Card className="p-6">
        <h2 className="mb-3 font-medium text-foreground text-sm uppercase tracking-wider">
          Al nacer
        </h2>
        <DataRow label="Peso" value={formatNumber(child.birth_weight_grams, 'g')} />
        <DataRow label="Talla" value={formatNumber(child.birth_height_cm, 'cm')} />
        <DataRow
          label="Edad gestacional"
          value={
            child.gestational_weeks_at_birth ? `${child.gestational_weeks_at_birth} semanas` : '—'
          }
        />
      </Card>

      {/* Salud */}
      <Card className="p-6">
        <h2 className="mb-3 font-medium text-foreground text-sm uppercase tracking-wider">Salud</h2>
        <DataRow label="Tipo de sangre" value={child.blood_type || '—'} />
        <DataRow label="Obra social" value={child.health_insurance || '—'} />
        <DataRow label="Pediatra" value={child.pediatrician_name || '—'} />
        <DataRow label="Teléfono pediatra" value={child.pediatrician_phone || '—'} />
      </Card>

      {child.notes && (
        <Card className="p-6">
          <h2 className="mb-3 font-medium text-foreground text-sm uppercase tracking-wider">
            Alergias y notas
          </h2>
          <p className="whitespace-pre-wrap text-foreground leading-relaxed">{child.notes}</p>
        </Card>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2 border-border border-t pt-4">
          <Button
            render={<Link href={`/familia/bebe/${child.id}/editar` as Route} />}
            variant="default"
            size="sm"
          >
            <Pencil className="size-4" aria-hidden />
            Editar perfil
          </Button>
          <DeleteChildButton id={child.id} name={child.name} />
        </div>
      )}
    </div>
  );
}
