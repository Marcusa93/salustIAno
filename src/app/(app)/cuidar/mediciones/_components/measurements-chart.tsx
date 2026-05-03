'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MeasurementPoint {
  measuredAt: string;
  weightGrams: number | null;
  heightCm: number | null;
  headCm: number | null;
}

type Metric = 'weight' | 'height' | 'head';

const METRIC_META: Record<
  Metric,
  { label: string; unit: string; key: keyof Omit<MeasurementPoint, 'measuredAt'>; color: string }
> = {
  weight: { label: 'Peso', unit: 'g', key: 'weightGrams', color: 'oklch(0.6 0.085 235)' },
  height: { label: 'Talla', unit: 'cm', key: 'heightCm', color: 'oklch(0.55 0.06 200)' },
  head: { label: 'Cabeza', unit: 'cm', key: 'headCm', color: 'oklch(0.7 0.055 60)' },
};

/**
 * Chart SVG simple — sin dependencias externas. Plotea la métrica
 * elegida vs tiempo en una línea con puntos. El user toggle entre
 * peso/talla/cabeza con chips.
 *
 * Optimizado para que se vea bien con 1-30 puntos.
 */
export function MeasurementsChart({ points }: { points: MeasurementPoint[] }) {
  const [metric, setMetric] = useState<Metric>('weight');

  // Sort por fecha asc para line drawing.
  const sorted = [...points].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  );

  const meta = METRIC_META[metric];
  const filtered = sorted.filter((p) => p[meta.key] !== null);

  if (filtered.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Cargá al menos una medición de {meta.label.toLowerCase()} para ver el gráfico.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          Evolución
        </span>
        <div className="flex gap-1.5">
          {(Object.keys(METRIC_META) as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                'rounded-full px-3 py-1 font-medium text-xs transition-colors',
                metric === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {METRIC_META[m].label}
            </button>
          ))}
        </div>
      </div>

      <SvgChart points={filtered} metric={metric} />
    </Card>
  );
}

function SvgChart({ points, metric }: { points: MeasurementPoint[]; metric: Metric }) {
  const meta = METRIC_META[metric];
  const values = points.map((p) => p[meta.key] as number);
  const dates = points.map((p) => new Date(p.measuredAt).getTime());

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const minD = Math.min(...dates);
  const maxD = Math.max(...dates);

  // Padding interno del SVG (en unidades del viewBox).
  const W = 600;
  const H = 200;
  const padL = 40;
  const padR = 16;
  const padT = 14;
  const padB = 28;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Si solo hay un punto, lo centramos.
  function xFor(d: number): number {
    if (maxD === minD) return padL + innerW / 2;
    return padL + ((d - minD) / (maxD - minD)) * innerW;
  }
  function yFor(v: number): number {
    if (maxV === minV) return padT + innerH / 2;
    // SVG y crece hacia abajo, invertimos.
    return padT + innerH - ((v - minV) / (maxV - minV)) * innerH;
  }

  // Path del line chart.
  const pathD = points
    .map((p, i) => {
      const x = xFor(dates[i] ?? 0);
      const y = yFor((p[meta.key] as number) ?? 0);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // 3 ticks horizontales (min, mid, max).
  const ticks = [minV, (minV + maxV) / 2, maxV];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Gráfico de ${meta.label}`}
    >
      <title>Gráfico de {meta.label}</title>
      {/* Ejes Y: ticks + labels */}
      {ticks.map((t) => {
        const y = yFor(t);
        return (
          <g key={`tick-${t}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth="0.5"
              opacity="0.15"
              className="text-foreground"
            />
            <text
              x={padL - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {formatTick(t, metric)}
            </text>
          </g>
        );
      })}

      {/* Eje X: primera y última fecha */}
      <text x={padL} y={H - 8} textAnchor="start" className="fill-muted-foreground text-[10px]">
        {formatDate(dates[0] ?? 0)}
      </text>
      <text x={W - padR} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {formatDate(dates[dates.length - 1] ?? 0)}
      </text>

      {/* Línea */}
      {points.length > 1 && (
        <path
          d={pathD}
          fill="none"
          stroke={meta.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Puntos */}
      {points.map((p, i) => {
        const v = p[meta.key] as number;
        const x = xFor(dates[i] ?? 0);
        const y = yFor(v);
        return (
          <g key={`p-${p.measuredAt}-${v}`}>
            <circle cx={x} cy={y} r="4" fill={meta.color} />
            <circle cx={x} cy={y} r="6" fill={meta.color} opacity="0.18" />
          </g>
        );
      })}
    </svg>
  );
}

function formatTick(v: number, m: Metric): string {
  if (m === 'weight') {
    if (v >= 1000) return `${(v / 1000).toFixed(1)} kg`;
    return `${Math.round(v)} g`;
  }
  return `${v.toFixed(1)} cm`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
