'use client';

import {
  deleteEventAction,
  quickCloseSleepAction,
  quickStartSleepAction,
  reopenSleepAction,
} from '@/app/(app)/cuidar/eventos/actions';
import { useNow } from '@/hooks/useNow';
import { formatTimeAr } from '@/lib/format-ar';
import { haptic } from '@/lib/haptics';
import { elapsedParts, isStale, sinceLabel, sleepKindAt, wakeProgress } from '@/lib/home-now';
import { cn } from '@/lib/utils';
import type { WakeWindow } from '@/lib/wake-windows';
import { Loader2, Milk, Moon, Sun, Sunrise } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface NowCardProps {
  activeSleep: { id: string; started_at: string; is_nap: boolean } | null;
  lastWokeUpAt: string | null;
  lastFeeding: { at: string; detail: string | null } | null;
  nextFeedingLabel: string | null;
  wakeWindow: WakeWindow | null;
  /** Hora del render en el server: el contador arranca desde acá. */
  renderedAt: string;
}

const WAKE_MESSAGES = {
  early: 'Todavía tiene pila.',
  ideal: 'Buen momento para hacerlo dormir.',
  late: 'Ya pasó su ventana: puede estar cansado.',
} as const;

/**
 * "Ahora": el estado de Salu en este momento, con el contador corriendo y
 * la acción que más probablemente toque (dormirlo o anotar que se despertó).
 */
export function NowCard({
  activeSleep,
  lastWokeUpAt,
  lastFeeding,
  nextFeedingLabel,
  wakeWindow,
  renderedAt,
}: NowCardProps) {
  const now = useNow(30_000, renderedAt);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<'nap' | 'night'>(() => sleepKindAt(new Date(renderedAt)));
  const sleeping = activeSleep !== null;

  const since = sleeping ? activeSleep.started_at : lastWokeUpAt;
  const elapsed = since ? elapsedParts(since, now) : null;
  const progress =
    !sleeping && lastWokeUpAt && wakeWindow ? wakeProgress(lastWokeUpAt, wakeWindow, now) : null;

  const wakeUp = () => {
    if (!activeSleep) return;
    startTransition(async () => {
      const result = await quickCloseSleepAction(activeSleep.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      haptic('success');
      toast.success('Se despertó.', {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            const undone = await reopenSleepAction(activeSleep.id);
            if (!undone.ok) toast.error(undone.error);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  };

  const fallAsleep = () => {
    startTransition(async () => {
      const result = await quickStartSleepAction(kind === 'nap');
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      haptic('success');
      toast.success(kind === 'nap' ? 'Siesta empezada.' : 'Se durmió.', {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            const undone = await deleteEventAction('sleep_sessions', result.id);
            if (!undone.ok) toast.error(undone.error);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  };

  return (
    <section
      aria-label="Ahora"
      className={cn(
        'relative overflow-hidden rounded-[2rem] p-6 shadow-[0_24px_48px_-28px_var(--elevation)] ring-1 transition-colors duration-500',
        sleeping
          ? 'bg-sleep-soft text-sleep-foreground ring-sleep/20'
          : 'bg-card text-card-foreground ring-foreground/[0.06]',
      )}
    >
      {/* Halo del estado: luna de noche o sol tibio. */}
      <div
        aria-hidden
        className={cn(
          '-top-24 -right-20 pointer-events-none absolute size-64 rounded-full blur-3xl',
          sleeping ? 'bg-sleep/25' : 'bg-feed/20',
        )}
      />

      <div className="relative flex items-center gap-2 font-medium text-xs uppercase tracking-[0.2em]">
        {sleeping ? (
          <Moon className="size-4 animate-breathe" aria-hidden />
        ) : (
          <Sun className="size-4" aria-hidden />
        )}
        <span>
          {sleeping ? (activeSleep.is_nap ? 'Durmiendo la siesta' : 'Durmiendo') : 'Despierto'}
        </span>
      </div>

      {elapsed ? (
        <p className="relative mt-3 flex items-baseline gap-1.5 font-display leading-none">
          {elapsed.hours > 0 && (
            <>
              <span className="text-[4.25rem] tabular-nums tracking-tight">{elapsed.hours}</span>
              <span className="mr-2 text-2xl opacity-60">h</span>
            </>
          )}
          <span className="text-[4.25rem] tabular-nums tracking-tight">{elapsed.minutes}</span>
          <span className="text-2xl opacity-60">min</span>
        </p>
      ) : (
        <p className="relative mt-3 font-display text-3xl">Sin datos de sueño todavía</p>
      )}

      {since && (
        <p className="relative mt-2 text-sm opacity-75">
          {sleeping
            ? `Desde las ${formatTimeAr(since)}`
            : `Se despertó a las ${formatTimeAr(since)}`}
        </p>
      )}

      {progress && wakeWindow && (
        <div className="relative mt-5 flex flex-col gap-2">
          {/* Decorativa: el texto de abajo dice lo mismo para lectores de pantalla. */}
          <div aria-hidden className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 bg-sleep/25"
              style={{ left: `${progress.idealStart * 100}%` }}
            />
            <motion.div
              aria-hidden
              className={cn(
                'absolute inset-y-0 left-0 rounded-full',
                progress.status === 'late' ? 'bg-health' : 'bg-sleep',
              )}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress.fraction, 1) * 100}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            <span className="font-medium text-foreground">{WAKE_MESSAGES[progress.status]}</span> A
            esta edad aguanta despierto de {formatMinutes(wakeWindow.minMinutes)} a{' '}
            {formatMinutes(wakeWindow.maxMinutes)}.
          </p>
        </div>
      )}

      <div className="relative mt-6 flex flex-col gap-2">
        {sleeping ? (
          <button
            type="button"
            onClick={wakeUp}
            disabled={pending}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sleep font-medium text-base text-primary-foreground shadow-lg shadow-sleep/30 transition-transform active:scale-[0.98] disabled:opacity-70"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Sunrise className="size-5" aria-hidden />
            )}
            Se despertó
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fallAsleep}
              disabled={pending}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-sleep font-medium text-base text-primary-foreground shadow-lg shadow-sleep/30 transition-transform active:scale-[0.98] disabled:opacity-70"
            >
              {pending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Moon className="size-5" aria-hidden />
              )}
              Se durmió
            </button>
            <fieldset className="flex rounded-2xl bg-muted p-1 font-medium text-sm">
              <legend className="sr-only">Tipo de sueño</legend>
              {(['nap', 'night'] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex cursor-pointer items-center rounded-xl px-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    kind === option
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name="sleep-kind"
                    value={option}
                    checked={kind === option}
                    onChange={() => setKind(option)}
                    className="sr-only"
                  />
                  {option === 'nap' ? 'Siesta' : 'Noche'}
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </div>

      {lastFeeding && (
        <p className="relative mt-5 flex items-center gap-2 border-current/10 border-t pt-4 text-sm">
          <span className="grid size-7 place-items-center rounded-full bg-feed-soft text-feed-foreground">
            <Milk className="size-3.5" aria-hidden />
          </span>
          <span className="opacity-80">
            {isStale(lastFeeding.at, now) ? (
              <>No hay tomas anotadas desde {sinceLabel(lastFeeding.at, now)}.</>
            ) : (
              <>
                Última toma {sinceLabel(lastFeeding.at, now)}
                {lastFeeding.detail ? ` · ${lastFeeding.detail}` : ''}
                {nextFeedingLabel ? ` · próxima ~${nextFeedingLabel}` : ''}
              </>
            )}
          </span>
        </p>
      )}
    </section>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}
