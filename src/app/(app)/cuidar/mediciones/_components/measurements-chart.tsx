'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type Sex, valueAtPercentile } from '@/lib/who-growth';
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
  {
    label: string;
    unit: string;
    key: keyof Omit<MeasurementPoint, 'measuredAt'>;
    color: string;
    /** Tipo equivalente en el módulo who-growth (para buscar la curva). */
    whoKind: 'weight' | 'length' | 'head_circumference';
    /**
     * Función para convertir el valor crudo del bebé al valor que las
     * tablas OMS esperan (kg para weight, cm para length/head).
     */
    toWhoUnit: (raw: number) => number;
  }
> = {
  weight: {
    label: 'Peso',
    unit: 'g',
    key: 'weightGrams',
    color: 'oklch(0.6 0.085 235)',
    whoKind: 'weight',
    toWhoUnit: (g) => g / 1000,
  },
  height: {
    label: 'Talla',
    unit: 'cm',
    key: 'heightCm',
    color: 'oklch(0.55 0.06 200)',
    whoKind: 'length',
    toWhoUnit: (cm) => cm,
  },
  head: {
    label: 'Cabeza',
    unit: 'cm',
    key: 'headCm',
    color: 'oklch(0.7 0.055 60)',
    whoKind: 'head_circumference',
    toWhoUnit: (cm) => cm,
  },
};

/** Percentiles de las bandas OMS que dibujamos como contexto. */
const BANDS: ReadonlyArray<number> = [3, 15, 50, 85, 97];

interface MeasurementsChartProps {
  points: MeasurementPoint[];
  /**
   * Fecha de nacimiento del bebé. Si está, calculamos edad en días
   * para cada medición y podemos dibujar las curvas OMS de fondo.
   */
  birthDate?: string | null;
  /**
   * Sexo del bebé. Si está + birthDate, dibujamos las bandas OMS
   * (varones y mujeres tienen curvas distintas).
   */
  sex?: Sex | null;
}

/**
 * Chart SVG con bandas OMS de fondo cuando tenemos birthDate + sex.
 *
 * Bandas: p3 (más fina, ámbar), p15-p85 (verde-azul muy translúcido,
 * "rango sano del medio"), p97 (más fina, ámbar). Línea p50 punteada
 * gris como mediana de referencia. La curva del bebé se plotea encima.
 *
 * Sin sex/birthDate, cae al chart simple de antes (línea + puntos
 * sin contexto).
 */
export function MeasurementsChart({ points, birthDate, sex }: MeasurementsChartProps) {
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

  const showWhoBands = !!birthDate && !!sex;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
            Evolución
          </span>
          {showWhoBands && (
            <span className="font-mono text-[10px] text-muted-foreground/70 tracking-wider">
              p3 · p15 · p50 · p85 · p97 — OMS
            </span>
          )}
        </div>
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

      <SvgChart points={filtered} metric={metric} birthDate={birthDate ?? null} sex={sex ?? null} />
    </Card>
  );
}

interface SvgChartProps {
  points: MeasurementPoint[];
  metric: Metric;
  birthDate: string | null;
  sex: Sex | null;
}

