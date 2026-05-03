'use client';

import { Card } from '@/components/ui/card';
import { Music } from 'lucide-react';

export function SharedLullabyPlayer({ audioUrl }: { audioUrl: string | null }) {
  if (!audioUrl) {
    return (
      <Card className="flex items-center gap-3 border-muted-foreground/20 bg-muted/30 p-4 text-muted-foreground text-sm">
        <Music className="size-4 shrink-0" aria-hidden />
        Esta canción no tiene audio cantado guardado — podés leer la letra abajo.
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3 border-primary/20 bg-primary/[0.04] p-4">
      <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
        Reproducir
      </span>
      {/* biome-ignore lint/a11y/useMediaCaption: nana cantada — letra abajo. */}
      <audio src={audioUrl} controls preload="none" className="w-full rounded-lg">
        <track kind="captions" />
      </audio>
    </Card>
  );
}
