'use client';

import { daysSinceBirth, secondsSinceBirth } from '@/lib/carta/dates';
import type { HeartbeatSynth } from '@/lib/carta/heartbeat-synth';
import type { Letter, LetterPhoto } from '@/lib/carta/manifest';
import { easeWarm } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Heart, House, Images, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion, useTransform } from 'motion/react';
import Link from 'next/link';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { NightSky } from './atmosphere';
import { Handwritten } from './handwritten';
import { LetterSelfie } from './letter-selfie';
import { usePhotoViewer } from './photo-viewer';
import { Polaroid } from './polaroid';
import { useSoundtrack } from './soundtrack-provider';
import { useHold } from './use-hold';

// El corazón de un bebé de 5 meses late ~120 veces por minuto.
const BABY_BPM = 120;
const HOLD_MS = 2800;

const HEART_PATH =
  'M50 88 C 22 66, 4 50, 4 30 C 4 14, 16 4, 30 4 C 40 4, 47 10, 50 17 C 53 10, 60 4, 70 4 C 84 4, 96 14, 96 30 C 96 50, 78 66, 50 88 Z';

const FLOATING_HEARTS = [
  { left: 8, delay: 0, rise: 7, drift: 20, size: 'size-4' },
  { left: 18, delay: 2.4, rise: 8.5, drift: -15, size: 'size-3' },
  { left: 29, delay: 1.1, rise: 6.5, drift: 10, size: 'size-5' },
  { left: 41, delay: 3.6, rise: 9, drift: -25, size: 'size-3' },
  { left: 53, delay: 0.6, rise: 7.5, drift: 18, size: 'size-4' },
  { left: 64, delay: 2.9, rise: 8, drift: -12, size: 'size-5' },
  { left: 75, delay: 1.7, rise: 6.8, drift: 22, size: 'size-3' },
  { left: 86, delay: 4.1, rise: 9.5, drift: -18, size: 'size-4' },
  { left: 93, delay: 0.3, rise: 7.2, drift: -8, size: 'size-3' },
] as const;

const numberAr = new Intl.NumberFormat('es-AR');

function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * El cierre, de vuelta a la noche. Al principio mamá escuchó el corazón de
 * Salu; ahora apoya el dedo sobre él para que la carta termine de abrirse.
 */
