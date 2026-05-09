'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface SharedPhoto {
  id: string;
  signedUrl: string | null;
  caption: string | null;
  takenAt: string | null;
}

interface SharedAlbumGalleryProps {
  photos: ReadonlyArray<SharedPhoto>;
}

/**
 * Galería del álbum público — grid de thumbnails que abre un lightbox
 * full-screen al click en lugar de "abrir foto en nueva pestaña".
 *
 * Por qué importa: esta página la abren los abuelos / familia extendida
 * en WhatsApp Web o iPhone. Un "abrir en nueva tab" en mobile resulta
 * en una imagen pelada sobre fondo blanco con barra de URL — feo. El
 * lightbox les permite ver foto por foto sin perder contexto, y
 * navegar con flechas o swipe.
 *
 * Sin libs externas — state + Tailwind. Cierre por click backdrop, Esc,
 * o el botón X. Navegación con flechas del teclado y botones laterales.
 */
export function SharedAlbumGallery({ photos }: SharedAlbumGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);
  const next = useCallback(() => {
    setActiveIndex((i) => {
      if (i === null) return null;
      return Math.min(i + 1, photos.length - 1);
    });
  }, [photos.length]);
  const prev = useCallback(() => {
    setActiveIndex((i) => {
      if (i === null) return null;
      return Math.max(i - 1, 0);
    });
  }, []);

  // Atajos de teclado: Esc cierra, ←/→ navegan.
  useEffect(() => {
    if (activeIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, close, next, prev]);

  // Lock scroll del body cuando el lightbox está abierto.
  useEffect(() => {
    if (activeIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIndex]);

  const active = activeIndex !== null ? photos[activeIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((p, idx) => (
          <Thumbnail key={p.id} photo={p} onClick={() => setActiveIndex(idx)} />
        ))}
      </div>

      {active?.signedUrl && (
        <Lightbox
          photo={active}
          hasPrev={activeIndex !== null && activeIndex > 0}
          hasNext={activeIndex !== null && activeIndex < photos.length - 1}
          position={(activeIndex ?? 0) + 1}
          total={photos.length}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}

function Thumbnail({ photo, onClick }: { photo: SharedPhoto; onClick: () => void }) {
  const [errored, setErrored] = useState(false);

  if (!photo.signedUrl || errored) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-muted/40 text-muted-foreground/40">
        <ImageIcon className="size-6" aria-hidden />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={photo.caption ? `Ver foto: ${photo.caption}` : 'Ver foto'}
      className="group relative aspect-square overflow-hidden rounded-xl bg-muted/40 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <img
        src={photo.signedUrl}
        alt={photo.caption ?? 'Foto'}
        loading="lazy"
        onError={() => setErrored(true)}
        className="size-full object-cover transition-transform group-hover:scale-105"
      />
      {photo.caption && (
        <span className="absolute right-0 bottom-0 left-0 truncate bg-gradient-to-t from-foreground/70 to-transparent p-2 text-left font-medium text-[11px] text-white">
          {photo.caption}
        </span>
      )}
    </button>
  );
}

interface LightboxProps {
  photo: SharedPhoto;
  hasPrev: boolean;
  hasNext: boolean;
  position: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function Lightbox({
  photo,
  hasPrev,
  hasNext,
  position,
  total,
  onClose,
  onPrev,
  onNext,
}: LightboxProps) {
  if (!photo.signedUrl) return null;

  const dateLabel = photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    : null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none flex-col border-none bg-black/95 p-0 text-white backdrop-blur-sm"
      aria-modal="true"
      aria-label={photo.caption ?? 'Foto del álbum'}
    >
      {/* Header con contador + close. */}
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 text-white">
        <span className="font-medium text-xs/none tabular-nums opacity-80">
          {position} / {total}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="-m-2 inline-flex size-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* Foto centrada — toda la altura disponible. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        <img
          src={photo.signedUrl}
          alt={photo.caption ?? 'Foto'}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />

        {/* Navegación lateral (visible en sm+) */}
        {hasPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Foto anterior"
            className="absolute top-1/2 left-2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 sm:inline-flex"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Foto siguiente"
            className="absolute top-1/2 right-2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 sm:inline-flex"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        )}
      </div>

      {/* Footer con caption + fecha. */}
      <div className="flex flex-col gap-1 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-white">
        {photo.caption && <p className="text-sm leading-snug opacity-90">{photo.caption}</p>}
        {dateLabel && <p className="text-[11px] opacity-60">{dateLabel}</p>}

        {/* Navegación mobile: botones grandes en la parte inferior. */}
        <div className="mt-2 flex items-center justify-center gap-3 sm:hidden">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Foto anterior"
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all',
              hasPrev ? 'hover:bg-white/20' : 'opacity-30',
            )}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Foto siguiente"
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all',
              hasNext ? 'hover:bg-white/20' : 'opacity-30',
            )}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </dialog>
  );
}
