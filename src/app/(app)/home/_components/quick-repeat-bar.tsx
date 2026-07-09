'use client';

import { repeatDiaperAction, repeatFeedingAction } from '@/app/(app)/cuidar/eventos/actions';
import { Baby, CheckCircle2, Loader2, Milk } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

interface Props {
  lastFeedingAmountMl: number | null;
  lastDiaperTypeLabel: string | null;
}

function RepeatButton({
  icon: Icon,
  label,
  sublabel,
  onRepeat,
  ariaLabel,
}: {
  icon: typeof Milk;
  label: string;
  sublabel: string | null;
  onRepeat: () => Promise<{ ok: true } | { ok: false; error: string }>;
  ariaLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await onRepeat();
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
      className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-all active:scale-[0.97] disabled:opacity-60 hover:bg-muted/40"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
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

export function QuickRepeatBar({ lastFeedingAmountMl, lastDiaperTypeLabel }: Props) {
  if (!lastFeedingAmountMl && !lastDiaperTypeLabel) return null;

  return (
    <div className="flex gap-2.5">
      {lastFeedingAmountMl !== null && (
        <RepeatButton
          icon={Milk}
          label="Repetir toma"
          sublabel={`${lastFeedingAmountMl} ml como la última`}
          onRepeat={repeatFeedingAction}
          ariaLabel={`Registrar toma de ${lastFeedingAmountMl} ml ahora`}
        />
      )}
      {lastDiaperTypeLabel !== null && (
        <RepeatButton
          icon={Baby}
          label="Repetir pañal"
          sublabel={lastDiaperTypeLabel}
          onRepeat={repeatDiaperAction}
          ariaLabel={`Registrar pañal (${lastDiaperTypeLabel}) ahora`}
        />
      )}
    </div>
  );
}
