'use client';

import { SpeakButton } from '@/components/salu/speak-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { generateDailySummaryAction } from '../daily-summary-actions';

interface DailySummaryCardProps {
  childId: string;
  /** Cantidad de eventos hoy. Si es 0, no se ofrece generar (no hay nada que resumir). */
  todayEventCount: number;
}

interface CachedSummary {
  date: string;
  summary: string;
  highlight: string;
  eventCount: number;
}

const STORAGE_KEY_PREFIX = 'salu-daily-summary';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readCache(childId: string): CachedSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${childId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSummary;
    if (parsed.date !== todayKey()) return null; // expired (otro día)
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(childId: string, value: CachedSummary): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}-${childId}`, JSON.stringify(value));
  } catch {
    /* localStorage lleno o bloqueado */
  }
}

/**
 * Card de "El día de Salu" en /home. Genera con IA un resumen narrativo de
 * 1-3 oraciones del día. Auto-genera al primer load del día si hay eventos
 * (1 sola vez), después se cachea en localStorage. La familia puede tocar
 * "Regenerar" si quiere actualizar.
 */
export function DailySummaryCard({ childId, todayEventCount }: DailySummaryCardProps) {
  const [data, setData] = useState<CachedSummary | null>(() => readCache(childId));
  const [pending, startGeneration] = useTransition();
  // Sólo intentamos auto-generar 1 vez por mount (evitar loops).
  const [autoTried, setAutoTried] = useState(false);

  function handleGenerate(silent = false) {
    startGeneration(async () => {
      const result = await generateDailySummaryAction();
      if (!result.ok) {
        if (!silent) toast.error(result.error);
        return;
      }
      const value: CachedSummary = {
        date: todayKey(),
        summary: result.summary,
        highlight: result.highlight,
        eventCount: result.eventCount,
      };
      writeCache(childId, value);
      setData(value);
    });
  }

  // Auto-generar al primer render del día si hay eventos y no había cache.
  useEffect(() => {
    if (autoTried) return;
    setAutoTried(true);
    if (data) return;
    if (todayEventCount === 0) return;
    handleGenerate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTried, data, todayEventCount]);

  // Si todavía no se generó y no hay eventos, no mostramos nada (la familia
  // ya ve el card de "anotar primero").
  if (!data && todayEventCount === 0 && !pending) return null;

  return (
    <Card
      className={cn(
        'relative flex flex-col gap-3 border-primary/15 bg-gradient-to-br from-primary/[0.06] via-background to-accent/20 p-4 sm:p-5',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary"
        >
          <Sparkles className="size-4" />
        </span>
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          El día con IA
        </span>
        {data?.highlight && (
          <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
            {data.highlight}
          </span>
        )}
      </div>

      <p className="font-display text-foreground text-lg leading-snug tracking-tight sm:text-xl">
        {pending && !data ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground text-base">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Mirando lo de hoy…
          </span>
        ) : data ? (
          data.summary
        ) : (
          <span className="text-muted-foreground text-base">
            Tocá generar para ver cómo viene el día.
          </span>
        )}
      </p>

      <div className="flex items-center gap-1.5">
        {data?.summary && <SpeakButton text={data.summary} />}
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => handleGenerate(false)}
          disabled={pending}
          className="ml-auto text-muted-foreground"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3" aria-hidden />
          )}
          {data ? 'Regenerar' : 'Generar'}
        </Button>
      </div>
    </Card>
  );
}
