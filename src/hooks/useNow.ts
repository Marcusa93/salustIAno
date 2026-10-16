'use client';

import { useEffect, useState } from 'react';

/**
 * La hora actual, refrescada cada `intervalMs`. Para contadores en vivo
 * ("durmiendo hace 1 h 12 min") sin recargar la página. Se sincroniza con
 * el cambio de minuto para que todos los contadores avancen juntos.
 *
 * `initialISO` es la hora en que el server renderizó: arrancar con ella
 * evita que el HTML del server y el primer render del cliente difieran.
 */
export function useNow(intervalMs = 30_000, initialISO?: string): Date {
  const [now, setNow] = useState(() => (initialISO ? new Date(initialISO) : new Date()));

  useEffect(() => {
    let interval: number | undefined;
    const tick = () => setNow(new Date());
    const untilNextMinute = 60_000 - (Date.now() % 60_000);
    const align = window.setTimeout(
      () => {
        tick();
        interval = window.setInterval(tick, intervalMs);
      },
      Math.min(untilNextMinute, intervalMs),
    );
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(align);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
