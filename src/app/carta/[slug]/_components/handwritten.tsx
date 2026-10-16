'use client';

import { cn } from '@/lib/utils';
import { type Variants, motion } from 'motion/react';
import { Fragment } from 'react';

const PARAGRAPH: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
};

const WORD: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

/**
 * Texto "escrito a mano": cada párrafo aparece palabra por palabra cuando
 * entra en pantalla, como si la tinta todavía estuviera corriendo.
 */
export function Handwritten({
  paragraphs,
  tone = 'paper',
  size = 'md',
  className,
}: {
  paragraphs: string[];
  tone?: 'paper' | 'night';
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {paragraphs.map((text, p) => (
        <motion.p
          key={`${p}-${text.slice(0, 24)}`}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
          variants={PARAGRAPH}
          className={cn(
            'text-pretty font-hand',
            size === 'md' ? 'text-[1.7rem] leading-[1.32]' : 'text-[2.15rem] leading-[1.22]',
            tone === 'paper' ? 'text-carta-ink' : 'text-carta-night-foreground',
          )}
        >
          {text.split(' ').map((word, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: el texto es fijo, el orden de las palabras no cambia.
            <Fragment key={i}>
              <motion.span variants={WORD} className="inline-block">
                {word}
              </motion.span>{' '}
            </Fragment>
          ))}
        </motion.p>
      ))}
    </div>
  );
}
