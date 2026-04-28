'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Copy, Download, RefreshCw, Sparkles } from 'lucide-react';
import { forwardRef } from 'react';
import { toast } from 'sonner';
import type { StoryMeta, StoryOutput } from './shared';

interface StoryResultProps {
  story: StoryOutput;
  meta: StoryMeta;
  onRegenerate(): void;
  onNew(): void;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Vista del cuento generado. forwardRef permite que el form le pase un ref
 * y haga focus al título cuando llega un resultado nuevo.
 *
 * TODO(generated_stories): cuando exista la tabla `generated_stories` y su
 * RLS asociada, sumar acción "Guardar en biblioteca" en el toolbar.
 */
export const StoryResult = forwardRef<HTMLHeadingElement, StoryResultProps>(function StoryResult(
  { story, meta, onRegenerate, onNew },
  ref,
) {
  const words = wordCount(story.story);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${story.title}\n\n${story.story}`);
      toast.success('Cuento copiado.');
    } catch {
      toast.error('No pudimos copiar. Probá seleccionar el texto a mano.');
    }
  }

  function handleDownload() {
    const text = `${story.title}\n\n${story.story}\n\n— ${story.moralOrTheme}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeName = story.title
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ\s-]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName || 'cuento'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Descargando.');
  }

  return (
    <Card
      className={cn('flex flex-col gap-6 p-6 sm:p-8', 'shadow-sm transition-shadow hover:shadow')}
    >
      <header className="flex flex-col gap-3">
        <h2
          ref={ref}
          tabIndex={-1}
          className="font-display text-2xl text-foreground tracking-tight sm:text-3xl"
        >
          {story.title}
        </h2>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
            {story.moralOrTheme}
          </span>
          {story.charactersUsed.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-muted-foreground text-xs"
            >
              {c}
            </span>
          ))}
        </div>
      </header>

      <article className="prose prose-neutral max-w-prose font-serif text-base text-foreground leading-[1.75] sm:text-lg">
        {story.story.split(/\n\s*\n/).map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="mb-4 last:mb-0">
            {paragraph}
          </p>
        ))}
      </article>

      <footer className="flex flex-col gap-4 border-border border-t pt-4">
        <p className="text-muted-foreground text-xs">
          Generado con {meta.model} · {words} palabras · {formatLatency(meta.latencyMs)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCopy} variant="default" size="sm">
            <Copy className="size-4" aria-hidden />
            Copiar
          </Button>
          <Button onClick={handleDownload} variant="default" size="sm">
            <Download className="size-4" aria-hidden />
            Descargar
          </Button>
          <Button onClick={onRegenerate} variant="ghost" size="sm">
            <RefreshCw className="size-4" aria-hidden />
            Regenerar
          </Button>
          <Button onClick={onNew} variant="ghost" size="sm">
            <Sparkles className="size-4" aria-hidden />
            Empezar de nuevo
          </Button>
        </div>
      </footer>
    </Card>
  );
});
