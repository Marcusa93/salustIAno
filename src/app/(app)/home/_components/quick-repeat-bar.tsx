'use client';

import {
  logBottleFeedingAction,
  logDiaperAction,
  quickCloseSleepAction,
  quickStartSleepAction,
} from '@/app/(app)/cuidar/eventos/actions';
import { DiaperQuickAdd } from '@/app/(app)/home/_components/diaper-quick-add';
import { FeedingQuickAdd } from '@/app/(app)/home/_components/feeding-quick-add';
import { SleepQuickAdd } from '@/app/(app)/home/_components/sleep-quick-add';
import { durationLabel } from '@/lib/baby-age';
import { Baby, Loader2, Milk, Moon, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

type DiaperType = 'wet' | 'dirty' | 'both' | 'dry';

const QUICK_DIAPER_LABELS: Record<DiaperType, string> = {
  wet: 'Pis',
  dirty: 'Caca',
  both: 'Ambos',
  dry: 'Seco',
};

const DIAPER_TYPES: DiaperType[] = ['wet', 'dirty', 'both', 'dry'];

interface Props {
  feedingPresets: number[];
  activeSleep: { id: string; started_at: string; is_nap: boolean } | null;
  lastWokeUpAt: string | null;
}

function FeedingPresetBtn({ amountMl }: { amountMl: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function handle() {
    start(async () => {
      const r = await logBottleFeedingAction(amountMl);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`${amountMl} ml anotados.`);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-label={`Registrar toma de ${amountMl} ml ahora`}
      className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border bg-card font-medium text-foreground text-sm transition-all hover:bg-muted/40 active:scale-95 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : `${amountMl} ml`}
    </button>
  );
}

function DiaperTypeBtn({ type }: { type: DiaperType }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = QUICK_DIAPER_LABELS[type];

  function handle() {
    start(async () => {
      const r = await logDiaperAction(type);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`Pañal (${label}) anotado.`);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-label={`Registrar pañal ${label}`}
      className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border bg-card font-medium text-foreground text-xs transition-all hover:bg-muted/40 active:scale-95 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : label}
    </button>
  );
}

function SleepStartBtn({ isNap }: { isNap: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = isNap ? 'Siesta' : 'Noche';

  function handle() {
    start(async () => {
      const r = await quickStartSleepAction(isNap);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`${isNap ? 'Siesta' : 'Sueño'} iniciado.`);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-label={`Registrar que Salu se durmió ahora (${label.toLowerCase()})`}
      className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border bg-card font-medium text-foreground text-sm transition-all hover:bg-muted/40 active:scale-95 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : label}
    </button>
  );
}

function SleepCloseBtn({
  activeSleep,
}: {
  activeSleep: { id: string; started_at: string; is_nap: boolean };
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function handle() {
    start(async () => {
      const r = await quickCloseSleepAction(activeSleep.id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success('Se despertó. Sueño cerrado.');
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-label="Registrar que Salu se despertó ahora"
      className="flex w-full items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-left transition-all hover:bg-primary/10 active:scale-[0.97] disabled:opacity-60"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Moon className="size-3.5" aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-foreground text-xs">Se despertó</span>
        <span className="truncate text-[10.5px] text-muted-foreground">
          lleva {durationLabel(activeSleep.started_at)}{' '}
          {activeSleep.is_nap ? 'de siesta' : 'durmiendo'}
        </span>
      </span>
    </button>
  );
}

export function QuickRepeatBar({ feedingPresets, activeSleep, lastWokeUpAt }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {activeSleep && <SleepCloseBtn activeSleep={activeSleep} />}

      {/* Ventana de vigilia — cuánto lleva despierto desde el último sueño */}
      {!activeSleep && lastWokeUpAt && (
        <p className="px-1 text-[11px] text-muted-foreground/70">
          Despierto hace {durationLabel(lastWokeUpAt)}.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Fila toma */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span
            className="flex size-6 shrink-0 items-center justify-center text-primary/70"
            aria-hidden
          >
            <Milk className="size-4" />
          </span>
          <div className="flex flex-1 gap-1.5">
            {feedingPresets.map((ml) => (
              <FeedingPresetBtn key={ml} amountMl={ml} />
            ))}
            <FeedingQuickAdd
              trigger={
                <button
                  type="button"
                  aria-label="Anotar toma con opciones"
                  className="flex h-9 items-center justify-center gap-0.5 rounded-lg border border-border border-dashed px-2.5 text-muted-foreground text-xs transition-all hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="size-3" aria-hidden />
                  otro
                </button>
              }
            />
          </div>
        </div>

        <div className="border-border/50 border-t" aria-hidden />

        {/* Fila sueño — solo cuando no hay sueño activo */}
        {!activeSleep && (
          <>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span
                className="flex size-6 shrink-0 items-center justify-center text-primary/70"
                aria-hidden
              >
                <Moon className="size-4" />
              </span>
              <div className="flex flex-1 gap-1.5">
                <SleepStartBtn isNap={false} />
                <SleepStartBtn isNap={true} />
                <SleepQuickAdd
                  trigger={
                    <button
                      type="button"
                      aria-label="Anotar sueño con opciones"
                      className="flex h-9 items-center justify-center gap-0.5 rounded-lg border border-border border-dashed px-2.5 text-muted-foreground text-xs transition-all hover:border-primary/40 hover:text-primary"
                    >
                      <Plus className="size-3" aria-hidden />
                      ajustar
                    </button>
                  }
                />
              </div>
            </div>
            <div className="border-border/50 border-t" aria-hidden />
          </>
        )}

        {/* Fila pañal */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span
            className="flex size-6 shrink-0 items-center justify-center text-primary/70"
            aria-hidden
          >
            <Baby className="size-4" />
          </span>
          <div className="flex flex-1 gap-1.5">
            {DIAPER_TYPES.map((type) => (
              <DiaperTypeBtn key={type} type={type} />
            ))}
            <DiaperQuickAdd
              trigger={
                <button
                  type="button"
                  aria-label="Anotar pañal con opciones"
                  className="flex h-9 items-center justify-center gap-0.5 rounded-lg border border-border border-dashed px-2.5 text-muted-foreground text-xs transition-all hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="size-3" aria-hidden />
                  ajustar
                </button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
