'use client';

import { polaroidDateLabel } from '@/lib/carta/dates';
import type { LetterPhoto } from '@/lib/carta/manifest';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { Tape } from './atmosphere';
import { usePhotoViewer } from './photo-viewer';

// "Revelado" de foto instantánea: arranca lavada y cálida, y toma color.
const UNDEVELOPED = 'saturate(0.1) sepia(0.55) brightness(1.4) contrast(0.7)';
const DEVELOPED = 'saturate(1) sepia(0) brightness(1) contrast(1)';

export function Polaroid({
  photo,
  tilt,
  size = 'sm',
  className,
}: {
  photo: LetterPhoto;
  tilt: number;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const { openPhoto } = usePhotoViewer();
  const large = size === 'lg';

  return (
    <motion.figure
      className={cn(
        'relative bg-carta-polaroid shadow-[0_18px_34px_-18px_var(--carta-shadow)]',
        large ? 'p-3 pb-4' : 'p-2 pb-3',
        className,
      )}
      initial={{ opacity: 0, y: 28, rotate: tilt * 2.2 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ type: 'spring', stiffness: 60, damping: 15 }}
    >
      <Tape
        className={cn('-top-3 -translate-x-1/2 left-1/2', large ? 'w-24' : 'w-14')}
        style={{ rotate: `${-tilt * 1.6}deg` }}
      />
      <button
        type="button"
        onClick={() => openPhoto(photo.src)}
        aria-label={`Ver foto: ${photo.alt}`}
        className="block w-full cursor-zoom-in outline-none focus-visible:ring-4 focus-visible:ring-carta-glow/60"
      >
        <motion.img
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          initial={{ filter: UNDEVELOPED }}
          whileInView={{ filter: DEVELOPED }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 2.6, ease: 'easeOut', delay: 0.2 }}
          // La grande se ve entera; las chicas, recortadas parejas como en una tira.
          style={large ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
          className={cn(
            'w-full bg-carta-paper-edge',
            photo.fit === 'contain' ? 'object-contain' : 'object-cover',
            !large && 'aspect-[4/5]',
          )}
        />
      </button>
      <figcaption className={cn('flex flex-col px-1', large ? 'pt-3' : 'pt-2')}>
        {photo.caption && (
          <span
            className={cn(
              'font-hand text-carta-ink leading-tight',
              large ? 'text-[1.6rem]' : 'text-[1.2rem]',
            )}
          >
            {photo.caption}
          </span>
        )}
        <span className="self-end font-hand text-carta-ink-soft text-sm">
          {polaroidDateLabel(photo.takenAt)}
        </span>
      </figcaption>
    </motion.figure>
  );
}
