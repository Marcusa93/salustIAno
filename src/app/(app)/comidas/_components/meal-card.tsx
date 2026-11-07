'use client';

import { deleteEventAction, restoreEventAction } from '@/app/(app)/cuidar/eventos/actions';
import { haptic } from '@/lib/haptics';
import { FOOD_BY_KEY } from '@/lib/solids/catalog';
import {
  ACCEPTANCE_EMOJI,
  ACCEPTANCE_LABELS,
  AMOUNT_LABELS,
  FORMAT_LABELS,
  METHOD_LABELS,
  REACTION_SIGN_LABELS,
} from '@/lib/solids/labels';
import type { Meal, SolidMethod } from '@/lib/solids/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

interface MealCardProps {
  meal: Meal;
  timeLabel: string;
  method: SolidMethod | null;
  /** Claves de alimentos que en esta comida probó por primera vez. */
  firstTimeKeys: readonly string[];
}

export function MealCard({ meal, timeLabel, method, firstTimeKeys }: MealCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = () => {
    haptic('tap');
    startTransition(async () => {
      const res = await deleteEventAction('feeding_events', meal.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
      toast('Comida borrada.', {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            const back = await restoreEventAction('feeding_events', meal.id);
            if (back.ok) router.refresh();
            else toast.error(back.error);
          },
        },
      });
    });
  };

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-[0_16px_32px_-24px_var(--elevation)] ring-1 ring-solid/20 transition-opacity',
        pending && 'opacity-50',
      )}
    >
      <header className="flex items-center gap-2">
        <span className="font-medium text-foreground tabular-nums">{timeLabel}</span>
        {method && (
          <span className="rounded-full bg-solid-soft px-2 py-0.5 font-medium text-[11px] text-solid-foreground">
            {METHOD_LABELS[method]}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={`/comidas/anotar?editar=${meal.id}` as Route}
            aria-label="Editar la comida"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Borrar la comida"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      <ul className="flex flex-col gap-2.5">
        {meal.tastings.map((t) => {
          const food = FOOD_BY_KEY.get(t.foodKey);
          const details = [
            t.format ? FORMAT_LABELS[t.format] : null,
            t.amount ? AMOUNT_LABELS[t.amount] : null,
          ].filter(Boolean);
          return (
            <li key={t.id} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-solid-soft text-xl">
                {food?.emoji ?? '🍽️'}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {food ? (
                    <Link
                      href={`/comidas/alimento/${food.key}` as Route}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {t.foodName}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{t.foodName}</span>
                  )}
                  {firstTimeKeys.includes(t.foodKey) && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
                      Primera vez
                    </span>
                  )}
                  {t.gagged && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      Arcadas
                    </span>
                  )}
                </div>
                {details.length > 0 && (
                  <span className="text-muted-foreground text-sm">{details.join(' · ')}</span>
                )}
                {t.reaction !== 'none' && (
                  <span className="flex items-center gap-1 text-health-foreground text-sm">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Reacción {t.reaction === 'strong' ? 'fuerte' : 'leve'}
                    {t.reactionSigns.length > 0 &&
                      `: ${t.reactionSigns.map((s) => REACTION_SIGN_LABELS[s].toLowerCase()).join(', ')}`}
                  </span>
                )}
              </div>
              {t.acceptance && (
                <span
                  className="shrink-0 text-2xl leading-none"
                  role="img"
                  aria-label={ACCEPTANCE_LABELS[t.acceptance]}
                  title={ACCEPTANCE_LABELS[t.acceptance]}
                >
                  {ACCEPTANCE_EMOJI[t.acceptance]}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {meal.notes && (
        <p className="rounded-2xl bg-muted/60 px-3 py-2 text-muted-foreground text-sm">
          {meal.notes}
        </p>
      )}
    </article>
  );
}
