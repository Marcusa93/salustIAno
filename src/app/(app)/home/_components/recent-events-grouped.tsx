import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { groupEventsByTime } from '@/lib/event-grouping';
import { formatTimeAr } from '@/lib/format-ar';
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
import { AlertTriangle, Baby, Camera, Milk, Moon, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
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

/**
 * Lista de eventos recientes agrupada por bloques temporales:
 * "Hace un rato" / "Hoy" / "Ayer" / "Días anteriores". Cada bloque tiene
 * su propio header pequeño en mayúsculas con tracking espaciado, en sintonía
 * con el patrón de eyebrow del resto de la app.
 */
export function RecentEventsGrouped({ rows, emptyState }: Props) {
  if (rows.length === 0) return <>{emptyState}</>;
  const groups = groupEventsByTime(rows);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2.5">
          <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            {group.label}
          </span>
          <ul className="flex flex-col gap-2">
            {group.items.map((row) => (
              <li key={`${row.event_type}-${row.id}`}>
                <EventRow row={row} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  return formatTimeAr(iso);
}

function EventRow({ row }: { row: RecentTimelineRow }) {
  const summary = describeEvent(row);
  const photoAnalysis =
    row.event_type === 'diaper' && row.payload.photo_analysis
      ? (row.payload.photo_analysis as { alarm?: boolean })
      : null;
  const Icon = summary.Icon;

  return (
    <Card
      className={cn(
        'flex items-center gap-3 border-border/60 p-3.5 transition-colors hover:bg-muted/30',
        photoAnalysis?.alarm && 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10',
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
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
        {summary.detail && <span className="text-muted-foreground text-xs">{summary.detail}</span>}
      </div>
      <div className="ml-auto flex flex-col items-end gap-1">
        <span className="text-muted-foreground text-xs">{formatTime(row.occurred_at)}</span>
        <EditButton row={row} />
      </div>
    </Card>
  );
}

function EditButton({ row }: { row: RecentTimelineRow }) {
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
    const quality = row.payload.quality as keyof typeof SLEEP_QUALITY_LABELS | undefined;
    const isNap = row.payload.is_nap as boolean | undefined;
    return {
      Icon: Moon,
      title: isNap ? 'Siesta' : 'Sueño',
      detail: quality ? SLEEP_QUALITY_LABELS[quality] : null,
    };
  }
  if (row.event_type === 'diaper') {
    const type = row.payload.type as DiaperType | undefined;
    return {
      Icon: Baby,
      title: 'Pañal',
      detail: type ? DIAPER_TYPE_LABELS[type] : null,
    };
  }
  return { Icon: Baby, title: row.event_type, detail: null };
}
