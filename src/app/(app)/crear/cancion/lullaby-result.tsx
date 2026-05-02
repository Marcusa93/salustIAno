'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type LullabyOutput, MOOD_LABELS } from '@/lib/ai/agents/lullaby-schema';
import { Copy, Loader2, Music, RotateCcw, Sparkles } from 'lucide-react';
import { type Ref, forwardRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { generateLullabyAudioAction } from './actions';
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPending, startAudio] = useTransition();

  function copyAsText() {
    navigator.clipboard.writeText(lullabyAsPlainText(lullaby)).then(
      () => toast.success('Copiado al portapapeles.'),
      () => toast.error('No pudimos copiar. Intentá manualmente.'),
    );
  }

  function generateAudio() {
    setAudioUrl(null);
    startAudio(async () => {
      const result = await generateLullabyAudioAction(lullaby);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setAudioUrl(result.audioUrl);
      toast.success('Canción lista.');
    });
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
            <span className="mb-1 block font-medium font-sans text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              Estribillo
            </span>
            <div className="whitespace-pre-line text-primary/90">{lullaby.chorus}</div>
          </div>
        )}

        {lullaby.closing && (
          <div className="whitespace-pre-line text-muted-foreground">{lullaby.closing}</div>
        )}
      </div>

      {/* Audio block — generación bajo demanda (~50-60s, ~$0.05). */}
      <div className="flex flex-col gap-3 border-border/60 border-t pt-5">
        {audioUrl ? (
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
              Canción
            </span>
            {/* biome-ignore lint/a11y/useMediaCaption: nana cantada — el texto está arriba como "letra". */}
            <audio src={audioUrl} controls preload="none" className="w-full rounded-lg">
              <track kind="captions" />
            </audio>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={generateAudio}
                disabled={audioPending}
              >
                <RotateCcw className="size-4" aria-hidden />
                Generar otra versión cantada
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                render={
                  // biome-ignore lint/a11y/useAnchorContent: el contenido va inyectado por Button.render.
                  <a
                    href={audioUrl}
                    download={`${lullaby.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.mp3`}
                    aria-label="Descargar canción en MP3"
                  />
                }
              >
                <Music className="size-4" aria-hidden />
                Descargar MP3
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={generateAudio}
            disabled={audioPending}
            className="self-stretch sm:self-start"
          >
            {audioPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Cantando la nana… (≈60s)
              </>
            ) : (
              <>
                <Music className="size-4" aria-hidden />
                Convertir a canción cantada
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-border/60 border-t pt-5">
        <Button type="button" size="sm" variant="outline" onClick={copyAsText}>
          <Copy className="size-4" aria-hidden />
          Copiar letra
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRegenerate}>
          <RotateCcw className="size-4" aria-hidden />
          Generar otra letra
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
