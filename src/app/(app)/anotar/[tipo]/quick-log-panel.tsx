'use client';

import {
  logBottleFeedingAction,
  logDiaperAction,
  quickCloseSleepAction,
  quickStartSleepAction,
  repeatFeedingAction,
} from '@/app/(app)/cuidar/eventos/actions';
import { durationLabel } from '@/lib/baby-age';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

type ActionResult = { ok: true } | { ok: false; error: string };

type Props =
  | { kind: 'toma'; presets: number[] }
  | { kind: 'panal' }
  | {
      kind: 'sueno';
      activeSleep: { id: string; startedAt: string; isNap: boolean } | null;
    };

const DIAPER_OPTIONS = [
  { type: 'wet', label: 'Pis' },
  { type: 'dirty', label: 'Caca' },
  { type: 'both', label: 'Ambos' },
  { type: 'dry', label: 'Seco' },
] as const;

function QuickButton({
  label,
  hint,
  successMessage,
  action,
  wide = false,
}: {
  label: string;
  hint?: string;
  successMessage: string;
  action: () => Promise<ActionResult>;
  wide?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      router.replace('/home');
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        'flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-4 text-center transition-all hover:bg-muted/40 active:scale-[0.97] disabled:opacity-60',
        wide && 'col-span-2',
      )}
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      ) : (
        <span className="font-medium text-foreground text-lg">{label}</span>
      )}
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </button>
  );
}

export function QuickLogPanel(props: Props) {
  if (props.kind === 'toma') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {props.presets.map((ml) => (
          <QuickButton
            key={ml}
            label={`${ml} ml`}
            hint="mamadera"
            successMessage={`Toma de ${ml} ml anotada.`}
            action={() => logBottleFeedingAction(ml)}
          />
        ))}
        <QuickButton
          label="Repetir la última"
          hint="mismo tipo y cantidad"
          successMessage="Toma anotada igual que la anterior."
          action={repeatFeedingAction}
        />
      </div>
    );
  }

  if (props.kind === 'panal') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {DIAPER_OPTIONS.map(({ type, label }) => (
          <QuickButton
            key={type}
            label={label}
            successMessage={`Pañal (${label.toLowerCase()}) anotado.`}
            action={() => logDiaperAction(type)}
          />
        ))}
      </div>
    );
  }

  const { activeSleep } = props;
  if (activeSleep) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <QuickButton
          wide
          label="Se despertó"
          hint={`lleva ${durationLabel(activeSleep.startedAt)} ${activeSleep.isNap ? 'de siesta' : 'durmiendo'}`}
          successMessage="Listo, sueño cerrado."
          action={() => quickCloseSleepAction(activeSleep.id)}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <QuickButton
        label="Siesta"
        hint="se durmió ahora"
        successMessage="Siesta en marcha."
        action={() => quickStartSleepAction(true)}
      />
      <QuickButton
        label="Noche"
        hint="se durmió ahora"
        successMessage="Sueño de la noche en marcha."
        action={() => quickStartSleepAction(false)}
      />
    </div>
  );
}
