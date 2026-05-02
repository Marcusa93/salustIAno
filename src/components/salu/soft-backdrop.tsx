import { cn } from '@/lib/utils';

/**
 * Fondo decorativo sutil — estilo manta de bebé vichy azul/blanco.
 *
 * Capas (de atrás hacia adelante):
 *   1. Patrón vichy (gingham) en cuadritos de 40px: blanco + azul polvo
 *      en stripes horizontales/verticales + intersecciones azul más
 *      oscuro. Es el alma del background — "manta de bebé hecha en
 *      casa". Opacidad muy baja (~6-8%) para que no compita con el
 *      contenido.
 *   2. Tres blobs radiales con blur extremo (primary, accent peach,
 *      primary muted) que rompen la regularidad del cuadrille y dan
 *      profundidad orgánica.
 *   3. Una capa de grano SVG turbulence al 1.5% mix-blend-overlay —
 *      textura de papel artesanal.
 *
 * Cada capa es prácticamente imperceptible sola; juntas dan la
 * sensación de "esto está hecho con cuidado" sin gritar nada.
 */
export function SoftBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}
    >
      {/* Capa 1: patrón vichy / gingham (azul + blanco) */}
      <div
        className="absolute inset-0"
        style={{
          // Dos linear-gradients perpendiculares a 50% que se mezclan en
          // las intersecciones gracias a la transparencia. El resultado
          // es: cuadritos blancos, cuadritos azul claro a 50% opacidad,
          // y donde se superponen quedan en azul más oscuro.
          backgroundImage: [
            'linear-gradient(to right, oklch(0.6 0.085 235 / 0.07) 50%, transparent 50%)',
            'linear-gradient(to bottom, oklch(0.6 0.085 235 / 0.07) 50%, transparent 50%)',
          ].join(', '),
          backgroundSize: '36px 36px, 36px 36px',
          backgroundPosition: '0 0, 0 0',
        }}
      />

      {/* Capa 2: blobs orgánicos que rompen la regularidad del cuadrille */}
      <div
        className="absolute -top-32 -right-32 size-[42rem] rounded-full bg-primary/8 blur-3xl"
        style={{ opacity: 0.45 }}
      />
      <div
        className="absolute top-1/3 -left-40 size-[36rem] rounded-full bg-accent blur-3xl"
        style={{ opacity: 0.3 }}
      />
      <div
        className="absolute -bottom-40 right-1/4 size-[40rem] rounded-full bg-primary/5 blur-3xl"
        style={{ opacity: 0.4 }}
      />

      {/* Capa 3: grano SVG — papel hecho a mano */}
      <div
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: '160px 160px',
        }}
      />
    </div>
  );
}
