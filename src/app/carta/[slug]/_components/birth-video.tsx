'use client';

import { polaroidDateLabel } from '@/lib/carta/dates';
import type { LetterVideo } from '@/lib/carta/manifest';
import { cn } from '@/lib/utils';
import { Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { Tape } from './atmosphere';
import { useSoundtrack } from './soundtrack-provider';

/**
 * Video corto en marco de polaroid: corre mudo en loop y con un toque se
 * escucha. Mientras suena con audio, la música baja y después vuelve.
 */
export function BirthVideo({ video, tilt }: { video: LetterVideo; tilt: number }) {
  const { soundtrack } = useSoundtrack();
  const ref = useRef<HTMLVideoElement>(null);
  const [withSound, setWithSound] = useState(false);

  const listen = () => {
    const el = ref.current;
    if (!el) return;
    el.loop = false;
    el.muted = false;
    el.currentTime = 0;
    soundtrack.setDucked(true);
    setWithSound(true);
    el.play().catch(() => backToSilent());
  };

  const backToSilent = () => {
    const el = ref.current;
    soundtrack.setDucked(false);
    setWithSound(false);
    if (!el) return;
    el.muted = true;
    el.loop = true;
    el.play().catch(() => {});
  };

  return (
    <motion.figure
      className="relative mx-auto w-full max-w-[19rem] bg-carta-polaroid p-3 pb-4 shadow-[0_24px_40px_-20px_var(--carta-shadow)]"
      initial={{ opacity: 0, y: 30, rotate: tilt * 2 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ type: 'spring', stiffness: 55, damping: 15 }}
    >
      <Tape className="-top-3 -translate-x-1/2 left-1/2 w-24" style={{ rotate: `${-tilt}deg` }} />
      <div className="relative overflow-hidden bg-carta-night">
        <video
          ref={ref}
          src={video.src}
          poster={video.posterSrc}
          width={video.width}
          height={video.height}
          aria-label={video.alt}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          onEnded={backToSilent}
          className="block w-full"
          style={{ aspectRatio: `${video.width} / ${video.height}` }}
        />
        <button
          type="button"
          onClick={withSound ? backToSilent : listen}
          aria-pressed={withSound}
          className={cn(
            '-translate-x-1/2 absolute bottom-3 left-1/2 flex items-center gap-2 rounded-full px-4 py-2 font-hand text-xl shadow-lg backdrop-blur-md transition-colors',
            withSound
              ? 'bg-carta-night/60 text-carta-night-foreground'
              : 'bg-carta-polaroid/85 text-carta-ink',
          )}
        >
          <Volume2 className={cn('size-4', withSound && 'animate-pulse')} aria-hidden />
          {withSound ? 'Escuchándome…' : 'Tocá para escucharme'}
        </button>
      </div>
      <figcaption className="flex flex-col px-1 pt-3">
        {video.caption && (
          <span className="font-hand text-[1.6rem] text-carta-ink leading-tight">
            {video.caption}
          </span>
        )}
        <span className="self-end font-hand text-carta-ink-soft text-sm">
          {polaroidDateLabel(video.takenAt)}
        </span>
      </figcaption>
    </motion.figure>
  );
}
