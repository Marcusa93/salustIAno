'use client';

import { logDailyDoseAction } from '@/app/(app)/cuidar/medicamentos/actions';
import { Button } from '@/components/ui/button';
import { formatTimeAr } from '@/lib/format-ar';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

interface DailyDoseButtonProps {
  /** Última dosis del remedio: se copia nombre, dosis e intervalo. */
  doseId: string;
  medicationName: string;
  className?: string;
}

/**
 * "Ya se lo di": anota la dosis de hoy de un remedio diario con un toque.
 * Si otra persona ya la anotó hoy, avisa y pide confirmar antes de
 * cargar una segunda.
 */
export function DailyDoseButton({ doseId, medicationName, className }: DailyDoseButtonProps) {
  const [pending, startTransition] = useTransition();

  function log(force: boolean) {
    startTransition(async () => {
      try {
        const result = await logDailyDoseAction(doseId, force);
        if (result.ok) {
          toast.success(`${medicationName} anotado a las ${formatTimeAr(result.givenAt)}.`);
          return;
        }
        if (result.alreadyGiven) {
          toast.warning(result.error, {
            description: 'Anotalo de nuevo solo si de verdad se lo dieron otra vez.',
            duration: 10_000,
            action: { label: 'Anotar igual', onClick: () => log(true) },
          });
          return;
        }
        toast.error(result.error);
      } catch {
        toast.error('No pudimos anotarlo. Revisá la conexión y probá de nuevo.');
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={() => log(false)}
      disabled={pending}
      aria-label={`Anotar que hoy se le dio ${medicationName}`}
      className={cn('shrink-0 gap-1.5', className)}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Check className="size-3.5" aria-hidden />
      )}
      Ya se lo di
    </Button>
  );
}
