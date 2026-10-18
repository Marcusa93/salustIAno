'use client';

import type { LetterChapter, LetterMedia } from '@/lib/carta/manifest';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { AunqueDeck } from './aunque-deck';
import { BirthVideo } from './birth-video';
import { Handwritten } from './handwritten';
import { Polaroid } from './polaroid';

// Inclinaciones fijas y alternadas: desorden de mesa, pero estable.
const TILTS = [-2.4, 1.9, -1.3, 2.7, -2, 1.2, -2.8, 1.6];
const tiltAt = (i: number) => TILTS[i % TILTS.length] ?? 0;

/** Id del capítulo en la página: para el índice y para "seguir donde estabas". */
export const chapterAnchor = (id: string) => `cap-${id}`;

function FeaturedMedia({ media, tilt }: { media: LetterMedia; tilt: number }) {
  if (media.kind === 'video') return <BirthVideo video={media} tilt={tilt} />;
  return <Polaroid photo={media} tilt={tilt} size="lg" className="mx-auto w-full max-w-[21rem]" />;
}

/**
 * Un capítulo = un momento de la vida de Salu: el mes, lo que le dice a
 * mamá y las fotos de ese tiempo. Al cruzar el centro de la pantalla
 * avisa (para la barra de arriba y para cambiar de canción).
 */
export function ChapterSection({
  chapter,
  onEnter,
}: {
  chapter: LetterChapter;
  onEnter: (chapter: LetterChapter) => void;
}) {
  const featured = chapter.media.find((media) => media.featured) ?? chapter.media[0];
  const rest = chapter.media.filter((media) => media !== featured);

  return (
    <motion.section
      id={chapterAnchor(chapter.id)}
      aria-labelledby={`capitulo-${chapter.id}`}
      className="relative pt-28"
      onViewportEnter={() => onEnter(chapter)}
      viewport={{ margin: '-45% 0px -45% 0px' }}
    >
      <header className="relative mb-9">
        <span
          aria-hidden
          className="-top-12 -left-3 pointer-events-none absolute select-none whitespace-nowrap font-display text-[5.5rem] text-carta-ink/[0.07] italic leading-none"
        >
          {chapter.label}
        </span>
        <p className="relative font-sans text-[0.7rem] text-carta-ink-soft uppercase tracking-[0.32em]">
          {chapter.label}
        </p>
        <h2
          id={`capitulo-${chapter.id}`}
          className="relative mt-1 font-display text-[2.2rem] text-carta-ink italic"
        >
          {chapter.title}
        </h2>
      </header>

      <Handwritten paragraphs={chapter.text} />

      {featured && (
        <div className="mt-14">
          <FeaturedMedia media={featured} tilt={tiltAt(chapter.id.length)} />
        </div>
      )}

      {rest.length > 0 && (
        <ul className="mt-14 grid grid-cols-2 gap-x-5 gap-y-8">
          {rest.map((media, i) => (
            <li key={media.src} className={cn(i % 2 === 1 && 'translate-y-8')}>
              {media.kind === 'video' ? (
                <BirthVideo video={media} tilt={tiltAt(i)} />
              ) : (
                <Polaroid photo={media} tilt={tiltAt(i + 3)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {chapter.aunque && <AunqueDeck aunque={chapter.aunque} />}
    </motion.section>
  );
}