function SvgChart({ points, metric, birthDate, sex }: SvgChartProps) {
  const meta = METRIC_META[metric];
  const values = points.map((p) => p[meta.key] as number);
  const dates = points.map((p) => new Date(p.measuredAt).getTime());

  const showWhoBands = !!birthDate && !!sex;
  const birthMs = birthDate ? new Date(birthDate).getTime() : null;

  // Computamos el rango temporal del chart. Si tenemos birthDate +
  // bandas OMS, lo extendemos un poco (un mes antes y un mes después)
  // para que las bandas cubran el viewport y la curva del bebé tenga
  // contexto a izquierda y derecha.
  let minD = Math.min(...dates);
  let maxD = Math.max(...dates);
  if (showWhoBands && birthMs !== null) {
    // Si solo hay un punto, ampliamos para mostrar al menos 90 días
    // alrededor del nacimiento — más útil que un eje colapsado.
    if (minD === maxD) {
      maxD = minD + 90 * 24 * 60 * 60 * 1000;
      minD = Math.max(birthMs, minD - 30 * 24 * 60 * 60 * 1000);
    }
    // Acotamos a 0-730 días desde el nacimiento (rango OMS 0-2 años).
    const minAgeDays = Math.max(0, (minD - birthMs) / 86_400_000);
    const maxAgeDays = Math.min(730, (maxD - birthMs) / 86_400_000);
    minD = birthMs + minAgeDays * 86_400_000;
    maxD = birthMs + maxAgeDays * 86_400_000;
  }

  // Generamos las 5 curvas OMS antes de calcular el rango Y, así el
  // chart escala para incluirlas.
  const N_SAMPLES = 40;
  const whoBands: Array<{ percentile: number; values: Array<{ d: number; v: number | null }> }> =
    [];
  if (showWhoBands && birthMs !== null && sex) {
    for (const p of BANDS) {
      const samples: Array<{ d: number; v: number | null }> = [];
      for (let i = 0; i < N_SAMPLES; i++) {
        const d = minD + ((maxD - minD) * i) / (N_SAMPLES - 1);
        const ageDays = Math.floor((d - birthMs) / 86_400_000);
        if (ageDays < 0 || ageDays > 730) {
          samples.push({ d, v: null });
          continue;
        }
        const whoValue = valueAtPercentile({
          sex,
          kind: meta.whoKind,
          ageDays,
          percentile: p,
        });
        if (whoValue === null) {
          samples.push({ d, v: null });
          continue;
        }
        // Convertimos al unit del bebé (g si weight, cm si height/head).
        const inBabyUnit = meta.whoKind === 'weight' ? whoValue * 1000 : whoValue;
        samples.push({ d, v: inBabyUnit });
      }
      whoBands.push({ percentile: p, values: samples });
    }
  }

  // Y range — incluye las bandas OMS si están + las mediciones del bebé.
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (showWhoBands) {
    for (const band of whoBands) {
      for (const s of band.values) {
        if (s.v === null) continue;
        if (s.v < minV) minV = s.v;
        if (s.v > maxV) maxV = s.v;
      }
    }
  }
  // Padding del Y para que los puntos no toquen el borde superior/inferior.
  const yPad = (maxV - minV) * 0.05 || 1;
  minV -= yPad;
  maxV += yPad;

  // Padding interno del SVG (en unidades del viewBox).
  const W = 600;
  const H = 220;
  const padL = 40;
  const padR = 16;
  const padT = 14;
  const padB = 28;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  function xFor(d: number): number {
    if (maxD === minD) return padL + innerW / 2;
    return padL + ((d - minD) / (maxD - minD)) * innerW;
  }
  function yFor(v: number): number {
    if (maxV === minV) return padT + innerH / 2;
    // SVG y crece hacia abajo, invertimos.
    return padT + innerH - ((v - minV) / (maxV - minV)) * innerH;
  }

  // Path del line chart del bebé.
  const pathD = points
    .map((p, i) => {
      const x = xFor(dates[i] ?? 0);
      const y = yFor((p[meta.key] as number) ?? 0);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Para cada banda OMS, generamos su path.
  function pathForBand(samples: Array<{ d: number; v: number | null }>): string {
    return samples
      .filter((s) => s.v !== null)
      .map(
        (s, i) => `${i === 0 ? 'M' : 'L'}${xFor(s.d).toFixed(1)},${yFor(s.v as number).toFixed(1)}`,
      )
      .join(' ');
  }

  // Path del área entre p15 y p85 — la "zona del medio sano".
  function pathForBandArea(low: number, high: number): string {
    const lowBand = whoBands.find((b) => b.percentile === low);
    const highBand = whoBands.find((b) => b.percentile === high);
    if (!lowBand || !highBand) return '';
    const lowSamples = lowBand.values.filter((s) => s.v !== null);
    const highSamples = highBand.values.filter((s) => s.v !== null);
    if (lowSamples.length === 0 || highSamples.length === 0) return '';
    const upPath = highSamples
      .map(
        (s, i) => `${i === 0 ? 'M' : 'L'}${xFor(s.d).toFixed(1)},${yFor(s.v as number).toFixed(1)}`,
      )
      .join(' ');
    const downPath = [...lowSamples]
      .reverse()
      .map((s) => `L${xFor(s.d).toFixed(1)},${yFor(s.v as number).toFixed(1)}`)
      .join(' ');
    return `${upPath} ${downPath} Z`;
  }

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

      {/* Bandas OMS — área translúcida + líneas finas */}
      {showWhoBands && (
        <g aria-hidden>
          {/* Área p15-p85 (mediana ± 1 SD aprox) — el "medio sano". */}
          <path d={pathForBandArea(15, 85)} fill="oklch(0.6 0.085 235)" opacity="0.08" />
          {/* Bandas p3 y p97 como líneas — los extremos. */}
          {whoBands
            .filter((b) => b.percentile === 3 || b.percentile === 97)
            .map((b) => (
              <path
                key={`band-${b.percentile}`}
                d={pathForBand(b.values)}
                fill="none"
                stroke="oklch(0.55 0.13 60)"
                strokeWidth="0.7"
                strokeDasharray="2 3"
                opacity="0.5"
              />
            ))}
          {/* Mediana p50 — línea punteada gris. */}
          {whoBands
            .filter((b) => b.percentile === 50)
            .map((b) => (
              <path
                key="band-50"
                d={pathForBand(b.values)}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                strokeDasharray="3 2"
                className="text-muted-foreground/60"
              />
            ))}
        </g>
      )}

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
              opacity="0.1"
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

      {/* Línea del bebé */}
      {points.length > 1 && (
        <path
          d={pathD}
          fill="none"
          stroke={meta.color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Puntos del bebé */}
      {points.map((p, i) => {
        const v = p[meta.key] as number;
        const x = xFor(dates[i] ?? 0);
        const y = yFor(v);
        return (
          <g key={`p-${p.measuredAt}-${v}`}>
            <circle cx={x} cy={y} r="6" fill={meta.color} opacity="0.18" />
            <circle cx={x} cy={y} r="3.5" fill={meta.color} />
            <circle cx={x} cy={y} r="1.3" fill="white" opacity="0.9" />
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
  return new Date(ts).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}
