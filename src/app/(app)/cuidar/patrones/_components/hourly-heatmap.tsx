import { cn } from '@/lib/utils';
import type { HeatmapKind, HourlyHeatmapResult } from '../heatmap-actions';

const KIND_META: Record<HeatmapKind, { label: string; tone: string; ring: string }> = {
  feeding: {
    label: 'Tomas',
    // Cada cell es un span con bg-current y opacity dinámica → el color
    // viene del color del texto del contenedor.
    tone: 'text-[var(--chart-1)]',
    ring: 'ring-[var(--chart-1)]/30',
  },
  sleep: {
    label: 'Sueños',
    tone: 'text-[var(--chart-2)]',
    ring: 'ring-[var(--chart-2)]/30',
  },
  diaper: {
    label: 'Pañales',
    tone: 'text-[var(--chart-3)]',
    ring: 'ring-[var(--chart-3)]/30',
  },
};

const HOUR_TICKS = [0, 6, 12, 18];

interface Props {
  data: HourlyHeatmapResult | null;
}

/**
 * Heatmap 7d × 24h con la cantidad de eventos a cada hora local AR.
 * Tres grids stackeados (tomas / sueños / pañales) — cada uno con su
 * hue del theme. Sirve para identificar a ojo "siempre come a las
 * 11", "duerme largo entre 22 y 6" o "pañales concentrados al final
 * del día".
 *
 * Render 100% server — no necesita interactividad: todo el insight
 * viene de leer la grilla.
 */
export function HourlyHeatmap({ data }: Props) {
  if (!data) {
    return (
      <p className="text-muted-foreground text-sm">
        Necesitamos un perfil del bebé para armar el mapa de horas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
          Mapa de horas — últimos 7 días
        </span>
        <p className="text-muted-foreground text-xs leading-relaxed">
          A qué hora pasa cada cosa. Más oscuro = más eventos a esa hora ese día.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {(Object.keys(KIND_META) as HeatmapKind[]).map((kind) => (
          <KindRow key={kind} kind={kind} matrix={data.matrices[kind]} dayLabels={data.dayLabels} />
        ))}
      </div>

      <HourAxis />
    </div>
  );
}

function KindRow({
  kind,
  matrix,
  dayLabels,
}: {
  kind: HeatmapKind;
  matrix: number[][];
  dayLabels: string[];
}) {
  const meta = KIND_META[kind];
  const max = matrix.reduce((acc, row) => Math.max(acc, ...row), 0);
  const total = matrix.reduce((acc, row) => acc + row.reduce((s, n) => s + n, 0), 0);

  return (
    <div className={cn('flex flex-col gap-1.5', meta.tone)}>
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-[11px] text-foreground tracking-wide">{meta.label}</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {total} {total === 1 ? 'evento' : 'eventos'}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {matrix.map((row, dayIdx) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 7 filas fijas, orden estable
            key={dayIdx}
            className="flex items-center gap-1.5"
          >
            <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
              {compactDayLabel(dayLabels[dayIdx]!)}
            </span>
            <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
              {row.map((count, hour) => (
                <Cell
                  // biome-ignore lint/suspicious/noArrayIndexKey: 24 horas fijas, orden estable
                  key={hour}
                  count={count}
                  max={max}
                  hour={hour}
                  kindLabel={meta.label}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({
  count,
  max,
  hour,
  kindLabel,
}: {
  count: number;
  max: number;
  hour: number;
  kindLabel: string;
}) {
  // Escalamos opacidad de 0.08 (mínimo perceptible cuando hay 1 evento) a 1.
  // Si max es 0, todas quedan en su base muteada.
  const opacity = max === 0 ? 0 : count === 0 ? 0 : 0.18 + 0.82 * (count / max);
  const title =
    count === 0
      ? `${String(hour).padStart(2, '0')}h — sin ${kindLabel.toLowerCase()}`
      : `${String(hour).padStart(2, '0')}h — ${count} ${kindLabel.toLowerCase()}`;
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        'aspect-square rounded-[3px] bg-current transition-opacity',
        count === 0 && 'bg-muted',
      )}
      style={count === 0 ? undefined : { opacity }}
    />
  );
}

function HourAxis() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0" aria-hidden />
      <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
        {Array.from({ length: 24 }, (_, h) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 24 horas fijas
            key={h}
            className={cn(
              'text-center font-mono text-[9px] text-muted-foreground tabular-nums',
              !HOUR_TICKS.includes(h) && 'opacity-0',
            )}
            aria-hidden={!HOUR_TICKS.includes(h)}
          >
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * "2026-05-09" → "Sá 9". Más fácil de leer en una columnita angosta
 * que la fecha completa.
 */
function compactDayLabel(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) return yyyymmdd;
  const date = new Date(`${yyyymmdd}T12:00:00-03:00`);
  const dow = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
  // "lun." → "Lu", "mar." → "Ma" ...
  const short = dow.replace('.', '').slice(0, 2);
  return `${short[0]?.toUpperCase()}${short.slice(1)} ${d}`;
}
