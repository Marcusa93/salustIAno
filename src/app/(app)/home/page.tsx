import { CradleIllustration } from '@/components/salu/illustrations/cradle';
import { TimelineEmptyIllustration } from '@/components/salu/illustrations/timeline-empty';
import { Salu360Avatar } from '@/components/salu/salu-360-avatar';
import { WelcomeOverlay } from '@/components/salu/welcome-overlay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { expectationsFor } from '@/lib/baby-expectations';
import { scheduledLetterAt } from '@/lib/carta/letter-window';
import { startOfDayArDaysAgo, startOfTodayAr } from '@/lib/format-ar';
import { greetingFor, isLateNightAr } from '@/lib/greeting';
import { preciseAgeLabel } from '@/lib/home-now';
import { averagePerDay, formatPredictionTime, predictNextFeeding } from '@/lib/predictions';
import { createClient } from '@/lib/supabase/server';
import type { MilestoneCategory } from '@/lib/validators/milestone';
import { wakeWindowFor } from '@/lib/wake-windows';
import { Moon, Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { DailySummaryCard } from './_components/daily-summary-card';
import { DiaperQuickAdd } from './_components/diaper-quick-add';
import { ExpectationsCard } from './_components/expectations-card';
import { FamilyActivityCard } from './_components/family-activity-card';
import { FeedingQuickAdd } from './_components/feeding-quick-add';
import { LetterEnvelopeCard } from './_components/letter-envelope-card';
import { LogDock } from './_components/log-dock';
import { NightCoachCard } from './_components/night-coach-card';
import { NowCard } from './_components/now-card';
import { RealtimeRefresher } from './_components/realtime-refresher';
import { RecentEventsGrouped, type RecentTimelineRow } from './_components/recent-events-grouped';
import { ShareDayCard } from './_components/share-day-card';
import { SleepQuickAdd } from './_components/sleep-quick-add';
import { UpcomingControlsCard } from './_components/upcoming-controls-card';
import { getTodayActivityByMemberAction } from './family-activity-actions';
import { getDayShareSnapshotAction } from './share-day-actions';

export const metadata: Metadata = {
  title: 'Casa',
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, name, birth_date')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let displayName: string | null = null;
  if (userData.user) {
    const { data: membership } = await supabase
      .from('family_memberships')
      .select('display_name')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    displayName = membership?.display_name ?? null;
  }

  // Sin perfil del bebé: onboarding suave (sin hero ni stats).
  if (!child) {
    const greeting = greetingFor();
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] text-foreground leading-[1.05] tracking-tight">
            {greeting}
            {displayName ? `, ${displayName}` : ''}.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Acá te esperamos cuando creemos el perfil.
          </p>
        </header>
        <Card className="flex flex-col items-center gap-6 p-10 text-center sm:p-12">
          <div className="text-primary">
            <CradleIllustration size={140} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl text-foreground tracking-tight sm:text-3xl">
              Empezá por el perfil del bebé.
            </h2>
            <p className="max-w-md text-muted-foreground text-sm leading-relaxed sm:text-base">
              Cargalo con lo que ya sabés (nombre, pediatra, fecha esperada). Después, cuando lo
              tengas en brazos, anotás tomas, sueños y pañales en dos toques.
            </p>
          </div>
          <Button render={<Link href="/familia/bebe/nuevo" />} size="lg">
            <Plus className="size-4" aria-hidden />
            Crear perfil
          </Button>
        </Card>
      </div>
    );
  }

  // 'Hoy' en hora Argentina — sin esto, en Vercel UTC los counts del
  // día aparecen desincronizados (la medianoche UTC son las 21h AR del
  // día anterior).
  const todayStart = startOfTodayAr();

  const upcomingHorizon = new Date();
  upcomingHorizon.setDate(upcomingHorizon.getDate() + 14);

  // Ventana de 7 días para tendencia semanal y predicciones rule-based.
  const since7d = startOfDayArDaysAgo(7);

  const [
    { data: recentEvents },
    { data: todayEvents },
    { data: activeSleeps },
    { data: lastClosedSleep },
    { data: lastFeeding },
    { data: lastDiaper },
    { data: feedingsLast7 },
    { data: diapersLast7 },
    { data: sleepsLast7 },
    todayActivity,
    shareSnapshot,
    { data: upcomingMilestones },
  ] = await Promise.all([
    supabase.rpc('get_timeline', {
      p_child_id: child.id,
      p_event_types: ['feeding', 'sleep', 'diaper'],
      p_limit: 12,
      p_offset: 0,
    }),
    supabase.rpc('get_timeline', {
      p_child_id: child.id,
      p_event_types: ['feeding', 'sleep', 'diaper'],
      p_from: todayStart.toISOString(),
      p_limit: 200,
      p_offset: 0,
    }),
    supabase
      .from('sleep_sessions')
      .select('id, started_at, is_nap')
      .eq('child_id', child.id)
      .is('ended_at', null)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(1),
    supabase
      .from('sleep_sessions')
      .select('ended_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('feeding_events')
      .select('occurred_at, type, amount_ml, duration_minutes')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('diaper_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Últimos 7 días — para predicciones y tendencia semanal.
    supabase
      .from('feeding_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', since7d.toISOString())
      .order('occurred_at', { ascending: true }),
    supabase
      .from('diaper_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', since7d.toISOString())
      .order('occurred_at', { ascending: true }),
    supabase
      .from('sleep_sessions')
      .select('started_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('started_at', since7d.toISOString()),
    getTodayActivityByMemberAction(),
    getDayShareSnapshotAction(),
    supabase
      .from('medical_milestones')
      .select('id, title, category, due_at, completed_at')
      .is('deleted_at', null)
      .is('completed_at', null)
      .lte('due_at', upcomingHorizon.toISOString())
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(3),
  ]);

  const recents = (recentEvents ?? []) as RecentTimelineRow[];
  const today = (todayEvents ?? []) as RecentTimelineRow[];
  const activeSleep = (activeSleeps?.[0] ?? null) as {
    id: string;
    started_at: string;
    is_nap: boolean;
  } | null;
  const lastClosedSleepAt = (lastClosedSleep?.ended_at as string | null | undefined) ?? null;
  const lastFeedingAt = (lastFeeding?.occurred_at as string | null | undefined) ?? null;
  const lastDiaperAt = (lastDiaper?.occurred_at as string | null | undefined) ?? null;

  // Cantidades de mamadera a un toque. Desde octubre Salu toma 100 ml como
  // mínimo; cualquier otra cantidad va por "Más".
  const feedingPresets = [100, 120, 150, 180];

  const lastFeedingDetail = lastFeeding
    ? lastFeeding.amount_ml
      ? `${lastFeeding.amount_ml} ml`
      : lastFeeding.type === 'breastfeeding'
        ? lastFeeding.duration_minutes
          ? `pecho ${lastFeeding.duration_minutes} min`
          : 'pecho'
        : null
    : null;
  const todayMl = today
    .filter((e) => e.event_type === 'feeding')
    .reduce((acc, e) => acc + ((e.payload.amount_ml as number | null | undefined) ?? 0), 0);

  const todaySummary = {
    feeding: today.filter((e) => e.event_type === 'feeding').length,
    sleep: today.filter((e) => e.event_type === 'sleep').length,
    diaper: today.filter((e) => e.event_type === 'diaper').length,
  };

  // Total de horas de sueño cargadas hoy: cerradas (ended_at - started_at)
  // + activa en curso (started_at hasta ahora). Solo cuenta lo que ya
  // tiene rastro en la base — para que la card "Cómo va el día" pueda
  // detectar siestas sin cerrar.
  const todaySleepMs = today
    .filter((e) => e.event_type === 'sleep')
    .reduce((acc, e) => {
      const started = e.payload.started_at as string | undefined;
      const ended = e.payload.ended_at as string | undefined;
      if (!started) return acc;
      const startMs = new Date(started).getTime();
      const endMs = ended ? new Date(ended).getTime() : Date.now();
      const delta = endMs - startMs;
      return acc + Math.max(0, delta);
    }, 0);
  const todaySleepHours = todaySleepMs / (1000 * 60 * 60);

  const ageDays = babyAgeFromBirth(child.birth_date)?.days ?? null;
  const expectations = expectationsFor(ageDays);
  const lateNight = isLateNightAr();

  // Predicciones rule-based: mediana del intervalo entre eventos
  // consecutivos en los últimos 7 días, proyectada desde el último.
  // Pueden ser null si no hay suficientes datos.
  const feedings7Iso = (feedingsLast7 ?? []).map((e) => (e as { occurred_at: string }).occurred_at);
  const diapers7Iso = (diapersLast7 ?? []).map((e) => (e as { occurred_at: string }).occurred_at);

  const feedingPrediction = lastFeedingAt ? predictNextFeeding(feedings7Iso, lastFeedingAt) : null;
  const predictedNextFeedingLabel = feedingPrediction
    ? formatPredictionTime(feedingPrediction.expectedAt)
    : null;

  // Tendencia semanal: promedio de eventos por día en los últimos 7 días
  // (incluyendo hoy). Para sueño usamos el conteo de sesiones, no horas.
  const weeklyAvg = {
    feeding: averagePerDay(feedings7Iso.length, 7),
    diaper: averagePerDay(diapers7Iso.length, 7),
    sleep: averagePerDay((sleepsLast7 ?? []).length, 7),
  };

  // Total de eventos del día — usado para gatear cards que sólo aportan
  // cuando hay actividad cargada (ShareDayCard).
  const totalEventsToday = todaySummary.feeding + todaySummary.sleep + todaySummary.diaper;
  const scheduledLetter = scheduledLetterAt();
  const renderedAt = new Date().toISOString();
  const ageLabel = child.birth_date ? preciseAgeLabel(child.birth_date as string) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      {/* Realtime: si otro miembro de la familia carga un evento desde
          su dispositivo, refresca la página automáticamente. */}
      <RealtimeRefresher childId={child.id as string} />

      {/* Bienvenida primer-login: solo aparece la PRIMERA vez para cada
          user (flag por userId en localStorage). Para los miembros nuevos
          que llegan con código de invitación o cuenta recién creada por
          un admin — los recibe con un mini-tour de 4 slides. */}
      {userData.user && (
        <WelcomeOverlay
          userId={userData.user.id}
          childName={child.name as string}
          displayName={displayName}
        />
      )}

      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            {greetingFor()}
            {displayName ? `, ${displayName}` : ''}
          </span>
          <h1 className="truncate font-display text-[2.4rem] text-foreground leading-none tracking-tight">
            {(child.name as string).split(' ')[0]}
          </h1>
          {ageLabel && <p className="text-muted-foreground text-sm">{ageLabel}</p>}
          {lateNight && (
            <p className="mt-1 flex items-center gap-1.5 text-sleep-foreground text-xs">
              <Moon className="size-3.5" aria-hidden />
              Modo madrugada: solo lo esencial
            </p>
          )}
        </div>
        <Salu360Avatar size={72} className="shrink-0 ring-primary/20" />
      </header>

      {/* Carta programada (ej. Día de la Madre): solo en su ventana de fechas. */}
      {scheduledLetter && <LetterEnvelopeCard slug={scheduledLetter} />}

      {/* AHORA — el estado de Salu y la acción que más probablemente toque. */}
      <NowCard
        activeSleep={activeSleep}
        lastWokeUpAt={lastClosedSleepAt}
        lastFeeding={lastFeedingAt ? { at: lastFeedingAt, detail: lastFeedingDetail } : null}
        nextFeedingLabel={predictedNextFeedingLabel}
        wakeWindow={wakeWindowFor(ageDays)}
        renderedAt={renderedAt}
      />

      {/* ANOTAR — tomas y pañales a un toque, con "Deshacer". */}
      <LogDock
        feedingPresets={feedingPresets}
        lastFeedingAt={lastFeedingAt}
        lastDiaperAt={lastDiaperAt}
        renderedAt={renderedAt}
      />

      {/* Coach pediátrico de sueño — solo en modo madrugada (22-06 AR).
          Lee la situación del bebé y devuelve diagnóstico + sugerencia.
          La card cachea el resultado 30min en localStorage para no
          quemar tokens si la familia abre la app varias veces. */}
      {lateNight && (
        <div className="animate-stagger-up" style={{ animationDelay: '60ms' }}>
          <NightCoachCard childId={child.id as string} />
        </div>
      )}

      {/* HOY — resumen del día y línea de tiempo compacta (tocar edita,
          deslizar borra). */}
      <section className="flex flex-col gap-3" aria-labelledby="hoy">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2
            id="hoy"
            className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
          >
            Hoy
          </h2>
          <Link
            href={'/timeline' as Route}
            className="font-medium text-primary text-sm hover:underline"
          >
            Ver todo
          </Link>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          <SummaryStat
            tone="feed"
            label="Tomas"
            value={String(todaySummary.feeding)}
            detail={todayMl > 0 ? `${todayMl} ml` : null}
          />
          <SummaryStat
            tone="diaper"
            label="Pañales"
            value={String(todaySummary.diaper)}
            detail={null}
          />
          <SummaryStat
            tone="sleep"
            label="Sueño"
            value={formatHours(todaySleepHours)}
            detail={
              todaySummary.sleep > 0
                ? `${todaySummary.sleep} ${todaySummary.sleep === 1 ? 'vez' : 'veces'}`
                : null
            }
          />
        </dl>
        <RecentEventsGrouped
          rows={recents}
          emptyState={
            <Card className="items-center gap-3 p-8 text-center">
              <div className="text-primary">
                <TimelineEmptyIllustration size={120} />
              </div>
              <p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
                Todavía no hay registros. Anotá la primera toma con los botones de arriba, o
                decísela a SalustIA y ella la guarda por vos.
              </p>
            </Card>
          }
        />
      </section>

      {/* Lo secundario: de madrugada se oculta para que la pantalla sea
          mínima (Ahora, Anotar, Hoy) y no encandile con información. */}
      {!lateNight && (
        <>
          {/* Resumen del día con IA */}
          <div className="animate-stagger-up" style={{ animationDelay: '120ms' }}>
            <DailySummaryCard childId={child.id as string} todayEventCount={totalEventsToday} />
          </div>

          {/* Cómo va el día — comparado contra rangos AAP por edad. La sección
          arma triggers chicos para que cada barra abra el QuickAdd
          correspondiente con un toque. */}
          {expectations && (
            <ExpectationsCard
              expectations={expectations}
              todayCounts={{
                feedingsCount: todaySummary.feeding,
                diapersCount: todaySummary.diaper,
                sleepHours: todaySleepHours,
              }}
              weeklyAverage={weeklyAvg}
              feedingTrigger={
                <FeedingQuickAdd
                  trigger={
                    <Button type="button" size="xs" variant="ghost" aria-label="Anotar toma">
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  }
                />
              }
              diaperTrigger={
                <DiaperQuickAdd
                  trigger={
                    <Button type="button" size="xs" variant="ghost" aria-label="Anotar pañal">
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  }
                />
              }
              sleepTrigger={
                <SleepQuickAdd
                  trigger={
                    <Button type="button" size="xs" variant="ghost" aria-label="Anotar sueño">
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  }
                />
              }
            />
          )}

          {/* Próximos controles (vencidos + 14 días) */}
          {upcomingMilestones && upcomingMilestones.length > 0 && (
            <div className="animate-stagger-up" style={{ animationDelay: '135ms' }}>
              <UpcomingControlsCard
                rows={(upcomingMilestones as Array<Record<string, unknown>>).map((m) => ({
                  id: m.id as string,
                  title: m.title as string,
                  category: m.category as MilestoneCategory,
                  due_at: (m.due_at as string | null) ?? null,
                  completed_at: (m.completed_at as string | null) ?? null,
                }))}
              />
            </div>
          )}

          {/* Actividad por miembro */}
          {todayActivity.length > 0 && (
            <div className="animate-stagger-up" style={{ animationDelay: '255ms' }}>
              <FamilyActivityCard activity={todayActivity} />
            </div>
          )}

          {/* Compartir el día con la familia extendida — texto + foto del
          día. Usa Web Share API en mobile, fallback a copy en desktop.
          Se oculta:
            - En madrugada (compartir a las 3am es raro y rompe el
              "modo silencioso").
            - Si no hay eventos del día (no hay nada que compartir). */}
          {totalEventsToday > 0 && <ShareDayCard initial={shareSnapshot} />}
        </>
      )}
    </div>
  );
}

const STAT_TONES = {
  feed: 'bg-feed-soft text-feed-foreground',
  diaper: 'bg-diaper-soft text-diaper-foreground',
  sleep: 'bg-sleep-soft text-sleep-foreground',
} as const;

function SummaryStat({
  tone,
  label,
  value,
  detail,
}: {
  tone: keyof typeof STAT_TONES;
  label: string;
  value: string;
  detail: string | null;
}) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-2xl px-3 py-2.5 ${STAT_TONES[tone]}`}>
      <dt className="font-medium text-[11px] uppercase tracking-wider opacity-75">{label}</dt>
      <dd className="font-display text-2xl tabular-nums leading-tight">{value}</dd>
      {detail && <dd className="text-xs opacity-75">{detail}</dd>}
    </div>
  );
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}`;
}
