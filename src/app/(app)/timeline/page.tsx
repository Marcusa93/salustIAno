import { CradleIllustration } from '@/components/salu/illustrations/cradle';
import { TimelineEmptyIllustration } from '@/components/salu/illustrations/timeline-empty';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { AlertTriangle, Baby, BookHeart, Camera, Milk, Moon, Pencil, Sun } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { DiaperPhotoLink } from '../cuidar/eventos/_components/diaper-photo-link';
import { EditDiaperSheet } from '../cuidar/eventos/_components/edit-diaper-sheet';
import { EditFeedingSheet } from '../cuidar/eventos/_components/edit-feeding-sheet';
import { EditSleepSheet } from '../cuidar/eventos/_components/edit-sleep-sheet';
import { CloseSleepSheet } from '../home/_components/close-sleep-sheet';

export const metadata: Metadata = {
  title: 'Timeline',
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const today = new Date();
  const that = new Date(iso);
  const sameDay = today.toISOString().slice(0, 10) === that.toISOString().slice(0, 10);
  if (sameDay) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (yesterday.toISOString().slice(0, 10) === that.toISOString().slice(0, 10)) return 'Ayer';
  return that.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
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
            Timeline
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

  const { data, error } = await supabase.rpc('get_timeline', {
    p_child_id: child.id,
    p_event_types: filter ? [filter] : ['feeding', 'sleep', 'diaper', 'measurement', 'note'],
    p_limit: 200,
    p_offset: 0,
  });

  const rows = (data ?? []) as TimelineRow[];

  // Agrupamos por día para el rendering.
  const byDay = new Map<string, TimelineRow[]>();
  for (const row of rows) {
    const k = dayKey(row.occurred_at);
    const arr = byDay.get(k);
    if (arr) arr.push(row);
    else byDay.set(k, [row]);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="animate-stagger-up flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
              Timeline
            </span>
            <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] text-foreground leading-[1.05] tracking-tight">
              El día a día de {child.name}.
            </h1>
          </div>
          <Button render={<Link href="/notas/nuevo" />} size="sm">
            <BookHeart className="size-4" aria-hidden />
            Anotar momento
          </Button>
        </div>
      </header>

      <nav aria-label="Filtrar timeline" className="flex flex-wrap gap-2">
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
                'inline-flex items-center rounded-full px-3 py-1.5 font-medium text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
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
        <Card className="flex flex-col items-center gap-4 p-10 text-center sm:p-12">
          <div className="text-primary">
            <TimelineEmptyIllustration size={140} />
          </div>
          <p className="max-w-sm text-muted-foreground leading-relaxed">
            Todavía no hay registros. Anotá algo desde Casa.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from(byDay.entries()).map(([day, items]) => (
            <section key={day} className="flex flex-col gap-3">
              <h2 className="font-medium text-foreground text-sm uppercase tracking-wider text-muted-foreground">
                {dayLabel(day)}
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((row) => (
                  <li key={`${row.event_type}-${row.id}`}>
                    <TimelineEntry row={row} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
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
        'flex items-start gap-3 p-3',
        photoAnalysis?.alarm && 'border-destructive/40 bg-destructive/5',
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
        <span className="whitespace-nowrap text-muted-foreground text-xs">
          {formatDateTime(row.occurred_at)}
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
  Icon: typeof Milk;
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
