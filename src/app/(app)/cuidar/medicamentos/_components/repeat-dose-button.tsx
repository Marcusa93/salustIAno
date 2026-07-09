'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { repeatDoseAction } from '../actions';

interface Props {
  doseId: string;
  medicationName: string;
}

export function RepeatDoseButton({ doseId, medicationName }: Props) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await repeatDoseAction(doseId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={handle}
      disabled={pending}
      aria-label={`Registrar dosis de ${medicationName} ahora`}
      className="h-7 gap-1.5 px-3 text-xs"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <CheckCircle2 className="size-3" aria-hidden />
      )}
      Dar ahora
    </Button>
  );
}
