import { EmptyState } from '@/components/salu/empty-state';
import { CradleIllustration } from '@/components/salu/illustrations/cradle';
import { TimelineEmptyIllustration } from '@/components/salu/illustrations/timeline-empty';
import { PageHeader } from '@/components/salu/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { bucketByDayLast7, groupEventsByDay } from '@/lib/event-grouping';
import { formatTimeAr, startOfDayArDaysAgo } from '@/lib/format-ar';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import {
  BREAST_SIDE_LABELS,
  type BreastSide,
  DIAPER_TYPE_LABELS,
  type DiaperPhotoAnalysis,
  type DiaperType,
  FEEDING_TYPE_LABELS,
  type FeedingReaction,
  type FeedingType,
  SLEEP_QUALITY_LABELS,
  type SleepQuality,
} from '@/lib/validators/events';
import {
  AlertTriangle,
  Baby,
  BookHeart,
  CalendarDays,
  Camera,
  Milk,
  Moon,
  Pencil,
  Printer,
  Sun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { DiaperPhotoLink } from '../cuidar/eventos/_components/diaper-photo-link';
import { EditDiaperSheet } from '../cuidar/eventos/_components/edit-diaper-sheet';
import { EditFeedingSheet } from '../cuidar/eventos/_components/edit-feeding-sheet';
import { EditSleepSheet } from '../cuidar/eventos/_components/edit-sleep-sheet';
import { CloseSleepSheet } from '../home/_components/close-sleep-sheet';
import { DiaperQuickAdd } from '../home/_components/diaper-quick-add';
import { FeedingQuickAdd } from '../home/_components/feeding-quick-add';
import { SleepQuickAdd } from '../home/_components/sleep-quick-add';
import { WeeklyStatsCard } from './_components/weekly-stats-card';

export const metadata: Metadata = {
  title: 'Registro',
};

const FILTER_OPTIONS = [
  { value: '', label: 'Todo' },
  { value: 'feeding', label: 'Tomas' },
  { value: 'sleep', label: 'Sueño' },
  { value: 'diaper', label: 'Pañales' },
] as const;

interface TimelineRow {
  event_type: 'feeding' | 'sleep' | 'diaper' | 'measurement' | 'note' | 'media';
  id: string;
  child_id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface PageProps {
  searchParams: Promise<{ tipo?: string }>;
}

function formatTimeOnly(iso: string): string {
  return formatTimeAr(iso);
}

function dayCounts(items: ReadonlyArray<TimelineRow>): Array<{ Icon: LucideIcon; n: number }> {
  const feeding = items.filter((e) => e.event_type === 'feeding').length;
  const sleep = items.filter((e) => e.event_type === 'sleep').length;
  const diaper = items.filter((e) => e.event_type === 'diaper').length;
  const out: Array<{ Icon: LucideIcon; n: number }> = [];
  if (feeding > 0) out.push({ Icon: Milk, n: feeding });
  if (sleep > 0) out.push({ Icon: Moon, n: sleep });
  if (diaper > 0) out.push({ Icon: Baby, n: diaper });
  return out;
}

const QUICK_TILE_CLS =
  'group/qa relative flex h-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/40 p-3 text-foreground shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:translate-y-0 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function quickTile(Icon: LucideIcon, label: string) {
  return (
    <span className={QUICK_TILE_CLS}>
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-transform duration-200 group-hover/qa:scale-110 group-hover/qa:bg-primary/15 group-active/qa:scale-95">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="font-medium text-foreground text-xs leading-tight">{label}</span>
    </span>
  );
}

export default async function TimelinePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filter =
    params.tipo && ['feeding', 'sleep', 'diaper'].includes(params.tipo) ? params.tipo : null;

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
            Registro
          </h1>
          <p className="text-muted-foreground">Cuando registres eventos, van a aparecer acá.</p>
        </header>
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="text-primary">
            <CradleIllustration size={120} />
          </div>
          <p className="text-muted-foreground text-sm">
            Creá el perfil del bebé para empezar a registrar.
          </p>
        </Card>
      </div>
    );
  }

  // Ventana de 7 días terminando hoy — usada por el WeeklyStatsCard.
  // Medianoche AR de hace 6 días (≈ 7 días incluido hoy) para que
  // `bucketByDayLast7` ubique cada evento en su día AR.
  const since7d = startOfDayArDaysAgo(6);

  const [{ data, error }, feedings7, diapers7, sleeps7] = await Promise.all([
    supabase.rpc('get_timeline', {
      p_child_id: child.id,
      p_event_types: filter ? [filter] : ['feeding', 'sleep', 'diaper', 'measurement', 'note'],
      p_limit: 200,
      p_offset: 0,
    }),
    supabase
      .from('feeding_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', since7d.toISOString()),
    supabase
      .from('diaper_events')
      .select('occurred_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('occurred_at', since7d.toISOString()),
    supabase
      .from('sleep_sessions')
      .select('started_at')
      .eq('child_id', child.id)
      .is('deleted_at', null)
      .gte('started_at', since7d.toISOString()),
  ]);

  const rows = (data ?? []) as TimelineRow[];
  const dayGroups = groupEventsByDay(rows);

  // Series para el sparkline. Mapeamos las filas a sus timestamps y
  // bucketizamos en hora AR.
  const feedings7Iso = (feedings7.data ?? []).map(
    (e) => (e as { occurred_at: string }).occurred_at,
  );
  const diapers7Iso = (diapers7.data ?? []).map((e) => (e as { occurred_at: string }).occurred_at);
  const sleeps7Iso = (sleeps7.data ?? []).map((e) => (e as { started_at: string }).started_at);

  const weeklyStats = [
    {
      label: 'Tomas',
      Icon: Milk,
      daily: bucketByDayLast7(feedings7Iso),
      unit: 'tomas',
    },
    {
      label: 'Pañales',
      Icon: Baby,
      daily: bucketByDayLast7(diapers7Iso),
      unit: 'pañales',
    },
    {
      label: 'Sueño',
      Icon: Moon,
      daily: bucketByDayLast7(sleeps7Iso),
      unit: 'sesiones',
    },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Registro"
        title={`El día a día de ${child.name}.`}
        action={
          <>
            <Button
              render={<Link href={'/timeline/imprimir' as Route} />}
              size="icon-sm"
              variant="outline"
              aria-label="Imprimir o exportar a PDF"
              className="sm:hidden"
            >
              <Printer className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href={'/timeline/imprimir' as Route} />}
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
            >
              <Printer className="size-4" aria-hidden />
              Imprimir / PDF
            </Button>
            <Button
              render={<Link href={'/timeline/mes' as Route} />}
              size="icon-sm"
              variant="outline"
              aria-label="Vista mensual"
              className="sm:hidden"
            >
              <CalendarDays className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href={'/timeline/mes' as Route} />}
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
            >
              <CalendarDays className="size-4" aria-hidden />
              Vista mensual
            </Button>
          </>
        }
      />

      {/* Quick-add row — la acción primaria del registro vive acá, no en el
          header. Reusa los mismos Sheets que /home para que se sienta una
          sola app. */}
      <section
        className="animate-stagger-up flex flex-col gap-3"
        style={{ animationDelay: '60ms' }}
      >
        <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Anotar en dos toques
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FeedingQuickAdd
            trigger={
              <button type="button" className="contents">
                {quickTile(Milk, 'Tomó')}
              </button>
            }
          />
          <SleepQuickAdd
            trigger={
              <button type="button" className="contents">
                {quickTile(Moon, 'Durmió')}
              </button>
            }
          />
          <DiaperQuickAdd
            trigger={
              <button type="button" className="contents">
                {quickTile(Baby, 'Pañal')}
              </button>
            }
          />
          <Link href="/notas/nuevo" className="contents">
            {quickTile(BookHeart, 'Momento')}
          </Link>
        </div>
      </section>

      <div className="animate-stagger-up" style={{ animationDelay: '90ms' }}>
        <WeeklyStatsCard series={weeklyStats} />
      </div>

      <nav aria-label="Filtrar registro" className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const href = opt.value
            ? (`/timeline?tipo=${opt.value}` as Route)
            : ('/timeline' as Route);
          const active = (filter ?? '') === opt.value;
          return (
            <Link
              key={opt.value || 'all'}
              href={href}
              className={cn(
                'inline-flex items-center rounded-full border px-3.5 py-1.5 font-medium text-xs transition-all duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                active
                  ? 'border-primary/30 bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/60 bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:text-foreground',
              )}
            >
              {opt.label}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          No pudimos cargar el timeline.
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          illustration={
            <div className="text-primary">
              <TimelineEmptyIllustration size={140} />
            </div>
          }
          title="Acá va a vivir el día a día."
          description="Cada toma, sueño, pañal y momento que registres aparece en este timeline ordenado por día. Empezá anotando algo desde Casa o decíselo a SaluIA — ella lo agrega por vos."
          action={{ label: 'Ir a Casa', href: '/home' as Route }}
        />
      ) : (
        <div className="flex flex-col gap-7">
          {dayGroups.map((group) => {
            const counts = dayCounts(group.items);
            return (
              <section key={group.key} className="flex flex-col gap-2.5">
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
                    {group.label}
                  </h2>
                  {counts.length > 0 && (
                    <div className="flex items-center gap-2">
                      {counts.map(({ Icon, n }, idx) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: índice estable, no hay reorder.
                          key={idx}
                          className="inline-flex items-center gap-1 text-muted-foreground/80 text-xs"
                        >
                          <Icon className="size-3.5" aria-hidden />
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </header>
                <ul className="flex flex-col gap-2">
                  {group.items.map((row) => (
                    <li key={`${row.event_type}-${row.id}`}>
                      <TimelineEntry row={row} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimelineEntry({ row }: { row: TimelineRow }) {
  const { Icon, title, detail } = describeEvent(row);
  const isOpenSleep =
    row.event_type === 'sleep' &&
    typeof row.payload.started_at === 'string' &&
    !row.payload.ended_at;
  const photoAnalysis =
    row.event_type === 'diaper' && row.payload.photo_analysis
      ? (row.payload.photo_analysis as { alarm?: boolean; alarm_reason?: string })
      : null;
  const photoPath =
    row.event_type === 'diaper' && typeof row.payload.photo_path === 'string'
      ? (row.payload.photo_path as string)
      : null;
  return (
    <Card
      className={cn(
        'flex items-start gap-3 border-border/60 p-3 transition-colors hover:bg-muted/30',
        photoAnalysis?.alarm && 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10',
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium text-foreground text-sm">
          {title}
          {photoAnalysis?.alarm ? (
            <AlertTriangle
              className="size-3.5 text-destructive"
              aria-label="Conviene mostrar al pediatra"
            />
          ) : photoAnalysis ? (
            <Camera
              className="size-3.5 text-muted-foreground"
              aria-label="Tiene análisis de foto"
            />
          ) : null}
        </span>
        {detail && <span className="text-muted-foreground text-xs">{detail}</span>}
        {photoAnalysis?.alarm && photoAnalysis.alarm_reason && (
          <span className="font-medium text-destructive text-xs">{photoAnalysis.alarm_reason}</span>
        )}
        {isOpenSleep && (
          <span className="font-medium text-primary text-xs">Sin cerrar — sigue durmiendo.</span>
        )}
      </div>
      <div className="ml-auto flex flex-col items-end gap-1.5">
        <span className="whitespace-nowrap font-medium text-muted-foreground text-xs tabular-nums">
          {formatTimeOnly(row.occurred_at)}
        </span>
        {isOpenSleep && (
          <CloseSleepSheet
            sessionId={row.id}
            startedAt={row.payload.started_at as string}
            trigger={
              <Button type="button" size="xs" variant="outline">
                <Sun className="size-3" aria-hidden />
                Se despertó
              </Button>
            }
          />
        )}
        {photoPath && <DiaperPhotoLink path={photoPath} />}
        <EditButton row={row} />
      </div>
    </Card>
  );
}

/**
 * Renderiza el botón "editar" más el Sheet correspondiente, según el
 * tipo de evento. Para measurements/notes/media no hay edición desde
 * acá (esos viven en sus propias páginas con detalle).
 */
function EditButton({ row }: { row: TimelineRow }) {
  const trigger = (
    <Button type="button" size="icon-xs" variant="ghost" aria-label="Editar">
      <Pencil className="size-3" aria-hidden />
    </Button>
  );

  if (row.event_type === 'diaper') {
    return (
      <EditDiaperSheet
        eventId={row.id}
        initial={{
          occurred_at: row.occurred_at,
          type: (row.payload.type as DiaperType) ?? 'wet',
          notes: (row.payload.notes as string | null | undefined) ?? null,
          photo_analysis:
            (row.payload.photo_analysis as DiaperPhotoAnalysis | null | undefined) ?? null,
        }}
        trigger={trigger}
      />
    );
  }

  if (row.event_type === 'feeding') {
    return (
      <EditFeedingSheet
        eventId={row.id}
        initial={{
          occurred_at: row.occurred_at,
          type: (row.payload.type as FeedingType) ?? 'breastfeeding',
          side: (row.payload.side as BreastSide | null | undefined) ?? null,
          duration_minutes: (row.payload.duration_minutes as number | null | undefined) ?? null,
          amount_ml: (row.payload.amount_ml as number | null | undefined) ?? null,
          foods: (row.payload.foods as string[] | null | undefined) ?? null,
          reaction: (row.payload.reaction as FeedingReaction | undefined) ?? 'none',
          notes: (row.payload.notes as string | null | undefined) ?? null,
        }}
        trigger={trigger}
      />
    );
  }

  if (row.event_type === 'sleep') {
    return (
      <EditSleepSheet
        eventId={row.id}
        initial={{
          started_at: (row.payload.started_at as string) ?? row.occurred_at,
          ended_at: (row.payload.ended_at as string | null | undefined) ?? null,
          quality: (row.payload.quality as SleepQuality | undefined) ?? 'unknown',
          is_nap: (row.payload.is_nap as boolean | undefined) ?? false,
          notes: (row.payload.notes as string | null | undefined) ?? null,
        }}
        trigger={trigger}
      />
    );
  }

  return null;
}

function describeEvent(row: TimelineRow): {
  Icon: LucideIcon;
  title: string;
  detail: string | null;
} {
  if (row.event_type === 'feeding') {
    const type = row.payload.type as FeedingType | undefined;
    const side = row.payload.side as keyof typeof BREAST_SIDE_LABELS | undefined;
    const duration = row.payload.duration_minutes as number | null | undefined;
    const amount = row.payload.amount_ml as number | null | undefined;
    const notes = row.payload.notes as string | null | undefined;
    const parts: string[] = [];
    if (type === 'breastfeeding' && side) parts.push(BREAST_SIDE_LABELS[side]);
    if (duration) parts.push(`${duration} min`);
    if (amount) parts.push(`${amount} ml`);
    if (notes) parts.push(notes);
    return {
      Icon: Milk,
      title: type ? FEEDING_TYPE_LABELS[type] : 'Toma',
      detail: parts.length > 0 ? parts.join(' · ') : null,
    };
  }
  if (row.event_type === 'sleep') {
    const quality = row.payload.quality as keyof typeof SLEEP_QUALITY_LABELS | undefined;
    const startedAt = row.payload.started_at as string | undefined;
    const endedAt = row.payload.ended_at as string | undefined;
    const isNap = row.payload.is_nap as boolean | undefined;
    let detail: string | null = null;
    if (startedAt && endedAt) {
      const minutes = Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
      );
      const hours = Math.floor(minutes / 60);
      const remaining = minutes % 60;
      detail = hours > 0 ? `${hours}h ${remaining}min` : `${minutes} min`;
    }
    if (quality && SLEEP_QUALITY_LABELS[quality]) {
      detail = detail
        ? `${detail} · ${SLEEP_QUALITY_LABELS[quality]}`
        : SLEEP_QUALITY_LABELS[quality];
    }
    return {
      Icon: Moon,
      title: isNap ? 'Siesta' : 'Sueño',
      detail,
    };
  }
  if (row.event_type === 'diaper') {
    const type = row.payload.type as DiaperType | undefined;
    const notes = row.payload.notes as string | null | undefined;
    return {
      Icon: Baby,
      title: 'Pañal',
      detail: [type ? DIAPER_TYPE_LABELS[type] : null, notes].filter(Boolean).join(' · ') || null,
    };
  }
  if (row.event_type === 'measurement') {
    const weight = row.payload.weight_grams as number | null | undefined;
    const height = row.payload.height_cm as number | null | undefined;
    const head = row.payload.head_circumference_cm as number | null | undefined;
    const parts: string[] = [];
    if (weight) parts.push(`${weight} g`);
    if (height) parts.push(`${height} cm`);
    if (head) parts.push(`${head} cm cabeza`);
    return { Icon: Milk, title: 'Medición', detail: parts.join(' · ') || null };
  }
  if (row.event_type === 'note') {
    const content = row.payload.content as string | undefined;
    return { Icon: BookHeart, title: 'Nota', detail: content?.slice(0, 100) ?? null };
  }
  return { Icon: BookHeart, title: row.event_type, detail: null };
}
