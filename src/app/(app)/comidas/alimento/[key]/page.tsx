import { formatDateAr, formatTimeAr } from '@/lib/format-ar';
import { sinceLabel } from '@/lib/home-now';
import { ALLERGEN_LABELS, FOOD_BY_KEY, FOOD_GROUP_LABELS } from '@/lib/solids/catalog';
import {
  ACCEPTANCE_EMOJI,
  ACCEPTANCE_LABELS,
  AMOUNT_LABELS,
  FORMAT_LABELS,
  REACTION_SIGN_LABELS,
} from '@/lib/solids/labels';
import { REOFFER_TARGET } from '@/lib/solids/progress';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowLeft, Plus, Sparkles } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PrepTabs } from '../../_components/prep-tabs';
import { loadSolidsData } from '../../data';

interface Props {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: FOOD_BY_KEY.get(key)?.name ?? 'Alimento' };
}

export default async function AlimentoPage({ params }: Props) {
  const { key } = await params;
  const food = FOOD_BY_KEY.get(key);
  if (!food) notFound();
  const data = await loadSolidsData();
  if (!data) notFound();

  const summary = data.summaries.find((s) => s.key === key);
  const history = data.meals.flatMap((m) => m.tastings.filter((t) => t.foodKey === key)).reverse();
  const tooEarly = food.fromMonths > data.ageMonths;
  const lastFormat = history.find((t) => t.format)?.format;
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 sm:px-6">
      <Link
        href={'/comidas' as Route}
        className="inline-flex items-center gap-1 self-start text-muted-foreground text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Comidas
      </Link>

      <header className="flex items-center gap-4">
        <span className="grid size-20 shrink-0 place-items-center rounded-[1.75rem] bg-solid-soft text-5xl">
          {food.emoji}
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            {FOOD_GROUP_LABELS[food.group]}
          </span>
          <h1 className="font-display text-[2.2rem] text-foreground leading-none tracking-tight">
            {food.name}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge>Desde los {food.fromMonths} meses</Badge>
            {food.iron && (
              <Badge tone="health">{food.iron === 'high' ? 'Mucho hierro' : 'Hierro'}</Badge>
            )}
            {food.vitaminC && <Badge>Vitamina C</Badge>}
            {(food.allergens ?? []).map((a) => (
              <Badge key={a} tone="feed">
                Alérgeno: {ALLERGEN_LABELS[a].toLowerCase()}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      {tooEarly && (
        <p className="flex gap-2 rounded-2xl bg-feed-soft px-4 py-3 text-feed-foreground text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Todavía no: se recomienda desde los {food.fromMonths} meses, salvo que la pediatra indique
          otra cosa.
        </p>
      )}

      {summary?.status === 'reaction' && (
        <p className="flex gap-2 rounded-2xl bg-health-soft px-4 py-3 text-health-foreground text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Con este alimento hubo una reacción. Antes de volver a dárselo, consultalo con la
          pediatra.
        </p>
      )}

      {summary ? (
        <section className="flex flex-col gap-2 rounded-3xl bg-card p-4 ring-1 ring-foreground/[0.06]">
          <span className="text-muted-foreground text-sm">
            Lo probó {summary.exposures === 1 ? '1 vez' : `${summary.exposures} veces`} · la última{' '}
            {sinceLabel(summary.lastAt, now)}
          </span>
          {summary.acceptances.length > 0 && (
            <div className="flex flex-wrap gap-1 text-2xl" aria-label="Cómo le fue cada vez">
              {summary.acceptances.map((a, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: la secuencia es fija y solo se lee.
                <span key={i} role="img" aria-label={ACCEPTANCE_LABELS[a]}>
                  {ACCEPTANCE_EMOJI[a]}
                </span>
              ))}
            </div>
          )}
          {summary.status === 'learning' && (
            <p className="text-foreground text-sm">
              Todavía no le entra: seguí ofreciéndolo sin presión, cambiando la preparación. Suele
              hacer falta entre 8 y {REOFFER_TARGET} intentos.
            </p>
          )}
          {summary.status === 'paused' && (
            <p className="text-foreground text-sm">
              Muchos intentos sin suerte: dale un descanso de unas semanas y volvé a probar.
            </p>
          )}
          {summary.status === 'favorite' && (
            <p className="text-foreground text-sm">
              Le encanta. Sirve de “ancla” para presentarle algo nuevo al lado.
            </p>
          )}
        </section>
      ) : (
        <p className="rounded-3xl border border-dashed px-4 py-4 text-muted-foreground text-sm">
          Todavía no lo probó.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Cómo prepararlo
        </h2>
        <PrepTabs
          puree={food.puree}
          blw={food.blw}
          initial={lastFormat === 'finger' || lastFormat === 'preloaded' ? 'blw' : 'puree'}
        />
        {food.caution && (
          <p className="flex gap-2 rounded-2xl bg-muted/60 px-3 py-2.5 text-foreground text-sm">
            <span aria-hidden>⚠️</span>
            {food.caution}
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/comidas/anotar?alimento=${food.key}` as Route}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-solid font-medium text-white dark:text-background"
        >
          <Plus className="size-5" aria-hidden />
          Anotar con {food.name.toLowerCase()}
        </Link>
        <Link
          href={
            `/chat?q=${encodeURIComponent(`Dame ideas para darle ${food.name.toLowerCase()} a ${data.firstName}`)}` as Route
          }
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-muted/70 font-medium text-foreground"
        >
          <Sparkles className="size-4 text-primary" aria-hidden />
          Ideas con SalustIA
        </Link>
      </div>

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            Cada vez que lo comió
          </h2>
          <ul className="flex flex-col gap-2">
            {history.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/[0.06]"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-foreground text-sm">
                    {formatDateAr(t.occurredAt, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    · {formatTimeAr(t.occurredAt)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {[
                      t.format ? FORMAT_LABELS[t.format] : null,
                      t.amount ? AMOUNT_LABELS[t.amount] : null,
                      t.gagged ? 'arcadas' : null,
                      t.reaction !== 'none'
                        ? `reacción ${t.reaction === 'strong' ? 'fuerte' : 'leve'}${
                            t.reactionSigns.length
                              ? ` (${t.reactionSigns.map((s) => REACTION_SIGN_LABELS[s].toLowerCase()).join(', ')})`
                              : ''
                          }`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sin detalle'}
                  </span>
                </div>
                {t.acceptance && (
                  <span
                    className="text-2xl"
                    role="img"
                    aria-label={ACCEPTANCE_LABELS[t.acceptance]}
                  >
                    {ACCEPTANCE_EMOJI[t.acceptance]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'feed' | 'health';
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-medium text-[11px]',
        tone === 'feed' && 'bg-feed-soft text-feed-foreground',
        tone === 'health' && 'bg-health-soft text-health-foreground',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}
