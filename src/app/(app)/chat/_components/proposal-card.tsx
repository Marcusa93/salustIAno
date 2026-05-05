'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { summarizeProposal } from '@/lib/ai/agents/salustia/proposals';
import { Baby, BookHeart, Check, Loader2, Milk, Moon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { executeProposalAction, logProposalDeclineAction } from '../actions';

const KIND_META: Record<Proposal['kind'], { Icon: typeof Milk; label: string }> = {
  feeding: { Icon: Milk, label: 'Toma' },
  sleep: { Icon: Moon, label: 'Sueño' },
  diaper: { Icon: Baby, label: 'Pañal' },
  note: { Icon: BookHeart, label: 'Momento' },
};

type CardState =
  | { kind: 'pending' }
  | { kind: 'confirmed'; summary: string }
  | { kind: 'declined' };

/**
 * Card de confirmación que aparece debajo de un mensaje del assistant
 * cuando SalustIA propuso anotar algo. La familia decide.
 *
 * - "Sí, anotalo" → executeProposalAction → INSERT → estado confirmado.
 * - "No" → solo cierra la card visualmente, sin tocar la base.
 */
export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const [state, setState] = useState<CardState>({ kind: 'pending' });
  const [pending, startTransition] = useTransition();
  const meta = KIND_META[proposal.kind];

  function confirm() {
    startTransition(async () => {
      const result = await executeProposalAction(proposal);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setState({ kind: 'confirmed', summary: result.summary });
      router.refresh();
      toast.success('Anotado.');
    });
  }

  function decline() {
    setState({ kind: 'declined' });
    // Fire-and-forget: la auditoría de descartes no afecta UX.
    void logProposalDeclineAction(proposal);
  }

  if (state.kind === 'confirmed') {
    return (
      <Card className="flex items-center gap-2 self-start border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <Check className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-foreground">Anotado:</span>
        <span className="text-muted-foreground">{state.summary}</span>
      </Card>
    );
  }

  if (state.kind === 'declined') {
    return (
      <Card className="flex items-center gap-2 self-start bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
        <X className="size-4 shrink-0" aria-hidden />
        Descartado.
      </Card>
    );
  }

  return (
    <Card className="flex max-w-[85%] flex-col gap-3 self-start border-primary/20 bg-card p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <meta.Icon className="size-4" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground text-sm">
            ¿Anoto este {meta.label.toLowerCase()}?
          </span>
          <span className="text-muted-foreground text-xs">{summarizeProposal(proposal)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={confirm} disabled={pending} className="flex-1">
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Anotando…
            </>
          ) : (
            <>
              <Check className="size-3.5" aria-hidden />
              Sí, anotalo
            </>
          )}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={decline} disabled={pending}>
          <X className="size-3.5" aria-hidden />
          No
        </Button>
      </div>
    </Card>
  );
}
