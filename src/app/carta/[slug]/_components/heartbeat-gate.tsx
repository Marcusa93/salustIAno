'use client';

import type { HeartbeatSynth } from '@/lib/carta/heartbeat-synth';
import type { Letter } from '@/lib/carta/manifest';
import { easeWarm } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Fingerprint } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { NightSky } from './atmosphere';
import { useSoundtrack } from './soundtrack-provider';
import { useHold } from './use-hold';

// Latido fetal típico de una ecografía: ~140 por minuto.
const FETAL_BPM = 140;
const HOLD_MS = 3800;
const AFTER_MS = 4200;
const FALLBACK_AFTER_MS = 12_000;

/**
 * Escena 2: "Antes de verme, ya me escuchabas". Mientras mamá sostiene el
 * dedo, suena el latido de la ecografía; al completarse, el latido se
 * funde con la primera canción.
 */
export function HeartbeatGate({
  copy,
  firstSongId,
  onDone,
}: {
  copy: Letter['heartbeat'];
  firstSongId: string | undefined;
  onDone: () => void;
}) {
  const { soundtrack } = useSoundtrack();
  const synth = useRef<HeartbeatSynth | null>(null);
  const [heard, setHeard] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const heartbeat = () => {
    synth.current ??= soundtrack.heartbeat(() => navigator.vibrate?.(28));
    return synth.current;
  };

  const finish = () => {
    if (heard) return;
    setHeard(true);
    heartbeat().stop(3);
    if (firstSongId) soundtrack.play(firstSongId);
    window.setTimeout(onDone, AFTER_MS);
  };

  const hold = useHold({
    durationMs: HOLD_MS,
    onStart: () => heartbeat().start(FETAL_BPM),
    onCancel: () => heartbeat().stop(),
    onComplete: finish,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setShowFallback(true), FALLBACK_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      synth.current?.stop(0.2);
    };
  }, []);

  const beatStyle = { '--beat': `${60 / FETAL_BPM}s` } as CSSProperties;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-carta-night px-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center text-carta-night-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.2 } }}
      transition={{ duration: 1 }}
    >
      <NightSky />

      <div className="relative flex min-h-[7rem] items-end">
        <AnimatePresence mode="wait">
          <motion.p
            key={heard ? 'after' : 'prompt'}
            className="max-w-xs font-display text-[1.75rem] italic leading-snug"
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 1.1, ease: easeWarm }}
          >
            {heard ? copy.after : copy.prompt}
          </motion.p>
        </AnimatePresence>
      </div>

      <motion.button
        type="button"
        {...hold.handlers}
        aria-label={`${copy.instruction} Mantené apretado.`}
        className="relative mt-16 grid size-48 touch-none select-none place-items-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] focus-visible:ring-4 focus-visible:ring-carta-glow/50"
        animate={heard ? { scale: 1.4, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={{ duration: heard ? 2.4 : 0.6, ease: easeWarm }}
        disabled={heard}
      >
        <span
          aria-hidden
          style={beatStyle}
          className={cn(
            'absolute inset-0 rounded-full bg-carta-glow/15 blur-md transition-opacity duration-500',
            hold.holding ? 'animate-carta-beat opacity-100' : 'animate-breathe opacity-60',
          )}
        />
        <span
          aria-hidden
          style={beatStyle}
          className={cn(
            'absolute inset-6 rounded-full border border-carta-glow/30 bg-carta-night',
            hold.holding && 'animate-carta-beat',
          )}
        />
        <svg aria-hidden viewBox="0 0 100 100" className="-rotate-90 absolute inset-0 size-full">
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            className="stroke-carta-glow/15"
            strokeWidth="1.5"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            className="stroke-carta-glow"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ pathLength: hold.progress }}
          />
        </svg>
        <Fingerprint
          aria-hidden
          strokeWidth={1.2}
          className={cn(
            'relative size-14 text-carta-glow transition-transform duration-300',
            hold.holding && 'scale-90',
          )}
        />
      </motion.button>

      <motion.p
        className="relative mt-10 max-w-[16rem] text-carta-night-foreground/70 text-sm"
        animate={{ opacity: heard ? 0 : 1 }}
      >
        {hold.holding
          ? 'Así… un ratito más.'
          : hold.earlyReleases > 0
            ? 'Dejá el dedo apoyado un ratito más.'
            : copy.instruction}
      </motion.p>

      {(showFallback || hold.earlyReleases >= 2) && !heard && (
        <button
          type="button"
          onClick={finish}
          className="relative mt-6 text-carta-night-foreground/50 text-xs underline underline-offset-4"
        >
          Seguir sin esperar
        </button>
      )}
    </motion.div>
  );
}
