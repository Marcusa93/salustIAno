'use client';

import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface Props {
  value: number;
  max?: number;
  delay?: number;
  className?: string;
  barClassName?: string;
}

export function AnimatedBar({ value, max, delay = 0, className, barClassName }: Props) {
  const pct = max !== undefined ? Math.min(100, (value / max) * 100) : Math.min(100, value);

  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-muted/70', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-primary/60', barClassName)}
        initial={{ width: '0%' }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}
