'use client';

import { ageLabelAt, polaroidDateLabel } from '@/lib/carta/dates';
import type { LetterPhoto } from '@/lib/carta/manifest';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  createContext,
  useContext,
  useRef,
  useState,
} from 'react';

interface PhotoViewerValue {
  openPhoto: (src: string) => void;
  openAt: (index: number) => void;
}

const PhotoViewerContext = createContext<PhotoViewerValue | null>(null);

const SWIPE_PX = 50;

/**
 * Visor a pantalla completa. Recorre TODAS las fotos de la carta en orden
 * cronológico, sin importar desde qué capítulo se abrió: es el álbum de
 * los primeros meses, de punta a punta.
 */
export function PhotoViewerProvider({
  photos,
  birthAt,
  children,
}: {
  photos: LetterPhoto[];
  birthAt: string;
  children: ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const swipeStart = useRef<number | null>(null);
  // El portal va adentro de la carta (no a <body>) para heredar la letra
  // manuscrita, que se carga solo en esta página.
  const portalContainer = useRef<HTMLDivElement>(null);

  const go = (step: number) => {
    if (index === null) return;
    const next = index + step;
    if (next < 0 || next >= photos.length) return;
    setDirection(step);
    setIndex(next);
  };

  const value: PhotoViewerValue = {
    openPhoto: (src) => {
      const found = photos.findIndex((photo) => photo.src === src);
      if (found >= 0) setIndex(found);
    },
    openAt: (at) => setIndex(Math.min(Math.max(at, 0), photos.length - 1)),
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') go(1);
    if (event.key === 'ArrowLeft') go(-1);
  };
  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (swipeStart.current === null) return;
    const delta = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(delta) > SWIPE_PX) go(delta < 0 ? 1 : -1);
  };

  const photo = index === null ? null : photos[index];

  return (
    <PhotoViewerContext.Provider value={value}>
      {children}
      <div ref={portalContainer} />
      <Dialog.Root open={photo !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <Dialog.Portal container={portalContainer}>
          <Dialog.Backdrop className="fixed inset-0 z-[60] bg-carta-night/95 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup
            onKeyDown={onKeyDown}
            className="fixed inset-0 z-[61] flex flex-col text-carta-night-foreground outline-none transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0"
          >
            <Dialog.Title className="sr-only">Fotos de los primeros meses</Dialog.Title>
            <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
              <span className="font-display text-carta-night-foreground/60 text-sm tabular-nums">
                {index !== null && `${index + 1} / ${photos.length}`}
              </span>
              <Dialog.Close
                aria-label="Cerrar fotos"
                className="grid size-11 place-items-center rounded-full bg-carta-night-foreground/10 transition-colors hover:bg-carta-night-foreground/20"
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>

            <div
              className="relative flex flex-1 touch-pan-y items-center justify-center overflow-hidden px-3"
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
            >
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                {photo && (
                  <motion.img
                    key={photo.src}
                    src={photo.src}
                    alt={photo.alt}
                    width={photo.width}
                    height={photo.height}
                    draggable={false}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -60 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="max-h-[68dvh] w-auto max-w-full select-none rounded-sm object-contain shadow-2xl"
                  />
                )}
              </AnimatePresence>
            </div>

            {photo && (
              <div className="flex flex-col items-center gap-1 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center">
                <p className="font-display text-carta-glow text-sm italic">
                  {polaroidDateLabel(photo.takenAt)} · {ageLabelAt(birthAt, photo.takenAt)}
                </p>
                <p className="min-h-[2.25rem] font-hand text-[1.7rem] leading-tight">
                  {photo.caption ?? ''}
                </p>
                <div className="mt-2 flex gap-4">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    disabled={index === 0}
                    aria-label="Foto anterior"
                    className="grid size-12 place-items-center rounded-full bg-carta-night-foreground/10 transition-opacity disabled:opacity-30"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    disabled={index === photos.length - 1}
                    aria-label="Foto siguiente"
                    className="grid size-12 place-items-center rounded-full bg-carta-night-foreground/10 transition-opacity disabled:opacity-30"
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </PhotoViewerContext.Provider>
  );
}

export function usePhotoViewer(): PhotoViewerValue {
  const value = useContext(PhotoViewerContext);
  if (!value) throw new Error('usePhotoViewer necesita un <PhotoViewerProvider>.');
  return value;
}
