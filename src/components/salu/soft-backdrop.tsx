import { cn } from '@/lib/utils';

/**
 * Fondo decorativo sutil para páginas autenticadas.
 *
 * Tres "blobs" radiales con baja opacidad — uno con primary (azul polvo),
 * otro con accent (peach cálido), otro con primary muted abajo. Todo en
 * blur extremo + opacidad ~6-10% para que sea ambiente, no decoración
 * llamativa. Va detrás de todo (-z-10) y absoluto fixed para no afectar
 * scroll de la página.
 *
 * Pensado para evocar "papel pintado, edición especial bebé": superficie
 * que tiene textura sin gritarte.
 */
export function SoftBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
    >
      {/* Blob primary, top-right */}
      <div
        className="absolute -top-32 -right-32 size-[42rem] rounded-full bg-primary/8 blur-3xl"
        style={{ opacity: 0.55 }}
      />
      {/* Blob accent (peach), middle-left */}
      <div
        className="absolute top-1/3 -left-40 size-[36rem] rounded-full bg-accent blur-3xl"
        style={{ opacity: 0.35 }}
      />
      {/* Blob primary muted, bottom */}
      <div
        className="absolute -bottom-40 right-1/4 size-[40rem] rounded-full bg-primary/5 blur-3xl"
        style={{ opacity: 0.45 }}
      />
      {/* Grano sutil — papel — solo en navegadores que lo aguanten */}
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
