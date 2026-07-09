'use client';

import {
  quickCloseSleepAction,
  repeatDiaperAction,
  repeatFeedingAction,
} from '@/app/(app)/cuidar/eventos/actions';
import { durationLabel } from '@/lib/baby-age';
import { Baby, CheckCircle2, Loader2, Milk, Moon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

interface Props {
  lastFeedingAmountMl: number | null;
  lastDiaperTypeLabel: string | null;
  activeSleep: { id: string; started_at: string; is_nap: boolean } | null;
}

function QuickButton({
  icon: Icon,
  label,
  sublabel,
  onAction,
  ariaLabel,
  variant = 'default',
}: {
  icon: typeof Milk;
  label: string;
  sublabel: string | null;
  onAction: () => Promise<{ ok: true } | { ok: false; error: string }>;
  ariaLabel: string;
  variant?: 'default' | 'sleep';
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await onAction();
      if (!result.ok) toast.error(result.error);
      else toast.success(`${label} registrado.`);
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-label={ariaLabel}
      className={`flex flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.97] disabled:opacity-60 hover:bg-muted/40 ${
        variant === 'sleep' ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          variant === 'sleep' ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary'
        }`}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Icon className="size-3.5" aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-foreground text-xs">{label}</span>
        {sublabel && (
          <span className="truncate text-[10.5px] text-muted-foreground">{sublabel}</span>
        )}
      </span>
      <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
    </button>
  );
}

export function QuickRepeatBar({ lastFeedingAmountMl, lastDiaperTypeLabel, activeSleep }: Props) {
  const hasSleep = !!activeSleep;
  const hasFeeding = lastFeedingAmountMl !== null;
  const hasDiaper = lastDiaperTypeLabel !== null;

  if (!hasSleep && !hasFeeding && !hasDiaper) return null;

  return (
    <div className="flex flex-col gap-2">
      {hasSleep && activeSleep && (
        <div className="flex">
          <QuickButton
            icon={Moon}
            label="Se despertó"
            sublabel={`lleva ${durationLabel(activeSleep.started_at)} ${activeSleep.is_nap ? 'de siesta' : 'durmiendo'}`}
            onAction={() => quickCloseSleepAction(activeSleep.id)}
            ariaLabel="Registrar que Salu se despertó ahora"
            variant="sleep"
          />
        </div>
      )}
      {(hasFeeding || hasDiaper) && (
        <div className="flex gap-2.5">
          {hasFeeding && (
            <QuickButton
              icon={Milk}
              label="Repetir toma"
              sublabel={`${lastFeedingAmountMl} ml como la última`}
              onAction={repeatFeedingAction}
              ariaLabel={`Registrar toma de ${lastFeedingAmountMl} ml ahora`}
            />
          )}
          {hasDiaper && (
            <QuickButton
              icon={Baby}
              label="Repetir pañal"
              sublabel={lastDiaperTypeLabel}
              onAction={repeatDiaperAction}
              ariaLabel={`Registrar pañal (${lastDiaperTypeLabel}) ahora`}
            />
          )}
        </div>
      )}
    </div>
  );
}
