'use client';

import { cn } from '@/lib/utils';

/**
 * Fondo en video para las pantallas de auth. Reproducido en loop, muteado,
 * con cover full-bleed y un overlay tipográfico que mantiene legibilidad.
 *
 * Comportamiento:
 *   - Autoplay solo se permite con muted + playsInline (iOS).
 *   - Loop infinito sin pausa.
 *   - Si el navegador respeta `prefers-reduced-motion: reduce`, vía CSS
 *     forzamos `animation-play-state: paused` y mostramos el poster
 *     congelado en su lugar (ver globals.css).
 *   - Poster JPG sirve también de fallback antes de cargar y para
 *     conexiones lentas.
 *
 * Privacidad: el video es íntimo (ecografía familiar). Está bajo /public,
 * accesible vía URL — la app es privada por uso, pero el archivo en sí es
 * estático y servido sin auth. La familia eligió ponerlo acá; no lo
 * referenciamos desde otras pantallas.
 */
export function IntroVideoBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <video
        className="motion-reduce:hidden h-full w-full object-cover"
        src="/intro.mp4"
        poster="/intro-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        // biome-ignore lint/a11y/useMediaCaption: video decorativo de fondo, sin diálogo.
      />
      {/* Fallback estático para reduced motion */}
      <img
        src="/intro-poster.jpg"
        alt=""
        className="hidden h-full w-full object-cover motion-reduce:block"
      />
      {/* Overlay sutil para legibilidad — el frosted-blur del card hace el resto */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background/50" />
    </div>
  );
}
