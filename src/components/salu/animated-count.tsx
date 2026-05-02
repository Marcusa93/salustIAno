'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

/**
 * Cuenta de 0 a `value` con un easeOut suave en ~700ms al montar.
 * Si el usuario tiene reduced-motion, muestra el valor final directamente.
 *
 * Pensado para los SummaryCard de /home: que el "3 tomas hoy" no aparezca
 * de golpe, sino que cuente. Guiño chico pero hace que la página se sienta
 * viva al cargar.
 */
export function AnimatedCount({
  value,
  className,
  durationMs = 700,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || value === 0) {
      setDisplay(value);
      return;
    }
    if (startedRef.current) {
      // Re-runs solo si cambió el value, animamos desde el actual.
      setDisplay(value);
      return;
    }
    startedRef.current = true;
    setDisplay(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={cn('tabular-nums', className)}>{display}</span>;
}
