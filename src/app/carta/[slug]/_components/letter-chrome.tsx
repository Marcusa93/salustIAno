'use client';

import type { LetterChapter } from '@/lib/carta/manifest';
import { Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { useSoundtrack } from './soundtrack-provider';

/** Barra fija arriba: en qué momento de la vida de Salu estamos. */
export function ChapterRail({ chapter }: { chapter: LetterChapter | null }) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
      <motion.div
        aria-hidden
        className="h-[3px] origin-left bg-carta-glow"
        style={{ scaleX: progress }}
      />
      <div className="flex justify-center pt-3">
        <AnimatePresence mode="wait">
          {chapter && (
            <motion.p
              key={chapter.id}
              className="rounded-full bg-carta-paper/80 px-4 py-1.5 font-display text-carta-ink text-sm shadow-[0_4px_14px_-8px_var(--carta-shadow)] backdrop-blur-md"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <span className="text-carta-ink-soft">{chapter.label}</span>
              <span aria-hidden className="mx-2 text-carta-ink-soft/60">
                ·
              </span>
              <span className="italic">{chapter.title}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function SoundToggle() {
  const { muted, setMuted } = useSoundtrack();
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? 'Activar la música' : 'Silenciar la música'}
      aria-pressed={muted}
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 grid size-11 place-items-center rounded-full bg-carta-night/80 text-carta-night-foreground shadow-lg ring-1 ring-carta-night-foreground/20 backdrop-blur-md transition-transform active:scale-95"
    >
      {muted ? (
        <VolumeX className="size-5" aria-hidden />
      ) : (
        <Volume2 className="size-5" aria-hidden />
      )}
    </button>
  );
}
