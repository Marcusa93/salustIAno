'use client';

import { deleteEventAction, restoreEventAction } from '@/app/(app)/cuidar/eventos/actions';
import { groupEventsByTime } from '@/lib/event-grouping';
import { formatTimeAr } from '@/lib/format-ar';
import { haptic } from '@/lib/haptics';
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
import { AlertTriangle, Baby, Camera, Milk, Moon, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type PanInfo, motion, useAnimate } from 'motion/react';
import { useRouter } from 'next/navigation';
import { type ReactElement, type ReactNode, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EditDiaperSheet } from '../../cuidar/eventos/_components/edit-diaper-sheet';
import { EditFeedingSheet } from '../../cuidar/eventos/_components/edit-feeding-sheet';
import { EditSleepSheet } from '../../cuidar/eventos/_components/edit-sleep-sheet';

export interface RecentTimelineRow {
  event_type: 'feeding' | 'sleep' | 'diaper' | 'measurement' | 'note' | 'media';
  id: string;
  child_id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface Props {
  rows: ReadonlyArray<RecentTimelineRow>;
  emptyState: ReactNode;
}

type EventTable = 'feeding_events' | 'sleep_sessions' | 'diaper_events';

const TABLE_FOR: Partial<Record<RecentTimelineRow['event_type'], EventTable>> = {
  feeding: 'feeding_events',
  sleep: 'sleep_sessions',
  diaper: 'diaper_events',
};

const TONE: Record<RecentTimelineRow['event_type'], string> = {
  feeding: 'bg-feed-soft text-feed-foreground',
  sleep: 'bg-sleep-soft text-sleep-foreground',
  diaper: 'bg-diaper-soft text-diaper-foreground',
  measurement: 'bg-health-soft text-health-foreground',
  note: 'bg-muted text-muted-foreground',
  media: 'bg-muted text-muted-foreground',
};

const SWIPE_DELETE_PX = 96;

/**
 * Línea de tiempo compacta, agrupada por momento ("Hace un rato", "Hoy",
 * "Ayer"…). Cada fila: hora, color del tipo, qué fue y el detalle.
 * Tocar una fila la edita; deslizarla a la izquierda la borra (con
 * "Deshacer" en el aviso).
 */
export function RecentEventsGrouped({ rows, emptyState }: Props) {
  if (rows.length === 0) return <>{emptyState}</>;
  const groups = groupEventsByTime(rows);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-1">
          <h3 className="px-1 pb-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            {group.label}
          </h3>
          <ol className="flex flex-col">
            {group.items.map((row) => (
              <li key={`${row.event_type}-${row.id}`}>
                <SwipeableEventRow row={row} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function SwipeableEventRow({ row }: { row: RecentTimelineRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [removed, setRemoved] = useState(false);
  const dragged = useRef(false);
  const table = TABLE_FOR[row.event_type];

  const remove = () => {
    if (!table) return;
    startTransition(async () => {
      const result = await deleteEventAction(table, row.id);
      if (!result.ok) {
        toast.error(result.error);
        await animate(scope.current, { x: 0 });
        return;
      }
      haptic('warning');
      setRemoved(true);
      toast(`${describeEvent(row).title} borrado.`, {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            const restored = await restoreEventAction(table, row.id);
            if (!restored.ok) toast.error(restored.error);
            setRemoved(false);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  };

  const onDragEnd = async (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DELETE_PX) {
      await animate(scope.current, { x: '-100%', opacity: 0 }, { duration: 0.2 });
      remove();
      return;
    }
    await animate(scope.current, { x: 0 }, { type: 'spring', stiffness: 400, damping: 32 });
  };

  if (removed) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {table && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-end gap-2 bg-destructive/12 pr-5 font-medium text-destructive text-sm"
        >
          <Trash2 className="size-4" />
          Borrar
        </div>
      )}
      <motion.div
        ref={scope}
        className="relative bg-background"
        drag={table ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={onDragEnd}
        onClickCapture={(event) => {
          // Un deslizamiento no tiene que abrir la edición.
          if (dragged.current) {
            event.stopPropagation();
            event.preventDefault();
            dragged.current = false;
          }
        }}
      >
        <EditTrigger row={row} />
      </motion.div>
    </div>
  );
}

function RowBody({ row }: { row: RecentTimelineRow }) {
  const summary = describeEvent(row);
  const photoAnalysis =
    row.event_type === 'diaper' && row.payload.photo_analysis
      ? (row.payload.photo_analysis as { alarm?: boolean })
      : null;
  const Icon = summary.Icon;

  return (
    <>
      <span className="w-11 shrink-0 text-right font-medium text-muted-foreground text-sm tabular-nums">
        {formatTimeAr(row.occurred_at)}
      </span>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          photoAnalysis?.alarm ? 'bg-destructive/10 text-destructive' : TONE[row.event_type],
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 font-medium text-foreground text-sm">
          {summary.title}
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
        {summary.detail && (
          <span className="truncate text-muted-foreground text-xs">{summary.detail}</span>
        )}
      </span>
    </>
  );
}

const ROW_CLASS =
  'flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/70';

function EditTrigger({ row }: { row: RecentTimelineRow }) {
  const trigger: ReactElement = (
    <button
      type="button"
      className={ROW_CLASS}
      aria-label={`Editar ${describeEvent(row).title} de las ${formatTimeAr(row.occurred_at)}`}
    >
      <RowBody row={row} />
    </button>
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

  return (
    <div className={ROW_CLASS}>
      <RowBody row={row} />
    </div>
  );
}

// Un sueño abierto hace más de 18 h no está "en curso": se olvidó cerrarlo.
const STALE_OPEN_SLEEP_MS = 18 * 60 * 60 * 1000;

function sleepDurationLabel(startedAt: string, endedAt: string | null | undefined): string {
  if (!endedAt) {
    return Date.now() - Date.parse(startedAt) > STALE_OPEN_SLEEP_MS ? 'sin cerrar' : 'en curso';
  }
  const minutes = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}

function describeEvent(row: RecentTimelineRow): {
  Icon: LucideIcon;
  title: string;
  detail: string | null;
} {
  if (row.event_type === 'feeding') {
    const type = row.payload.type as FeedingType | undefined;
    const side = row.payload.side as keyof typeof BREAST_SIDE_LABELS | undefined;
    const duration = row.payload.duration_minutes as number | null | undefined;
    const amount = row.payload.amount_ml as number | null | undefined;
    const parts: string[] = [];
    if (type === 'breastfeeding' && side) parts.push(BREAST_SIDE_LABELS[side]);
    if (duration) parts.push(`${duration} min`);
    if (amount) parts.push(`${amount} ml`);
    return {
      Icon: Milk,
      title: type ? FEEDING_TYPE_LABELS[type] : 'Toma',
      detail: parts.length > 0 ? parts.join(' · ') : null,
    };
  }
  if (row.event_type === 'sleep') {
    const quality = row.payload.quality as SleepQuality | undefined;
    const isNap = row.payload.is_nap as boolean | undefined;
    const startedAt = (row.payload.started_at as string | undefined) ?? row.occurred_at;
    const parts = [sleepDurationLabel(startedAt, row.payload.ended_at as string | null)];
    if (quality && quality !== 'unknown') parts.push(SLEEP_QUALITY_LABELS[quality]);
    return { Icon: Moon, title: isNap ? 'Siesta' : 'Sueño', detail: parts.join(' · ') };
  }
  if (row.event_type === 'diaper') {
    const type = row.payload.type as DiaperType | undefined;
    return { Icon: Baby, title: 'Pañal', detail: type ? DIAPER_TYPE_LABELS[type] : null };
  }
  return { Icon: Baby, title: row.event_type, detail: null };
}
