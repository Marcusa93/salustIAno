'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MOOD_LABELS } from '@/lib/ai/agents/lullaby-schema';
import { cn } from '@/lib/utils';
import { Link2, Loader2, Music, Pause, Play, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type LullabyLibraryEntry,
  deleteLullabyAction,
  getLullabyAudioUrlAction,
  shareLullabyAction,
} from './actions';

const MOODS = ['dulce', 'jugueton', 'calmo', 'valiente'] as const;

interface LullabyLibraryProps {
  entries: LullabyLibraryEntry[];
}

/**
 * Biblioteca de canciones generadas. Listadas todas y agrupadas por mood.
 * Cada item es un player con:
 *   - Click en Play → fetch signed URL → carga audio → reproduce
 *   - Solo una canción a la vez (la nueva pausa la anterior)
 *   - Letra colapsada (click para expandir)
 *   - Botón borrar con soft-delete
 */
export function LullabyLibrary({ entries }: LullabyLibraryProps) {
  const [items, setItems] = useState(entries);
  const [filter, setFilter] = useState<'all' | (typeof MOODS)[number]>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const filtered = filter === 'all' ? items : items.filter((e) => e.mood === filter);
  const moodCounts = MOODS.reduce<Record<string, number>>((acc, m) => {
    acc[m] = items.filter((e) => e.mood === m).length;
    return acc;
  }, {});

  function handleDelete(id: string) {
    if (!window.confirm('¿Borrar esta canción de la biblioteca?')) return;
    setItems((prev) => prev.filter((e) => e.id !== id));
    if (playingId === id) setPlayingId(null);
    void deleteLullabyAction(id).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }

  if (entries.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Music className="size-7" aria-hidden />
        </div>
        <p className="max-w-sm text-muted-foreground leading-relaxed">
          Todavía no hay canciones guardadas. Generá la primera nana acá arriba — queda guardada
          para que la escuchen cuando quieran sin volver a generarla.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro por mood */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === 'all'}
          label={`Todas · ${items.length}`}
          onClick={() => setFilter('all')}
        />
        {MOODS.map((m) =>
          (moodCounts[m] ?? 0) > 0 ? (
            <FilterChip
              key={m}
              active={filter === m}
              label={`${MOOD_LABELS[m]} · ${moodCounts[m]}`}
              onClick={() => setFilter(m)}
            />
          ) : null,
        )}
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-3">
        {filtered.map((entry) => (
          <LullabyItem
            key={entry.id}
            entry={entry}
            isPlaying={playingId === entry.id}
            onPlayChange={(playing) => setPlayingId(playing ? entry.id : null)}
            onDelete={() => handleDelete(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1.5 font-medium text-sm transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function LullabyItem({
  entry,
  isPlaying,
  onPlayChange,
  onDelete,
}: {
  entry: LullabyLibraryEntry;
  isPlaying: boolean;
  onPlayChange: (playing: boolean) => void;
  onDelete: () => void;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Si otra canción se reproduce, pausamos la nuestra.
  useEffect(() => {
    if (!isPlaying && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  function handlePlay() {
    if (!entry.audioPath) {
      toast.error('Esta canción no tiene audio guardado.');
      return;
    }
    if (audioUrl) {
      audioRef.current?.play();
      onPlayChange(true);
      return;
    }
    startLoad(async () => {
      const result = await getLullabyAudioUrlAction(entry.audioPath ?? '');
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAudioUrl(result.url);
      onPlayChange(true);
      // El <audio> arranca cuando el src cambia y autoplay attr está activo.
    });
  }

  function handlePause() {
    audioRef.current?.pause();
    onPlayChange(false);
  }

  return (
    <Card
      className={cn(
        'flex flex-col gap-3 border-border/60 p-4 transition-colors',
        isPlaying && 'border-primary/30 bg-primary/[0.03]',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={isPlaying ? handlePause : handlePlay}
          disabled={loading || !entry.audioPath}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:opacity-40"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : isPlaying ? (
            <Pause className="size-5" aria-hidden />
          ) : (
            <Play className="size-5" aria-hidden />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-left">
            <span className="block font-medium text-foreground text-sm leading-snug">
              {entry.title}
            </span>
            <span className="block text-muted-foreground text-xs">
              {MOOD_LABELS[entry.mood]} · {formatRelative(entry.createdAt)}
            </span>
          </button>
        </div>
        <ShareButton id={entry.id} />
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={onDelete}
          aria-label="Borrar canción"
        >
          <Trash2 className="size-3" aria-hidden />
        </Button>
      </div>

      {audioUrl && (
        // biome-ignore lint/a11y/useMediaCaption: nana cantada — letra abajo.
        <audio
          ref={audioRef}
          src={audioUrl}
          autoPlay
          onPlay={() => onPlayChange(true)}
          onPause={() => onPlayChange(false)}
          onEnded={() => onPlayChange(false)}
          controls
          className="w-full rounded-lg"
        >
          <track kind="captions" />
        </audio>
      )}

      {expanded && (
        <div className="flex flex-col gap-3 border-border/40 border-t pt-3 font-display text-foreground text-sm leading-relaxed">
          <p className="text-muted-foreground italic">{entry.intro}</p>
          {entry.verses.map((v, i) => (
            <div key={`v-${i}-${v.slice(0, 10)}`} className="whitespace-pre-line">
              {v}
            </div>
          ))}
          {entry.chorus && (
            <div className="whitespace-pre-line border-primary/20 border-l-2 pl-3 text-primary/90">
              {entry.chorus}
            </div>
          )}
          {entry.closing && (
            <div className="whitespace-pre-line text-muted-foreground">{entry.closing}</div>
          )}
        </div>
      )}
    </Card>
  );
}

function ShareButton({ id }: { id: string }) {
  const [pending, startShare] = useTransition();
  function handleShare() {
    startShare(async () => {
      const result = await shareLullabyAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const fullUrl = `${window.location.origin}${result.url}`;
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast.success('Link copiado. Compartilo con quien quieras.');
      } catch {
        toast.success(`Link generado: ${fullUrl}`);
      }
    });
  }
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      onClick={handleShare}
      disabled={pending}
      aria-label="Compartir canción"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <Link2 className="size-3" aria-hidden />
      )}
    </Button>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.round(days / 7)} sem`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
