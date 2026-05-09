'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { summarizeProposal } from '@/lib/ai/agents/salustia/proposals';
import { Baby, BookHeart, Brain, CalendarClock, Check, Loader2, Milk, Moon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type Ref, forwardRef, useImperativeHandle, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { executeProposalAction, logProposalDeclineAction } from '../actions';

const KIND_META: Record<Proposal['kind'], { Icon: typeof Milk; label: string; verb: string }> = {
  feeding: { Icon: Milk, label: 'Toma', verb: 'Anoto' },
  sleep: { Icon: Moon, label: 'Sueño', verb: 'Anoto' },
  diaper: { Icon: Baby, label: 'Pañal', verb: 'Anoto' },
  note: { Icon: BookHeart, label: 'Momento', verb: 'Anoto' },
  milestone: { Icon: CalendarClock, label: 'Turno', verb: 'Agendo' },
  memory: { Icon: Brain, label: 'Memoria', verb: 'Recuerdo' },
};

type CardState = 'pending' | 'confirmed' | 'declined';

/**
 * Handle expuesto via ref para que ProposalGroup pueda orquestar bulk
 * actions ("Confirmar todo" / "Descartar todo") sin que cada card
 * pierda su control individual.
 */
export interface ProposalCardHandle {
  getState(): CardState;
  markConfirmed(summary: string): void;
  markDeclined(): void;
}

interface ProposalCardProps {
  proposal: Proposal;
  /** Si forma parte de un batch, número (1-indexed) de esta card. */
  index?: number;
  /** Total de cards del batch. Si está, mostramos un badge "3 / 5". */
  total?: number;
}

/**
 * Card de confirmación que aparece debajo de un mensaje del assistant
 * cuando SalustIA propuso anotar algo. La familia decide.
 *
 * - "Sí, anotalo" → executeProposalAction → INSERT → estado confirmado.
 * - "No" → solo cierra la card visualmente, sin tocar la base.
 *
 * Cuando forma parte de un batch (index + total), muestra el badge
 * "n / total" arriba para que la familia ubique cada card en el dump.
 */
export const ProposalCard = forwardRef<ProposalCardHandle, ProposalCardProps>(
  function ProposalCardImpl({ proposal, index, total }, ref: Ref<ProposalCardHandle>) {
    const router = useRouter();
    const [state, setState] = useState<CardState>('pending');
    const [confirmedSummary, setConfirmedSummary] = useState<string>('');
    const [pending, startTransition] = useTransition();
    const meta = KIND_META[proposal.kind];

    useImperativeHandle(
      ref,
      () => ({
        getState: () => state,
        markConfirmed: (summary: string) => {
          setState('confirmed');
          setConfirmedSummary(summary);
        },
        markDeclined: () => {
          setState('declined');
        },
      }),
      [state],
    );

    function confirm() {
      startTransition(async () => {
        const result = await executeProposalAction(proposal);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        setState('confirmed');
        setConfirmedSummary(result.summary);
        router.refresh();
        toast.success('Anotado.');
      });
    }

    function decline() {
      setState('declined');
      // Fire-and-forget: la auditoría de descartes no afecta UX.
      void logProposalDeclineAction(proposal);
    }

    if (state === 'confirmed') {
      return (
        <Card className="flex items-center gap-2 self-start border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="font-medium text-foreground">Anotado:</span>
          <span className="text-muted-foreground">{confirmedSummary}</span>
        </Card>
      );
    }

    if (state === 'declined') {
      return (
        <Card className="flex items-center gap-2 self-start bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
          <X className="size-4 shrink-0" aria-hidden />
          Descartado.
        </Card>
      );
    }

    const showBadge = index != null && total != null && total > 1;

    return (
      <Card className="flex max-w-[85%] flex-col gap-3 self-start border-primary/20 bg-card p-3.5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <meta.Icon className="size-4" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-2 font-medium text-foreground text-sm">
              <span>
                ¿{meta.verb}{' '}
                {proposal.kind === 'memory' ? 'esta memoria' : `este ${meta.label.toLowerCase()}`}?
              </span>
              {showBadge && (
                <span className="font-mono text-[10px] text-muted-foreground/70 tracking-wider">
                  {index} / {total}
                </span>
              )}
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
  },
);
