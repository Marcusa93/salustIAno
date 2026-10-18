'use client';

import type { Letter } from '@/lib/carta/manifest';
import { easeWarm } from '@/lib/motion';
import { BookOpen, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { NightSky } from './atmosphere';
import { ExitLetterLink } from './letter-chrome';
import { useSoundtrack } from './soundtrack-provider';

const OPEN_ANIMATION_MS = 1500;

/**
 * Escena 1: el sobre cerrado. El tap que lo abre también desbloquea el
 * audio. Si ya la había empezado a leer, ofrece seguir donde quedó (ese
 * tap también desbloquea el audio y saltea el sobre y el latido).
 */
export function Envelope({
  envelope,
  resumeLabel,
  onOpened,
  onResume,
}: {
  envelope: Letter['envelope'];
  /** "Agosto", "el final"… o `null` si no hay dónde seguir. */
  resumeLabel: string | null;
  onOpened: () => void;
  onResume: () => void;
}) {
  const { soundtrack } = useSoundtrack();
  const [opening, setOpening] = useState(false);

  const open = () => {
    if (opening) return;
    soundtrack.unlock();
    setOpening(true);
    window.setTimeout(onOpened, OPEN_ANIMATION_MS);
  };

  const resume = () => {
    if (opening) return;
    soundtrack.unlock();
    onResume();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-carta-night px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-carta-night-foreground"
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <NightSky />
      <ExitLetterLink tone="night" />

      <motion.p
        className="relative mb-12 font-display text-carta-night-foreground/70 text-sm uppercase tracking-[0.35em]"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: opening ? 0 : 1, y: 0 }}
        transition={{ duration: 1.2, ease: easeWarm }}
      >
        Llegó una carta
      </motion.p>

      <motion.button
        type="button"
        onClick={open}
        aria-label={`Abrir la carta. ${envelope.to}, ${envelope.from}`}
        className="relative aspect-[1.45] w-full max-w-[22rem] cursor-pointer rounded-md outline-none [perspective:1100px] focus-visible:ring-4 focus-visible:ring-carta-glow/60"
        initial={{ opacity: 0, y: 30, rotate: -4 }}
        animate={
          opening
            ? { y: 40, rotate: 0, scale: 0.94, transition: { delay: 0.9, duration: 0.6 } }
            : { opacity: 1, y: [0, -6, 0], rotate: -2.5 }
        }
        transition={
          opening
            ? undefined
            : {
                y: { duration: 5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
                opacity: { duration: 1 },
                rotate: { duration: 1.2 },
              }
        }
      >
        {/* La carta adentro: asoma cuando se abre la solapa. */}
        <motion.span
          aria-hidden
          className="absolute inset-x-4 top-3 bottom-6 rounded-sm bg-carta-polaroid shadow-sm"
          animate={opening ? { y: '-62%', opacity: 1 } : { y: 0, opacity: 0 }}
          transition={{ delay: 0.55, duration: 0.9, ease: easeWarm }}
        >
          <span className="block px-5 pt-4 text-left font-hand text-2xl text-carta-ink/70">
            Mamá:
          </span>
        </motion.span>

        {/* Cuerpo del sobre: dos solapas laterales y la de abajo. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-md bg-carta-paper shadow-[0_30px_60px_-20px_var(--carta-shadow)] [clip-path:polygon(0_0,50%_42%,100%_0,100%_100%,0_100%)]"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-md bg-carta-paper-edge/60 [clip-path:polygon(0_0,50%_50%,0_100%)]"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-md bg-carta-paper-edge/40 [clip-path:polygon(100%_0,50%_50%,100%_100%)]"
        />

        <span className="absolute inset-x-0 bottom-[6%] flex flex-col items-center">
          <span className="font-hand text-[2.1rem] text-carta-ink leading-tight">
            {envelope.to}
          </span>
          <span className="font-hand text-carta-ink-soft text-xl">{envelope.from}</span>
        </span>

        <span className="absolute top-3 right-3 z-20 rotate-6 border-2 border-carta-seal/50 border-dashed px-2 py-1 font-display text-[0.65rem] text-carta-seal tracking-widest">
          {envelope.stamp}
        </span>

        {/* Solapa de arriba: se da vuelta hacia atrás al abrir. */}
        <motion.span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[46%] origin-top [transform-style:preserve-3d]"
          animate={{ rotateX: opening ? 178 : 0 }}
          transition={{ duration: 0.75, ease: easeWarm }}
        >
          <span className="absolute inset-0 rounded-t-md bg-carta-paper-edge shadow-sm [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        </motion.span>

        {/* Lacre */}
        <motion.span
          aria-hidden
          className="-translate-x-1/2 -translate-y-1/2 absolute top-[46%] left-1/2 z-10 grid size-16 place-items-center rounded-full bg-carta-seal font-display text-2xl text-carta-paper italic shadow-[0_6px_14px_-4px_var(--carta-shadow)] ring-4 ring-carta-seal/40"
          animate={opening ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          S
        </motion.span>
      </motion.button>

      <motion.div
        className="relative mt-14 flex flex-col items-center gap-3 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: opening ? 0 : 1 }}
        transition={{ delay: opening ? 0 : 1.2, duration: 0.8 }}
      >
        {resumeLabel ? (
          <>
            <button
              type="button"
              onClick={resume}
              className="flex items-center gap-2 rounded-full bg-carta-glow px-6 py-3.5 font-medium text-base text-carta-night shadow-[0_10px_30px_-10px_var(--carta-glow)] transition-transform active:scale-95"
            >
              <BookOpen className="size-5" aria-hidden />
              Seguir donde estabas
            </button>
            <span className="max-w-xs text-balance font-hand text-carta-night-foreground/80 text-xl">
              Ibas por {resumeLabel}. O tocá el sobre para empezar de nuevo.
            </span>
          </>
        ) : (
          <span className="font-hand text-3xl text-carta-glow">Tocá para abrir</span>
        )}
        <span className="flex items-center gap-2 text-carta-night-foreground/70 text-sm">
          <Volume2 className="size-4" aria-hidden />
          {envelope.hint}
        </span>
      </motion.div>
    </motion.div>
  );
}