export function Finale({
  slug,
  finale,
  birthAt,
  memories,
  onEnter,
}: {
  slug: string;
  finale: Letter['finale'];
  birthAt: string;
  memories: LetterPhoto[];
  onEnter: () => void;
}) {
  const { soundtrack } = useSoundtrack();
  const { openAt } = usePhotoViewer();
  const synth = useRef<HeartbeatSynth | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [laughed, setLaughed] = useState(false);
  // Pausas entre lo que aparece después del corazón: firma, foto, P.D., contador.
  const momentDelay = 3.4;
  const postscriptDelay = finale.moment ? 5 : 3.8;
  const counterDelay = 3.6 + (finale.moment ? 1.6 : 0) + (finale.postscript ? 2 : 0);
  const now = useNow(revealed);

  const heartbeat = () => {
    synth.current ??= soundtrack.heartbeat(() => navigator.vibrate?.(22));
    return synth.current;
  };

  const complete = () => {
    if (revealed) return;
    heartbeat().stop(2.2);
    soundtrack.setDucked(false);
    navigator.vibrate?.([40, 90, 40]);
    setRevealed(true);
  };

  const hold = useHold({
    durationMs: HOLD_MS,
    onStart: () => {
      soundtrack.setDucked(true);
      heartbeat().start(BABY_BPM);
    },
    onCancel: () => {
      heartbeat().stop();
      soundtrack.setDucked(false);
    },
    onComplete: complete,
  });

  useEffect(() => () => synth.current?.stop(0.2), []);

  // La risa se baja apenas se abre el final, para que suene sin demora al tocar.
  const momentSound = finale.moment?.photo.sound;
  useEffect(() => {
    if (revealed && momentSound) soundtrack.preloadEffect(momentSound);
  }, [revealed, momentSound, soundtrack]);

  const fillY = useTransform(hold.progress, [0, 1], [92, 0]);
  const beatStyle = { '--beat': `${60 / BABY_BPM}s` } as CSSProperties;

  return (
    <motion.section
      id="final"
      aria-label="Final de la carta"
      className="relative overflow-hidden bg-carta-night text-carta-night-foreground"
      onViewportEnter={onEnter}
      viewport={{ margin: '-40% 0px -40% 0px' }}
    >
      <div aria-hidden className="h-48 bg-gradient-to-b from-carta-paper to-carta-night" />
      <NightSky className="top-48" />

      <div className="relative mx-auto flex max-w-xl flex-col px-7 pt-10 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        <Handwritten paragraphs={finale.lines} tone="night" size="lg" />

        <div className="mt-20 flex flex-col items-center text-center">
          <button
            type="button"
            {...hold.handlers}
            disabled={revealed}
            aria-label={`${finale.touchPrompt} Mantené apretado.`}
            className="relative size-44 touch-none select-none outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] focus-visible:rounded-full focus-visible:ring-4 focus-visible:ring-carta-glow/50"
          >
            <span
              aria-hidden
              style={beatStyle}
              className={cn(
                'absolute inset-2 rounded-full bg-carta-rose/20 blur-2xl transition-opacity duration-700',
                hold.holding || revealed ? 'opacity-100' : 'opacity-40',
                (hold.holding || revealed) && 'animate-carta-beat',
              )}
            />
            <svg
              aria-hidden
              viewBox="0 0 100 92"
              style={beatStyle}
              className={cn(
                'relative size-full',
                (hold.holding || revealed) && 'animate-carta-beat',
              )}
            >
              <defs>
                <clipPath id="carta-heart">
                  <path d={HEART_PATH} />
                </clipPath>
              </defs>
              <g clipPath="url(#carta-heart)">
                <motion.rect
                  x="0"
                  width="100"
                  height="92"
                  className="fill-carta-rose"
                  style={{ y: revealed ? 0 : fillY }}
                />
              </g>
              <path
                d={HEART_PATH}
                fill="none"
                strokeWidth="2"
                strokeLinejoin="round"
                className="stroke-carta-rose"
              />
            </svg>
          </button>

          <AnimatePresence mode="wait">
            {!revealed && (
              <motion.p
                key="prompt"
                className="mt-8 font-hand text-[1.7rem] text-carta-glow"
                exit={{ opacity: 0, y: -6 }}
              >
                {hold.holding
                  ? 'Ese soy yo.'
                  : hold.earlyReleases > 0
                    ? 'Dejá el dedo apoyado, un ratito más.'
                    : finale.touchPrompt}
              </motion.p>
            )}
          </AnimatePresence>
          {/* Si el gesto no le sale (soltó dos veces), que pueda seguir igual. */}
          {!revealed && hold.earlyReleases >= 2 && (
            <button
              type="button"
              onClick={complete}
              className="mt-4 text-carta-night-foreground/60 text-xs underline underline-offset-4"
            >
              Seguir sin esperar
            </button>
          )}
        </div>

        {revealed && (
          <motion.div
            className="mt-16 flex flex-col gap-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          >
            <Handwritten paragraphs={finale.closing} tone="night" size="lg" />

            <motion.p
              className="self-end font-hand text-[3.4rem] text-carta-glow leading-none"
              initial={{ opacity: 0, x: 12, rotate: -4 }}
              animate={{ opacity: 1, x: 0, rotate: -4 }}
              transition={{ delay: 2.6, duration: 1.4, ease: easeWarm }}
            >
              {finale.signature}
            </motion.p>

            {finale.moment && (
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: momentDelay, duration: 1.4, ease: easeWarm }}
              >
                <Polaroid
                  photo={finale.moment.photo}
                  tilt={-2}
                  size="lg"
                  className="w-full max-w-[20rem]"
                  soundHint={finale.moment.hint}
                  onSoundPlayed={() => setLaughed(true)}
                />
                <AnimatePresence>
                  {laughed && finale.moment.after && (
                    <motion.p
                      className="font-hand text-[2rem] text-carta-glow leading-tight"
                      initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ delay: 0.6, duration: 1.2, ease: easeWarm }}
                    >
                      {finale.moment.after}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {finale.postscript && (
              <motion.div
                className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: postscriptDelay, duration: 1.4, ease: easeWarm }}
              >
                <p className="font-display text-carta-glow text-lg italic">
                  {finale.postscript.label}
                </p>
                <Handwritten paragraphs={finale.postscript.lines} tone="night" />
                <p className="-rotate-3 self-end font-hand text-[2.4rem] text-carta-glow leading-none">
                  {finale.postscript.signature}
                </p>
              </motion.div>
            )}

            <motion.div
              className="flex flex-col items-center gap-2 border-carta-night-foreground/15 border-t pt-12 text-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: counterDelay, duration: 1.2, ease: easeWarm }}
            >
              <p className="font-sans text-[0.7rem] text-carta-night-foreground/60 uppercase tracking-[0.3em]">
                Sos mi mamá hace
              </p>
              <p className="font-display text-[3.6rem] text-carta-night-foreground italic leading-none">
                {numberAr.format(daysSinceBirth(birthAt, now))}{' '}
                <span className="text-[1.6rem]">días</span>
              </p>
              <p className="font-display text-carta-glow tabular-nums">
                {numberAr.format(secondsSinceBirth(birthAt, now))} segundos, y contando.
              </p>
              <p className="mt-10 font-display text-[1.9rem] italic leading-tight">{finale.wish}</p>

              {finale.photo && (
                <div className="mt-14 w-full">
                  <LetterSelfie slug={slug} copy={finale.photo} memories={memories} />
                </div>
              )}

              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openAt(0)}
                  className="flex items-center gap-2 rounded-full bg-carta-night-foreground/10 px-5 py-3 text-sm transition-colors hover:bg-carta-night-foreground/20"
                >
                  <Images className="size-4" aria-hidden />
                  Ver todas las fotos
                </button>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex items-center gap-2 rounded-full bg-carta-night-foreground/10 px-5 py-3 text-sm transition-colors hover:bg-carta-night-foreground/20"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Volver a leer
                </button>
                <Link
                  href="/home"
                  className="flex items-center gap-2 rounded-full bg-carta-night-foreground/10 px-5 py-3 text-sm transition-colors hover:bg-carta-night-foreground/20"
                >
                  <House className="size-4" aria-hidden />
                  Volver a Salu
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

      {revealed && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full">
          {FLOATING_HEARTS.map((heart) => (
            <Heart
              key={heart.left}
              className={cn(
                'absolute bottom-0 animate-carta-rise fill-current text-carta-rose/70',
                heart.size,
              )}
              style={
                {
                  left: `${heart.left}%`,
                  '--delay': `${heart.delay}s`,
                  '--rise': `${heart.rise}s`,
                  '--drift': `${heart.drift}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}
