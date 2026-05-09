'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SleepCoachOutput } from '@/lib/ai/agents/pediatric-sleep-coach';
import { cn } from '@/lib/utils';
import { AlertTriangle, Baby, Loader2, Milk, Moon, RotateCw, Sparkles, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { type NightCoachResult, getNightCoachAction } from '../night-coach-actions';

interface CachedEntry {
  childId: string;
  fetchedAt: number;
  output: SleepCoachOutput;
}

const CACHE_KEY = 'salu-night-coach-v1';
const CACHE_TTL_MIN = 30;
const NULL_CACHE_KEY = 'salu-night-coach-null-v1';
const NULL_CACHE_TTL_MIN = 5;

const DIAGNOSIS_META: Record<
  SleepCoachOutput['diagnosis'],
  { label: string; Icon: LucideIcon; tone: string }
> = {
  hunger: { label: 'Hambre', Icon: Milk, tone: 'text-primary' },
  sleep_cycle: { label: 'Ciclo de sueño', Icon: Moon, tone: 'text-primary' },
  discomfort: { label: 'Incomodidad', Icon: Baby, tone: 'text-amber-600' },
  overtired: { label: 'Sobrecansancio', Icon: Wind, tone: 'text-amber-600' },
  undertired: { label: 'Poco cansancio', Icon: Wind, tone: 'text-muted-foreground' },
  unclear: { label: 'No está claro', Icon: Sparkles, tone: 'text-muted-foreground' },
};

const CONFIDENCE_LABEL: Record<SleepCoachOutput['confidence'], string> = {
  low: 'baja confianza',
  medium: 'confianza media',
  high: 'alta confianza',
};

interface NightCoachCardProps {
  childId: string;
}

/**
 * Tarjeta del coach de sueño pediátrico que aparece en /home entre
 * 22-06 AR. Lee la situación del bebé y devuelve un diagnóstico breve
 * + sugerencia accionable + por qué.
 *
 * Cache de 30 min en localStorage por childId — abrir la app 4 veces
 * en una hora no quema 4 calls de LLM. Si el resultado anterior es
 * útil, lo mostramos. Botón "refrescar" si la situación cambió.
 *
 * Si el server devuelve `ok:false` por una razón "estable" (no_child,
 * not_late_night) cacheamos el null por 5 min para evitar reintentar
 * en loop. Para errores de LLM no cacheamos — botón refrescar reintenta.
 */
export function NightCoachCard({ childId }: NightCoachCardProps) {
  const [output, setOutput] = useState<SleepCoachOutput | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: queremos correr una vez por childId.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Cache hit?
    const cached = readCache(childId);
    if (cached) {
      setOutput(cached);
      return;
    }
    // Null-cache hit (intentamos hace poco y no había nada)?
    if (hasFreshNullCache(childId)) {
      setHidden(true);
      return;
    }
    runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  function runFetch() {
    setError(null);
    startTransition(async () => {
      const result = await getNightCoachAction();
      if (result.ok) {
        setOutput(result.output);
        writeCache(childId, result.output);
      } else {
        if (result.reason === 'no_child' || result.reason === 'not_late_night') {
          // Estable: no tiene sentido reintentar pronto.
          writeNullCache(childId);
          setHidden(true);
        } else {
          setError(
            result.reason === 'session'
              ? 'Sesión expirada — refrescá la página.'
              : 'No pudimos leer la situación. Probá refrescar.',
          );
        }
      }
    });
  }

  function refresh() {
    clearCache(childId);
    runFetch();
  }

  if (hidden) return null;

  // Skeleton inicial mientras corre el primer fetch.
  if (!output && pending) {
    return (
      <Card className="flex flex-col gap-3 border-primary/25 bg-gradient-to-br from-primary/[0.05] to-card p-5">
        <header className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/15">
            <Sparkles className="size-3.5 animate-breathe" aria-hidden />
          </span>
          <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.18em]">
            Modo madrugada · IA
          </span>
        </header>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Leyendo la situación…
        </div>
      </Card>
    );
  }

  if (!output) {
    return (
      <Card className="flex flex-col gap-2 border-border/60 p-4">
        <p className="text-muted-foreground text-sm">{error ?? 'No pudimos leer la situación.'}</p>
        <div>
          <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={pending}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RotateCw className="size-3.5" aria-hidden />
            )}
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  const meta = DIAGNOSIS_META[output.diagnosis];
  const Icon = meta.Icon;

  return (
    <Card className="flex flex-col gap-4 border-primary/25 bg-gradient-to-br from-primary/[0.06] to-card p-5">
      <header className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/15">
          <Sparkles className="size-3.5 animate-breathe" aria-hidden />
        </span>
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.18em]">
          Modo madrugada · IA
        </span>
        <span className="ml-auto text-muted-foreground/70 text-[10px]">
          {CONFIDENCE_LABEL[output.confidence]}
        </span>
      </header>

      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15',
            meta.tone,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-display font-medium text-foreground text-base leading-tight tracking-tight">
            {output.headline}
          </p>
          <p className="text-foreground/90 text-sm leading-relaxed">{output.suggestion}</p>
        </div>
      </div>

      <p className="rounded-lg bg-muted/30 px-3 py-2 text-muted-foreground/90 text-xs italic leading-relaxed">
        {output.science}
      </p>

      {output.alarm && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="font-medium text-destructive text-sm leading-relaxed">{output.alarm}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/70">
        <span>Coach pediátrico — sugerencia, no diagnóstico médico.</span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={refresh}
          disabled={pending}
          className="shrink-0"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RotateCw className="size-3" aria-hidden />
          )}
          Refrescar
        </Button>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Cache helpers — localStorage por childId con TTL.
// ----------------------------------------------------------------------------

function readCache(childId: string): SleepCoachOutput | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry;
    if (entry.childId !== childId) return null;
    const ageMs = Date.now() - entry.fetchedAt;
    if (ageMs > CACHE_TTL_MIN * 60_000) return null;
    return entry.output;
  } catch {
    return null;
  }
}

function writeCache(childId: string, output: SleepCoachOutput): void {
  try {
    const entry: CachedEntry = { childId, fetchedAt: Date.now(), output };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* quota exceeded — silenciamos */
  }
}

function clearCache(childId: string): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const entry = JSON.parse(raw) as CachedEntry;
    if (entry.childId === childId) localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(NULL_CACHE_KEY);
  } catch {
    /* noop */
  }
}

function hasFreshNullCache(childId: string): boolean {
  try {
    const raw = localStorage.getItem(NULL_CACHE_KEY);
    if (!raw) return false;
    const entry = JSON.parse(raw) as { childId: string; cachedAt: number };
    if (entry.childId !== childId) return false;
    return Date.now() - entry.cachedAt < NULL_CACHE_TTL_MIN * 60_000;
  } catch {
    return false;
  }
}

function writeNullCache(childId: string): void {
  try {
    localStorage.setItem(NULL_CACHE_KEY, JSON.stringify({ childId, cachedAt: Date.now() }));
  } catch {
    /* noop */
  }
}
