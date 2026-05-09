'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface RealtimeRefresherProps {
  /** ID del bebé para filtrar suscripciones — solo cambios de este child. */
  childId: string;
}

const REFRESH_DEBOUNCE_MS = 350;
const TABLES = [
  'feeding_events',
  'sleep_sessions',
  'diaper_events',
  'media_items',
  'notes',
] as const;

/**
 * Realtime updates del /home. Suscribe a postgres_changes en las tablas
 * relevantes (eventos de cuidado + media + notas) filtrando por child_id,
 * y cuando llega un cambio dispara router.refresh() para que el Server
 * Component re-renderee con datos frescos.
 *
 * Por qué importa: con dos cuidadores activos al mismo tiempo (ej. mamá
 * en su teléfono + papá en el suyo), cuando uno carga un evento el otro
 * lo ve sin tener que recargar la página.
 *
 * Optimización: debounce 350ms — si llegan varios cambios juntos
 * (típico cuando alguien carga una toma con createSleep + close +
 * media), se hace un solo refresh.
 *
 * Cleanup en unmount: removeChannel libera el WS — sin esto, navegar
 * fuera de /home dejaría la suscripción colgada hasta el GC del browser.
 *
 * Component vacío — no renderiza nada visible. Solo monta side-effects.
 */
export function RealtimeRefresher({ childId }: RealtimeRefresherProps) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!childId) return;
    const supabase = createClient();

    function scheduleRefresh() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    // Un solo channel para todas las tablas; cada una con su filter.
    // Nota: el filter de Supabase Realtime es server-side simple (eq),
    // y para media_items / notes el filter usa child_id también.
    const channel = supabase.channel(`home-realtime-${childId}`);

    for (const table of TABLES) {
      channel.on(
        // biome-ignore lint/suspicious/noExplicitAny: Supabase Realtime types laxos en JS SDK.
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          filter: `child_id=eq.${childId}`,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [childId, router]);

  return null;
}
