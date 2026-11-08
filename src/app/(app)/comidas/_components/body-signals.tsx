import type {
  DiaperSignal,
  Insight,
  MilkBalance,
  MilkWindow,
  TextureLevel,
  TextureProgress,
} from '@/lib/solids/insights';
import { TEXTURE_LABELS } from '@/lib/solids/insights';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, Info } from 'lucide-react';
import type { ReactNode } from 'react';

const LEVEL_CLASS: Record<TextureLevel, string> = {
  1: 'bg-solid/30',
  2: 'bg-solid/65',
  3: 'bg-solid',
};

const TONE: Record<Insight['tone'], { box: string; icon: ReactNode }> = {
  ok: {
    box: 'bg-solid-soft text-solid-foreground',
    icon: <Check className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
  info: {
    box: 'bg-muted/60 text-foreground',
    icon: <Info className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
  warn: {
    box: 'bg-feed-soft text-feed-foreground',
    icon: <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
};

export function InsightNote({ insight, extra }: { insight: Insight; extra?: string }) {
  const tone = TONE[insight.tone];
  return (
    <div className={cn('flex gap-2.5 rounded-2xl px-3.5 py-3 text-sm', tone.box)}>
      {tone.icon}
      <div className="flex flex-col gap-0.5">
        <strong className="font-medium">{insight.title}</strong>
        <p className="leading-relaxed opacity-90">{insight.text}</p>
        {extra && <p className="leading-relaxed opacity-90">{extra}</p>}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/[0.06]">
      <h3 className="font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function TextureCard({ progress }: { progress: TextureProgress }) {
  const max = Math.max(1, ...progress.weeks.map((w) => w.total));
  return (
    <Card title="Texturas">
      {progress.stage !== null && (
        <p className="text-muted-foreground text-sm">
          Ahora come sobre todo:{' '}
          <span className="font-medium text-foreground">{TEXTURE_LABELS[progress.stage]}</span>
        </p>
      )}
      <div
        className="flex h-24 items-end gap-1.5"
        role="img"
        aria-label={`Texturas por semana: ${progress.weeks
          .map(
            (w) =>
              `semana ${w.index + 1}, ${w.counts[1]} lisas, ${w.counts[2]} pisadas, ${w.counts[3]} en trozos`,
          )
          .join('; ')}`}
      >
        {progress.weeks.map((w) => (
          <div key={w.index} className="flex h-full flex-1 flex-col items-center gap-1">
            <div className="flex w-full max-w-9 flex-1 flex-col-reverse overflow-hidden rounded-lg bg-muted/50">
              {([1, 2, 3] as const).map((level) =>
                w.counts[level] > 0 ? (
                  <div
                    key={level}
                    className={LEVEL_CLASS[level]}
                    style={{ height: `${(w.counts[level] / max) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">S{w.index + 1}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
        {([1, 2, 3] as const).map((level) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', LEVEL_CLASS[level])} aria-hidden />
            {TEXTURE_LABELS[level]}
          </span>
        ))}
      </div>
      {progress.insight && <InsightNote insight={progress.insight} />}
    </Card>
  );
}

function formatPerDay(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function daysLabel(days: number): string {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export function PoopCard({ signal }: { signal: DiaperSignal }) {
  const extra =
    signal.insight && signal.newFoods.length > 0
      ? `Nuevos en los últimos 3 días: ${signal.newFoods.join(', ')}.`
      : undefined;
  return (
    <Card title="Caca">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Última</dt>
          <dd className="font-medium text-foreground">
            {signal.daysWithoutPoop === null ? 'Sin datos' : daysLabel(signal.daysWithoutPoop)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Por día</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {signal.recentPerDay !== null ? formatPerDay(signal.recentPerDay) : '—'}
            {signal.beforePerDay !== null && (
              <span className="font-normal text-muted-foreground">
                {' '}
                · antes {formatPerDay(signal.beforePerDay)}
              </span>
            )}
          </dd>
        </div>
      </dl>
      {signal.insight ? (
        <InsightNote insight={signal.insight} extra={extra} />
      ) : (
        <p className="text-muted-foreground text-xs">
          Con los sólidos la caca cambia de color, olor y consistencia: es normal. Fijate si está
          dura o le cuesta.
        </p>
      )}
    </Card>
  );
}

function milkLine(w: MilkWindow): string {
  const parts: string[] = [];
  if (w.bottleMl > 0) parts.push(`${w.bottleMl} ml de mamadera`);
  if (w.breastfeeds > 0) parts.push(`${formatPerDay(w.breastfeeds)} de pecho`);
  return parts.length > 0 ? parts.join(' · ') : 'Sin tomas anotadas';
}

export function MilkCard({ balance }: { balance: MilkBalance }) {
  return (
    <Card title="Leche">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Antes de empezar</dt>
          <dd className="font-medium text-foreground">
            {balance.before ? `${milkLine(balance.before)} por día` : 'Sin datos'}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Ahora</dt>
          <dd className="font-medium text-foreground">
            {balance.recent ? `${milkLine(balance.recent)} por día` : 'En unos días'}
          </dd>
        </div>
      </dl>
      {balance.insight ? (
        <InsightNote insight={balance.insight} />
      ) : (
        <p className="text-muted-foreground text-xs">
          Hasta el año la leche sigue siendo lo principal. Cuando haya unos días de comidas,
          comparamos con lo que tomaba antes.
        </p>
      )}
    </Card>
  );
}
