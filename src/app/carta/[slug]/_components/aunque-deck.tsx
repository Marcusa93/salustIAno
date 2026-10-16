'use client';

import type { LetterChapter } from '@/lib/carta/manifest';
import { easeWarm } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AnimatePresence, type PanInfo, type Variants, motion } from 'motion/react';
import { useState } from 'react';
import { Tape } from './atmosphere';
import { Handwritten } from './handwritten';

type Aunque = NonNullable<LetterChapter['aunque']>;

const SWIPE_PX = 90;

// La dirección llega por `custom` de AnimatePresence: así la tarjeta que se
// va usa la dirección del gesto que la sacó, no la del render anterior.
const CARD_VARIANTS: Variants = {
  exit: (direction: number) => ({
    x: direction * 420,
    rotate: direction * 22,
    opacity: 0,
    transition: { duration: 0.55, ease: 'easeIn' },
  }),
};

/**
 * Los "aunque…": un mazo de polaroids que mamá va pasando (deslizando o
 * tocando). Cuando no queda ninguna, aparece el giro: "Y aun así, mamá…".
 */
export function AunqueDeck({ aunque }: { aunque: Aunque }) {
  const [seen, setSeen] = useState(0);
  const [direction, setDirection] = useState(1);
  const done = seen >= aunque.cards.length;

  // Cada tarjeta avanza el mazo una sola vez: la que se está yendo sigue
  // recibiendo toques durante su animación, y un drag termina con un click.
  const advance = (index: number, dir = 1) => {
    setDirection(dir);
    setSeen((n) => (n === index ? n + 1 : n));
  };

  const onDragEnd = (index: number) => (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_PX) advance(index, info.offset.x > 0 ? 1 : -1);
  };

  return (
    <div className="mt-16 flex flex-col items-center">
      {aunque.intro && <Handwritten paragraphs={[aunque.intro]} className="mb-10 self-stretch" />}

      <div className="relative aspect-[3/4.2] w-full max-w-[17.5rem]">
        <AnimatePresence custom={direction}>
          {done ? (
            <motion.p
              key="reveal"
              className="absolute inset-0 flex items-center justify-center text-center font-display text-[2.4rem] text-carta-ink italic leading-tight"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.35, duration: 1.4, ease: easeWarm }}
            >
              {aunque.reveal}
            </motion.p>
          ) : (
            aunque.cards.map((card, i) => {
              if (i < seen) return null;
              const depth = i - seen;
              const isTop = depth === 0;
              return (
                <motion.div
                  key={card.media.src}
                  custom={direction}
                  className="absolute inset-0 touch-pan-y"
                  style={{ zIndex: aunque.cards.length - i }}
                  initial={false}
                  animate={{ rotate: depth * 3.5 - 2, y: depth * 12, scale: 1 - depth * 0.04 }}
                  variants={CARD_VARIANTS}
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  drag={isTop ? 'x' : false}
                  dragSnapToOrigin
                  onDragEnd={onDragEnd(i)}
                >
                  <button
                    type="button"
                    tabIndex={isTop ? 0 : -1}
                    aria-hidden={!isTop}
                    onClick={() => advance(i)}
                    aria-label={`${card.text} Tocá para seguir.`}
                    className="relative flex size-full flex-col bg-carta-polaroid p-3 pb-4 text-left shadow-[0_24px_40px_-20px_var(--carta-shadow)] outline-none focus-visible:ring-4 focus-visible:ring-carta-glow/60"
                  >
                    <Tape className="-top-3 -translate-x-1/2 left-1/2 w-20 rotate-2" />
                    <img
                      src={card.media.src}
                      alt={card.media.alt}
                      width={card.media.width}
                      height={card.media.height}
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                      className={cn(
                        'min-h-0 w-full flex-1 bg-carta-paper-edge',
                        card.media.fit === 'contain' ? 'object-contain' : 'object-cover',
                      )}
                    />
                    <span className="pt-3 font-hand text-[1.45rem] text-carta-ink leading-tight">
                      {card.text}
                    </span>
                  </button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <p className="mt-6 h-6 text-carta-ink-soft text-sm" aria-hidden>
        {!done && `${seen + 1} de ${aunque.cards.length} · deslizá o tocá`}
      </p>
      <p className="sr-only" aria-live="polite">
        {done ? aunque.reveal : aunque.cards[seen]?.text}
      </p>
    </div>
  );
}
