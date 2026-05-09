'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Proposal } from '@/lib/ai/agents/salustia/proposals';
import { Check, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { executeProposalAction, logProposalDeclineAction } from '../actions';
import { ProposalCard, type ProposalCardHandle } from './proposal-card';

interface ProposalGroupProps {
  /** Las N propuestas que el agente armó en este turno. */
  proposals: ReadonlyArray<Proposal>;
}

/**
 * Wrapper que aparece debajo del mensaje del assistant cuando armó >1
 * propuestas en el mismo turno (típico cuando la familia pega un dump
 * de WhatsApp con varios eventos). Suma:
 *
 *   - Counter visual: "Hay 5 cosas para anotar"
 *   - Botón "Confirmar todo" que ejecuta los inserts en paralelo,
 *     reduciendo de N taps a 1.
 *   - "Descartar todo" como contraparte rápida.
 *   - Cada ProposalCard individual sigue intacta — podés descartar 1
 *     puntual o confirmarla suelta si preferís ese flow.
 *
 * Si llega 1 sola propuesta, mostramos solo la card sin overhead — no
 * tiene sentido el contador para 1 evento.
 */
export function ProposalGroup({ proposals }: ProposalGroupProps) {
  const router = useRouter();
  const [bulkRunning, startBulk] = useTransition();
  const [bulkDone, setBulkDone] = useState<{
    confirmed: number;
    failed: number;
  } | null>(null);
  const cardRefs = useRef<Array<ProposalCardHandle | null>>([]);

  // Caso simple: 1 sola propuesta → fallback al render plano.
  if (proposals.length <= 1) {
    return (
      <>
        {proposals.map((p, i) => (
          <ProposalCard
            // biome-ignore lint/suspicious/noArrayIndexKey: orden estable dentro del turno.
            key={`${i}-${p.kind}`}
            proposal={p}
          />
        ))}
      </>
    );
  }

  function confirmAll() {
    startBulk(async () => {
      // Snapshot de qué cards siguen pending (no confirmadas/descartadas
      // todavía a mano). Las que ya estén resueltas no se re-ejecutan.
      const targets = cardRefs.current
        .map((ref, i) => ({ ref, i }))
        .filter((t) => t.ref?.getState() === 'pending');

      if (targets.length === 0) return;

      // Ejecutamos en paralelo. Cada result es independiente — si una
      // falla, no rollbackeamos las que ya pasaron (no hay tx atómica
      // entre eventos distintos en el dominio del bebé).
      const results = await Promise.all(
        targets.map(async (t) => {
          const proposal = proposals[t.i];
          if (!proposal) return { ok: false as const, idx: t.i };
          const result = await executeProposalAction(proposal);
          return { ...result, idx: t.i, summary: result.ok ? result.summary : null };
        }),
      );

      let confirmed = 0;
      let failed = 0;
      for (const r of results) {
        const card = cardRefs.current[r.idx];
        if (!card) continue;
        if (r.ok) {
          card.markConfirmed(r.summary ?? '');
          confirmed++;
        } else {
          failed++;
        }
      }

      router.refresh();
      setBulkDone({ confirmed, failed });
      if (failed === 0) {
        toast.success(`Listo: anotamos ${confirmed} ${confirmed === 1 ? 'cosa' : 'cosas'}.`);
      } else if (confirmed === 0) {
        toast.error('No pudimos guardar ninguna. Probá una por una.');
      } else {
        toast.warning(`Anotamos ${confirmed}. ${failed} fallaron — revisalas abajo.`);
      }
    });
  }

  function declineAll() {
    if (!window.confirm(`¿Descartar las ${proposals.length} propuestas? No se guarda nada.`)) {
      return;
    }
    for (let i = 0; i < proposals.length; i++) {
      const card = cardRefs.current[i];
      if (card?.getState() === 'pending') card.markDeclined();
    }
    // Auditoría fire-and-forget para todas.
    for (const p of proposals) void logProposalDeclineAction(p);
  }

  const total = proposals.length;
  const headerLabel = bulkDone
    ? bulkDone.failed === 0
      ? `Listo. ${bulkDone.confirmed} anotad${bulkDone.confirmed === 1 ? 'a' : 'as'}.`
      : `${bulkDone.confirmed} anotad${bulkDone.confirmed === 1 ? 'a' : 'as'}, ${bulkDone.failed} fallar${bulkDone.failed === 1 ? 'on' : 'on'}.`
    : `Tengo ${total} cosas para anotar — confirmá todas juntas o una por una.`;

  return (
    <div className="flex max-w-[85%] flex-col gap-2 self-start">
      {/* Header con counter + acciones bulk */}
      <Card className="flex flex-col gap-2 border-primary/30 bg-primary/[0.06] p-3">
        <p className="text-foreground text-sm">
          <span className="font-medium">{headerLabel}</span>
        </p>
        {!bulkDone && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={confirmAll}
              disabled={bulkRunning}
              className="flex-1"
            >
              {bulkRunning ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Anotando…
                </>
              ) : (
                <>
                  <Check className="size-3.5" aria-hidden />
                  Confirmar todo
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={declineAll}
              disabled={bulkRunning}
            >
              <X className="size-3.5" aria-hidden />
              Descartar todo
            </Button>
          </div>
        )}
      </Card>

      {/* Cards individuales — siguen funcionando independientemente para
          ajustes finos (ej: confirmar 4 y descartar 1). */}
      {proposals.map((p, i) => (
        <ProposalCard
          // biome-ignore lint/suspicious/noArrayIndexKey: orden estable dentro del turno.
          key={`${i}-${p.kind}`}
          proposal={p}
          ref={(handle) => {
            cardRefs.current[i] = handle;
          }}
          index={i + 1}
          total={total}
        />
      ))}
    </div>
  );
}
