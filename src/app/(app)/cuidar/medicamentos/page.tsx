import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { Clock, Pencil, Pill, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { CountdownChip } from './_components/countdown-chip';
import { DeleteDoseButton } from './_components/delete-dose-button';
import { RepeatDoseButton } from './_components/repeat-dose-button';

export const metadata: Metadata = {
  title: 'Medicamentos',
};

interface MedicationDose {
  id: string;
  medication_name: string;
  dose_amount: string | null;
  given_at: string;
  interval_hours: number | null;
  next_dose_at: string | null;
  notes: string | null;
}

type NextDoseStatus = 'ok' | 'soon' | 'overdue' | 'no-schedule';

function getNextDoseStatus(nextDoseAt: string | null, now: Date): NextDoseStatus {
  if (!nextDoseAt) return 'no-schedule';
  const diffMin = (new Date(nextDoseAt).getTime() - now.getTime()) / 60_000;
  if (diffMin > 60) return 'ok';
  if (diffMin > 0) return 'soon';
  return 'overdue';
}

function formatCountdown(nextDoseAt: string, now: Date): string {
  const diffMin = Math.round((new Date(nextDoseAt).getTime() - now.getTime()) / 60_000);
  if (diffMin > 0) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    if (h === 0) return `en ${m}m`;
    if (m === 0) return `en ${h}h`;
    return `en ${h}h ${m}m`;
  }
  const over = Math.abs(diffMin);
  if (over < 60) return `hace ${over}m`;
  const h = Math.floor(over / 60);
  const m = over % 60;
  return `hace ${h}h${m > 0 ? ` ${m}m` : ''}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function formatDayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const todayStr = now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const dStr = d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  if (dStr === todayStr) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  if (dStr === yStr) return 'Ayer';
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

const STATUS_STYLES: Record<NextDoseStatus, string> = {
  ok: 'bg-green-500/10 text-green-700 dark:text-green-400',
  soon: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  overdue: 'bg-red-500/10 text-red-700 dark:text-red-400',
  'no-schedule': 'bg-muted text-muted-foreground',
};

export default async function MedicamentosPage() {
  const supabase = await createClient();

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rawDoses } = child
    ? await supabase
        .from('medication_doses')
        .select('id, medication_name, dose_amount, given_at, interval_hours, next_dose_at, notes')
        .eq('child_id', child.id)
        .is('deleted_at', null)
        .gte('given_at', since7d)
        .order('given_at', { ascending: false })
    : { data: null };

  const doses = (rawDoses ?? []) as MedicationDose[];
  const now = new Date();

  // Medicamentos activos: última dosis por nombre, de las últimas 48 h.
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const recent = doses.filter((d) => d.given_at >= since48h);
  const byName = new Map<string, MedicationDose>();
  for (const dose of recent) {
    if (!byName.has(dose.medication_name)) {
      byName.set(dose.medication_name, dose);
    }
  }
  const activeDoses = Array.from(byName.values());

  // Historial agrupado por día.
  const grouped = new Map<string, MedicationDose[]>();
  for (const dose of doses) {
    const dayKey = new Date(dose.given_at).toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    if (!grouped.has(dayKey)) grouped.set(dayKey, []);
    grouped.get(dayKey)?.push(dose);
  }
  const historyDays = Array.from(grouped.entries());

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Cuidar · Salud"
          title="Medicamentos."
          description="Registrá cada dosis y el sistema te avisa cuándo toca la siguiente."
        />
        <Button
          render={<Link href={'/cuidar/medicamentos/nueva' as Route} />}
          size="sm"
          className="mt-1 shrink-0"
        >
          <Plus className="size-4" aria-hidden />
          Registrar
        </Button>
      </div>

      {doses.length === 0 && (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Pill className="size-8 text-muted-foreground/50" aria-hidden />
          <p className="text-muted-foreground text-sm">No hay dosis registradas todavía.</p>
          <Button
            render={<Link href={'/cuidar/medicamentos/nueva' as Route} />}
            variant="outline"
            size="sm"
          >
            Registrar primera dosis
          </Button>
        </Card>
      )}

      {activeDoses.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            En curso
          </h2>
          <div className="flex flex-col gap-2">
            {activeDoses.map((dose) => {
              const status = getNextDoseStatus(dose.next_dose_at, now);
              return (
                <Card key={dose.id} className="flex flex-col gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        STATUS_STYLES[status],
                      )}
                    >
                      <Pill className="size-4" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium text-foreground text-sm">
                        {dose.medication_name}
                        {dose.dose_amount && (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {dose.dose_amount}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Última: {formatTime(dose.given_at)}
                      </span>
                    </div>
                    {dose.next_dose_at && <CountdownChip nextDoseAt={dose.next_dose_at} />}
                  </div>
                  <div className="flex gap-2 border-t border-border/50 pt-2">
                    <RepeatDoseButton doseId={dose.id} medicationName={dose.medication_name} />
                    <Button
                      render={<Link href={`/cuidar/medicamentos/nueva?from=${dose.id}` as Route} />}
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 px-3 text-xs"
                      aria-label={`Ajustar hora de dosis de ${dose.medication_name}`}
                    >
                      <Pencil className="size-3" aria-hidden />
                      Ajustar hora
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {historyDays.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            Historial de la semana
          </h2>
          <div className="flex flex-col gap-5">
            {historyDays.map(([dayKey, dayDoses]) => (
              <div key={dayKey} className="flex flex-col gap-2">
                <span className="font-medium text-muted-foreground text-xs">
                  {dayDoses[0] ? formatDayLabel(dayDoses[0].given_at, now) : null}
                </span>
                {dayDoses.map((dose) => (
                  <Card key={dose.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium text-foreground text-sm">
                        {dose.medication_name}
                        {dose.dose_amount && (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {dose.dose_amount}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatTime(dose.given_at)}
                        {dose.interval_hours && (
                          <span className="ml-2 opacity-70">· cada {dose.interval_hours}h</span>
                        )}
                      </span>
                      {dose.notes && (
                        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                          {dose.notes}
                        </p>
                      )}
                    </div>
                    <DeleteDoseButton id={dose.id} />
                  </Card>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
