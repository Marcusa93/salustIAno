import { cn } from '@/lib/utils';

/**
 * Fondo decorativo: papel tibio con luz suave, sin patrones que compitan
 * con el contenido.
 *
 * Capas (de atrás hacia adelante):
 *   1. Un halo del primary arriba, como la luz que entra por una ventana.
 *   2. Un toque del accent (durazno) abajo a la izquierda, para que el
 *      azul no quede frío.
 *   3. Grano SVG muy tenue: textura de papel.
 *
 * Todo sale de tokens, así se adapta solo a claro, oscuro y madrugada.
 */
export function SoftBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}
    >
      <div className="-top-48 -translate-x-1/2 absolute left-1/2 h-[34rem] w-[56rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="-bottom-56 -left-40 absolute size-[34rem] rounded-full bg-accent/60 blur-3xl" />
      <svg className="absolute inset-0 size-full opacity-[0.035] mix-blend-multiply dark:mix-blend-screen">
        <filter id="salu-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#salu-grain)" />
      </svg>
    </div>
  );
}
