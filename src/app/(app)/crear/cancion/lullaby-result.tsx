'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type LullabyOutput, MOOD_LABELS } from '@/lib/ai/agents/lullaby-schema';
import { Copy, RotateCcw, Sparkles } from 'lucide-react';
import { type Ref, forwardRef } from 'react';
import { toast } from 'sonner';
import type { LullabyMeta } from './shared';

interface LullabyResultProps {
  lullaby: LullabyOutput;
  meta: LullabyMeta;
  onRegenerate: () => void;
  onNew: () => void;
}

/**
 * Renderiza la canción con verses + chorus + closing en estructura
 * tipográfica de letra. Botones para copiar al portapapeles, regenerar
 * o crear otra.
 */
export const LullabyResult = forwardRef(function LullabyResult(
  { lullaby, meta, onRegenerate, onNew }: LullabyResultProps,
  ref: Ref<HTMLHeadingElement>,
) {
  function copyAsText() {
    navigator.clipboard.writeText(lullabyAsPlainText(lullaby)).then(
      () => toast.success('Copiado al portapapeles.'),
      () => toast.error('No pudimos copiar. Intentá manualmente.'),
    );
  }

  return (
    <Card className="flex flex-col gap-6 border-primary/15 bg-gradient-to-br from-primary/[0.04] via-card to-accent/20 p-6 sm:p-8">
      <header className="flex flex-col gap-2">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          {MOOD_LABELS[lullaby.mood]}
        </span>
        <h2
          ref={ref}
          tabIndex={-1}
          className="font-display text-3xl text-foreground leading-tight tracking-tight outline-none sm:text-4xl"
        >
          {lullaby.title}
        </h2>
        <p className="text-muted-foreground text-sm italic leading-relaxed">{lullaby.intro}</p>
      </header>

      <div className="flex flex-col gap-5 font-display text-foreground text-lg leading-[1.9] sm:text-xl">
        {lullaby.verses.map((verse, i) => (
          <div key={`v-${i}-${verse.slice(0, 12)}`} className="whitespace-pre-line">
            {verse}
          </div>
        ))}

        {lullaby.chorus && (
          <div className="border-primary/20 border-l-2 pl-4">
            <span className="block font-sans font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
              Estribillo
            </span>
            <div className="whitespace-pre-line text-primary/90">{lullaby.chorus}</div>
          </div>
        )}

        {lullaby.closing && (
          <div className="whitespace-pre-line text-muted-foreground">{lullaby.closing}</div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-border/60 border-t pt-5">
        <Button type="button" size="sm" variant="outline" onClick={copyAsText}>
          <Copy className="size-4" aria-hidden />
          Copiar letra
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRegenerate}>
          <RotateCcw className="size-4" aria-hidden />
          Generar otra versión
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onNew}>
          <Sparkles className="size-4" aria-hidden />
          Empezar de nuevo
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Modelo {meta.model.split('/').at(-1) ?? meta.model} · {meta.tokens} tokens ·{' '}
        {Math.round(meta.latencyMs / 100) / 10}s
      </p>
    </Card>
  );
});

/**
 * Convierte la canción a texto plano para copy-paste. Sin markdown,
 * compatible con WhatsApp / mail / impresión.
 */
export function lullabyAsPlainText(l: LullabyOutput): string {
  const parts: string[] = [l.title.toUpperCase(), '', l.intro, ''];
  l.verses.forEach((v, i) => {
    parts.push(v);
    if (i < l.verses.length - 1) parts.push('');
  });
  if (l.chorus) {
    parts.push('', '— Estribillo —', l.chorus);
  }
  if (l.closing) {
    parts.push('', l.closing);
  }
  parts.push('', '— Generada por SalustIA para Salu —');
  return parts.join('\n');
}
