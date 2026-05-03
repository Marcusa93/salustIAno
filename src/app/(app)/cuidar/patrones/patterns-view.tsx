'use client';

import { SpeakButton } from '@/components/salu/speak-button';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { type PatternsResult, getPatternsAction } from './actions';

interface PatternsViewProps {
  initial: PatternsResult;
}

const TONE_LABEL: Record<string, string> = {
  tranquilo: 'Tranquilo',
  estable: 'Estable',
  'cambios suaves': 'Cambios suaves',
  'pocos datos': 'Pocos datos',
};

export function PatternsView({ initial }: PatternsViewProps) {
  const [data, setData] = useState<PatternsResult>(initial);
  const [pending, startPending] = useTransition();

  function handleRegenerate() {
    startPending(async () => {
      const result = await getPatternsAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setData(result);
      toast.success('Observaciones actualizadas.');
    });
  }

  if (!data.ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{data.error}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleRegenerate}
          disabled={pending}
          className="self-start"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Reintentar
        </Button>
      </div>
    );
  }

  const fullText = data.observations.join(' ');
  const toneLabel = TONE_LABEL[data.tone] ?? data.tone;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2.5">
        {data.observations.map((obs) => (
          <li
            key={obs}
            className="flex gap-2.5 rounded-xl border border-border/60 bg-card/60 p-3 leading-relaxed"
          >
            <span aria-hidden className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="text-foreground text-sm">{obs}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-[11px] text-primary">
          {toneLabel}
        </span>
        <span className="text-muted-foreground text-xs">
          Sobre {data.daysWithData} día{data.daysWithData === 1 ? '' : 's'} con datos.
        </span>
        <SpeakButton text={fullText} className="ml-1" />
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={handleRegenerate}
          disabled={pending}
          className="ml-auto text-muted-foreground"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3" aria-hidden />
          )}
          Regenerar
        </Button>
      </div>
    </div>
  );
}
