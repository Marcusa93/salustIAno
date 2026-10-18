'use client';

import type { LetterChapter, LetterSong } from '@/lib/carta/manifest';
import { FINALE } from '@/lib/carta/progress';
import { cn } from '@/lib/utils';
import { ChevronDown, Music2, Volume2, VolumeX, X } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { useSoundtrack } from './soundtrack-provider';

/**
 * Salida a la app. En la app instalada (PWA) no hay botón "atrás" del
 * navegador: sin esto, una vez adentro de la carta no había cómo volver.
 */
export function ExitLetterLink({ tone = 'paper' }: { tone?: 'paper' | 'night' }) {
  return (
    <Link
      href="/home"
      aria-label="Salir de la carta y volver a Salu"
      className={cn(
        'fixed top-[calc(env(safe-area-inset-top)+0.6rem)] left-4 z-50 grid size-10 place-items-center rounded-full shadow-sm ring-1 backdrop-blur-md transition-transform active:scale-95',
        tone === 'paper'
          ? 'bg-carta-paper/80 text-carta-ink ring-carta-ink/10'
          : 'bg-carta-night-foreground/10 text-carta-night-foreground ring-carta-night-foreground/15',
      )}
    >
      <X className="size-5" aria-hidden />
    </Link>
  );
}

const SONG_CHIP_MS = 4500;

/**
 * Barra fija arriba: progreso, en qué momento de la vida de Salu estamos
 * (tocándolo se abre el índice de meses) y qué canción empezó a sonar.
 */
export function ChapterRail({
  chapters,
  current,
  nowPlaying,
  onJump,
}: {
  chapters: Pick<LetterChapter, 'id' | 'label' | 'title'>[];
  current: LetterChapter | null;
  nowPlaying: LetterSong | null;
  onJump: (id: string) => void;
}) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const [indexOpen, setIndexOpen] = useState(false);
  const [songVisible, setSongVisible] = useState(false);
  const indexId = useId();

  // El cartelito de la canción aparece un rato cada vez que cambia.
  const songId = nowPlaying?.id;
  useEffect(() => {
    if (!songId) return;
    setSongVisible(true);
    const timer = window.setTimeout(() => setSongVisible(false), SONG_CHIP_MS);
    return () => window.clearTimeout(timer);
  }, [songId]);

  useEffect(() => {
    if (!indexOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIndexOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [indexOpen]);

  const jump = (id: string) => {
    setIndexOpen(false);
    onJump(id);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
        <motion.div
          aria-hidden
          className="h-[3px] origin-left bg-carta-glow"
          style={{ scaleX: progress }}
        />
        <div className="flex flex-col items-center gap-2 px-16 pt-3">
          <AnimatePresence mode="wait">
            {current && (
              <motion.button
                key={current.id}
                type="button"
                onClick={() => setIndexOpen((open) => !open)}
                aria-expanded={indexOpen}
                aria-controls={indexId}
                aria-label={`${current.label}, ${current.title}. Ver los meses`}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-carta-paper/80 px-4 py-1.5 font-display text-carta-ink text-sm shadow-[0_4px_14px_-8px_var(--carta-shadow)] backdrop-blur-md"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <span className="text-carta-ink-soft">{current.label}</span>
                <span aria-hidden className="text-carta-ink-soft/60">
                  ·
                </span>
                <span className="italic">{current.title}</span>
                <ChevronDown
                  aria-hidden
                  className={cn('size-3.5 transition-transform', indexOpen && 'rotate-180')}
                />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {songVisible && nowPlaying && !indexOpen && (
              <motion.p
                key={nowPlaying.id}
                className="flex items-center gap-1.5 rounded-full bg-carta-night/75 px-3 py-1 text-carta-night-foreground text-xs backdrop-blur-md"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
              >
                <Music2 className="size-3.5 text-carta-glow" aria-hidden />
                <span className="font-medium">{nowPlaying.title}</span>
                {nowPlaying.artist && <span className="opacity-70">· {nowPlaying.artist}</span>}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {indexOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar los meses"
              onClick={() => setIndexOpen(false)}
              className="fixed inset-0 z-40 bg-carta-night/20 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.nav
              id={indexId}
              aria-label="Meses de la carta"
              className="fixed inset-x-6 top-[calc(env(safe-area-inset-top)+3.75rem)] z-50 mx-auto max-w-sm overflow-hidden rounded-3xl bg-carta-paper shadow-[0_24px_48px_-20px_var(--carta-shadow)] ring-1 ring-carta-ink/10"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.25 }}
            >
              <ol className="max-h-[65dvh] overflow-y-auto py-2">
                {chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => jump(chapter.id)}
                      aria-current={current?.id === chapter.id ? 'location' : undefined}
                      className={cn(
                        'flex w-full items-baseline gap-3 px-5 py-2.5 text-left transition-colors hover:bg-carta-paper-edge/60',
                        current?.id === chapter.id && 'bg-carta-paper-edge/70',
                      )}
                    >
                      <span className="w-24 shrink-0 font-sans text-[0.7rem] text-carta-ink-soft uppercase tracking-[0.2em]">
                        {chapter.label}
                      </span>
                      <span className="font-display text-carta-ink italic">{chapter.title}</span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => jump(FINALE)}
                    className="flex w-full items-baseline gap-3 px-5 py-2.5 text-left transition-colors hover:bg-carta-paper-edge/60"
                  >
                    <span className="w-24 shrink-0 font-sans text-[0.7rem] text-carta-ink-soft uppercase tracking-[0.2em]">
                      Para vos
                    </span>
                    <span className="font-display text-carta-ink italic">El final</span>
                  </button>
                </li>
              </ol>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
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
