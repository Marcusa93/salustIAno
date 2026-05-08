import { CloseSleepSheet } from '@/app/(app)/home/_components/close-sleep-sheet';
import { SleepQuickAdd } from '@/app/(app)/home/_components/sleep-quick-add';
import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { babyAgeFromBirth, durationLabel } from '@/lib/baby-age';
import { createClient } from '@/lib/supabase/server';
import { SLEEP_QUALITY_LABELS, type SleepQuality } from '@/lib/validators/events';
import { suggestNextSleep } from '@/lib/wake-windows';
import { ChevronLeft, Info, Moon, Plus, Shield, Sun } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sueño',
};

interface SleepRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  quality: SleepQuality;
  is_nap: boolean;
}

const SAFE_SLEEP_TIPS = [
  'Boca arriba para cada sueño durante el primer año.',
  'Cuna o moisés con colchón firme, sin almohadas, mantas sueltas, peluches ni protectores.',
  'Sin colecho en superficies blandas (sillón, cama de adultos sin protocolo).',
  'Habitación entre 18 °C y 22 °C, ropa liviana — un saco de dormir es más seguro que mantas.',
  'Sin tabaco en el ambiente. Si la madre fumó en el embarazo, el riesgo persiste.',
  'Cuna en la habitación de los padres durante los primeros 6 meses.',
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatRangeTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function totalMinutesIn(sessions: ReadonlyArray<SleepRow>, since: Date): number {
  let total = 0;
  const sinceMs = since.getTime();
  for (const s of sessions) {
    const start = Math.max(new Date(s.started_at).getTime(), sinceMs);
    const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    if (end > start) total += (end - start) / 60_000;
  }
  return Math.round(total);
}

function minutesToHm(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default async function SleepTrackerPage() {
  const supabase = await createClient();

  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!child) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <PageHeader eyebrow="Sueño" title="Todavía no hay perfil de bebé." />
        <Card className="p-6">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Creá el perfil del bebé desde Familia para empezar a anotar sueños.
          </p>
        </Card>
      </div>
    );
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: sessions } = await supabase
    .from('sleep_sessions')
    .select('id, started_at, ended_at, quality, is_nap')
    .eq('child_id', child.id)
    .is('deleted_at', null)
    .gte('started_at', since24h.toISOString())
    .order('started_at', { ascending: false })
    .limit(50);

  const all = (sessions ?? []) as SleepRow[];
  const active = all.find((s) => s.ended_at === null) ?? null;
  const closed = all.filter((s) => s.ended_at !== null);
  const lastClosed = closed[0] ?? null;

  const ageDays = babyAgeFromBirth(child.birth_date)?.days ?? null;
  const suggestion =
    !active && lastClosed?.ended_at ? suggestNextSleep(ageDays, lastClosed.ended_at) : null;

  const total24hMin = totalMinutesIn(all, since24h);
  const naps24h = closed.filter((s) => s.is_nap).length + (active?.is_nap ? 1 : 0);

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
        eyebrow="Sueño"
        title="Cómo viene el descanso."
        description={`Últimas 24 horas de ${child.name}. Ventanas de vigilia orientativas según la edad.`}
        action={
          <SleepQuickAdd
            trigger={
              <Button type="button" size="sm">
                <Plus className="size-4" aria-hidden />
                Anotar sueño
              </Button>
            }
          />
        }
      />

      {/* Estado actual: durmiendo o despierto + sugerencia */}
      {active ? (
        <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Moon className="size-5" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {active.is_nap ? 'Está en la siesta' : 'Está durmiendo'}
            </span>
            <span className="text-muted-foreground text-sm">
              Empezó a las {formatTime(active.started_at)} · lleva{' '}
              {durationLabel(active.started_at)}.
            </span>
          </div>
          <CloseSleepSheet
            sessionId={active.id}
            startedAt={active.started_at}
            trigger={
              <Button type="button" size="sm" variant="outline">
                <Sun className="size-4" aria-hidden />
                Se despertó
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="flex flex-col gap-3 border-border/60 bg-card p-5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/40 text-accent-foreground">
            <Sun className="size-5" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-foreground">Está despierto.</span>
            {lastClosed?.ended_at ? (
              <span className="text-muted-foreground text-sm">
                Se despertó {durationLabel(lastClosed.ended_at)} (a las{' '}
                {formatTime(lastClosed.ended_at)}).
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">Sin sueños cerrados todavía.</span>
            )}
          </div>
        </Card>
      )}

      {/* Ventana sugerida — solo si hay edad + último despertar conocido */}
      {suggestion && (
        <Card className="flex items-start gap-3 border-accent/40 bg-accent/20 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background/60 text-accent-foreground">
            <Info className="size-4" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium text-foreground text-sm">
              Ventana sugerida: dormir entre {formatRangeTime(suggestion.rangeStart)} y{' '}
              {formatRangeTime(suggestion.rangeEnd)}.
            </span>
            <span className="text-muted-foreground text-xs leading-relaxed">
              Orientativo para la edad de {suggestion.window.ageLabel} (
              {suggestion.window.minMinutes}–{suggestion.window.maxMinutes} min de vigilia). Cada
              bebé es distinto — vos sabés mejor que la tabla.
            </span>
          </div>
        </Card>
      )}

      {/* Totales últimas 24h */}
      <section className="grid grid-cols-3 gap-3">
        <SummaryCell label="Sueño total" value={minutesToHm(total24hMin)} />
        <SummaryCell label="Sueños" value={String(closed.length + (active ? 1 : 0))} />
        <SummaryCell label="Siestas" value={String(naps24h)} />
      </section>

      {/* Lista de sueños recientes */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground text-sm">Últimas 24 horas</h2>
        {all.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">
            Todavía no hay sueños registrados. Tocá <strong>Anotar sueño</strong> arriba o pedile a
            SaluIA.
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {all.map((s) => (
              <li key={s.id}>
                <SleepRowCard row={s} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sueño seguro — contenido estático AAP */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-primary" aria-hidden />
          <h2 className="font-semibold text-foreground text-sm">Sueño seguro</h2>
        </div>
        <Card className="flex flex-col gap-2 p-5">
          <ul className="flex flex-col gap-2 text-muted-foreground text-sm leading-relaxed">
            {SAFE_SLEEP_TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground/80 text-xs">
            Recomendaciones de la Academia Americana de Pediatría (prevención de SMSL). Ante
            cualquier duda, consultá con la pediatra.
          </p>
        </Card>
      </section>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col items-center gap-1 border-border/60 p-4">
      <span className="font-display text-2xl text-foreground tracking-tight">{value}</span>
      <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </span>
    </Card>
  );
}

function SleepRowCard({ row }: { row: SleepRow }) {
  const ended = row.ended_at;
  const startTime = formatTime(row.started_at);
  const endTime = ended ? formatTime(ended) : null;
  const duration = ended
    ? durationLabel(row.started_at, ended)
    : `${durationLabel(row.started_at)} · en curso`;
  return (
    <Card className="flex items-center gap-3 border-border/60 p-3.5">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Moon className="size-4" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-foreground text-sm">
          {row.is_nap ? 'Siesta' : 'Sueño'} · {startTime}
          {endTime ? ` → ${endTime}` : ''}
        </span>
        <span className="text-muted-foreground text-xs">
          {duration}
          {row.quality !== 'unknown' && ` · ${SLEEP_QUALITY_LABELS[row.quality]}`}
        </span>
      </div>
    </Card>
  );
}
