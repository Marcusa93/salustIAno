import { CradleIllustration } from '@/components/salu/illustrations/cradle';
import { TimelineEmptyIllustration } from '@/components/salu/illustrations/timeline-empty';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { expectationsFor } from '@/lib/baby-expectations';
import { greetingFor, isLateNightAr } from '@/lib/greeting';
import { averagePerDay, predictNextDiaper, predictNextFeeding } from '@/lib/predictions';
import { createClient } from '@/lib/supabase/server';
import type { MilestoneCategory } from '@/lib/validators/milestone';
import { Baby, BookHeart, Milk, Moon, Plus, Sparkles } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { CloseSleepSheet } from './_components/close-sleep-sheet';
import { DailySummaryCard } from './_components/daily-summary-card';
import { DiaperQuickAdd } from './_components/diaper-quick-add';
import { ExpectationsCard } from './_components/expectations-card';
import { FamilyActivityCard } from './_components/family-activity-card';
import { FeedingQuickAdd } from './_components/feeding-quick-add';
import { HomeHero } from './_components/home-hero';
import { LastEventsStrip } from './_components/last-events-strip';
import { QuickActionTile } from './_components/quick-action-tile';
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcomingHorizon = new Date();
  upcomingHorizon.setDate(upcomingHorizon.getDate() + 14);

  // Ventana de 7 días para tendencia semanal y predicciones rule-based.
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);

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
      .select('occurred_at')
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
  const nextFeeding = lastFeedingAt ? predictNextFeeding(feedings7Iso, lastFeedingAt) : null;
  const nextDiaper = lastDiaperAt ? predictNextDiaper(diapers7Iso, lastDiaperAt) : null;

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      {/* Realtime: si otro miembro de la familia carga un evento desde
          su dispositivo, refresca la página automáticamente. */}
      <RealtimeRefresher childId={child.id as string} />

      {/* ZONA 1 — HERO: estado vivo del bebé. */}
      <HomeHero
        displayName={displayName}
        childName={child.name}
        birthDate={child.birth_date}
        active={activeSleep}
        lastWokeUpAt={lastClosedSleepAt}
        lateNight={lateNight}
        awakeCta={
          <SleepQuickAdd
            trigger={
              <Button type="button" size="default" variant="outline" className="shrink-0">
                <Moon className="size-4" aria-hidden />
                Anotar siesta
              </Button>
            }
          />
        }
      />

      {/* SalustIA */}
      <Link
        href="/chat"
        className="animate-stagger-up rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{ animationDelay: '90ms' }}
      >
        <Card className="relative flex items-center gap-4 overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-accent/30 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/10">
            <Sparkles className="size-5 animate-breathe" aria-hidden />
            <span
              aria-hidden
              className="absolute inset-0 origin-center"
              style={{ animation: 'salu-orbit 9s linear infinite' }}
            >
              <span className="-translate-x-1/2 -translate-y-1 absolute top-0 left-1/2 size-1 rounded-full bg-primary/60" />
            </span>
            <span
              aria-hidden
              className="absolute inset-0 origin-center"
              style={{ animation: 'salu-orbit 7s linear infinite reverse', animationDelay: '-2s' }}
            >
              <span className="-translate-x-1 -translate-y-1/2 absolute top-1/2 left-0 size-1 rounded-full bg-accent-foreground/40" />
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">Preguntale a SalustIA</span>
            <span className="text-muted-foreground text-sm">
              Anotá una toma, un pañal o un sueño con tu voz, o preguntale cómo viene el día.
            </span>
          </div>
        </Card>
      </Link>

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

      {/* ZONA 2 — ACCIÓN: tira de últimas + carga rápida. */}
      <LastEventsStrip
        lastFeedingAt={lastFeedingAt}
        lastDiaperAt={lastDiaperAt}
        lastSleepClosedAt={activeSleep ? activeSleep.started_at : lastClosedSleepAt}
        todayCounts={todaySummary}
        nextFeeding={nextFeeding}
        nextDiaper={nextDiaper}
      />

      <section
        className="animate-stagger-up flex flex-col gap-3"
        style={{ animationDelay: '210ms' }}
      >
        <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Anotar en dos toques
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FeedingQuickAdd
            trigger={
              <button type="button" className="contents">
                <QuickActionTile
                  Icon={Milk}
                  label="Tomó"
                  lastAt={lastFeedingAt}
                  todayCount={todaySummary.feeding}
                  emphasis="primary"
                />
              </button>
            }
          />
          <SleepQuickAdd
            trigger={
              <button type="button" className="contents">
                <QuickActionTile
                  Icon={Moon}
                  label={activeSleep ? 'Durmiendo' : 'Durmió'}
                  lastAt={activeSleep ? null : lastClosedSleepAt}
                  todayCount={todaySummary.sleep}
                  microInfoOverride={activeSleep ? 'En curso' : undefined}
                />
              </button>
            }
          />
          <DiaperQuickAdd
            trigger={
              <button type="button" className="contents">
                <QuickActionTile
                  Icon={Baby}
                  label="Pañal"
                  lastAt={lastDiaperAt}
                  todayCount={todaySummary.diaper}
                />
              </button>
            }
          />
          <Link href="/notas/nuevo" className="contents">
            <QuickActionTile Icon={BookHeart} label="Momento" />
          </Link>
        </div>
      </section>

      {/* Actividad por miembro */}
      {todayActivity.length > 0 && (
        <div className="animate-stagger-up" style={{ animationDelay: '255ms' }}>
          <FamilyActivityCard activity={todayActivity} />
        </div>
      )}

      {/* ZONA 3 — HISTORIA: recientes agrupados. */}
      <section
        className="animate-stagger-up flex flex-col gap-4"
        style={{ animationDelay: '285ms' }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            Recientes
          </h2>
          <Link
            href={'/timeline' as Route}
            className="font-medium text-primary text-sm hover:underline"
          >
            Ver todo
          </Link>
        </div>
        <RecentEventsGrouped
          rows={recents}
          emptyState={
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="text-primary">
                <TimelineEmptyIllustration size={120} />
              </div>
              <p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
                Todavía no hay registros. Anotá la primera toma cuando ocurra — o decísela a
                SalustIA y ella la guarda por vos.
              </p>
            </Card>
          }
        />
        {/* Si hay sueño activo, lo dejamos visible aunque ya esté el hero arriba —
            permite cerrar la sesión desde acá sin scrollear. */}
        {activeSleep && (
          <Card className="flex items-center gap-3 border-primary/30 bg-primary/5 p-3.5">
            <Moon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="text-muted-foreground text-xs">
              Hay un sueño en curso. Cuando se despierte, cerralo desde el hero arriba o desde acá.
            </span>
            <CloseSleepSheet
              sessionId={activeSleep.id}
              startedAt={activeSleep.started_at}
              trigger={
                <Button type="button" size="xs" variant="outline" className="ml-auto">
                  Cerrar
                </Button>
              }
            />
          </Card>
        )}
      </section>

      {/* Compartir el día con la familia extendida — texto + foto del
          día. Usa Web Share API en mobile, fallback a copy en desktop.
          Se oculta:
            - En madrugada (compartir a las 3am es raro y rompe el
              "modo silencioso").
            - Si no hay eventos del día (no hay nada que compartir). */}
      {!lateNight && totalEventsToday > 0 && <ShareDayCard initial={shareSnapshot} />}
    </div>
  );
}
