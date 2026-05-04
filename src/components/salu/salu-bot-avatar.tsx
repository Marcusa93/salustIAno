import { cn } from '@/lib/utils';

interface SaluBotAvatarProps {
  size?: number;
  className?: string;
  /** Si true, el ojito y la sonrisa heredan el color del texto (currentColor)
   *  para integrarse mejor en cabeceras donde no querés primary fuerte. */
  monochrome?: boolean;
}

/**
 * Avatar de SaluIA — un círculo dusty-blue con dos ojitos y una sonrisa
 * mínima, para reemplazar el emoji 👶 que se ve diferente en cada OS.
 * Pensado para usarse a tamaños 28-56px.
 *
 * Decisiones:
 *  - Cara redonda con un mechón cromado en la frente (la "S" de Salu como
 *    flequillo que también sugiere el guion del logo).
 *  - Ojitos altos y juntos: lectura de bebé sin caer en cuteness barata.
 *  - Sonrisa apenas insinuada — la marca es serena, no exuberante.
 */
export function SaluBotAvatar({ size = 32, className, monochrome }: SaluBotAvatarProps) {
  // Si monochrome, usamos currentColor (hereda del padre) para ojos y boca.
  // El fondo siempre es primary/15 (sutil) o currentColor con opacidad.
  const eyeFill = monochrome ? 'currentColor' : 'var(--color-primary, oklch(0.6 0.085 235))';
  const mouthStroke = monochrome ? 'currentColor' : 'var(--color-primary, oklch(0.6 0.085 235))';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('inline-block', className)}
      aria-hidden
    >
      <title>Salu</title>
      {/* Cara: círculo con bg suave del primary. */}
      <circle
        cx="32"
        cy="32"
        r="28"
        fill={monochrome ? 'currentColor' : 'var(--color-primary, oklch(0.6 0.085 235))'}
        opacity={monochrome ? 0.18 : 0.18}
      />
      {/* Mechón / "S" de salu como flequillo cromado. */}
      <path
        d="M 14 22 Q 24 12, 32 16 T 50 22"
        fill="none"
        stroke={mouthStroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Ojo izq. */}
      <circle cx="24" cy="32" r="2.6" fill={eyeFill} />
      {/* Ojo der. */}
      <circle cx="40" cy="32" r="2.6" fill={eyeFill} />
      {/* Cachete leve para humanizar (peach). */}
      {!monochrome && (
        <>
          <circle
            cx="20"
            cy="40"
            r="2.4"
            fill="var(--color-accent, oklch(0.93 0.035 60))"
            opacity="0.7"
          />
          <circle
            cx="44"
            cy="40"
            r="2.4"
            fill="var(--color-accent, oklch(0.93 0.035 60))"
            opacity="0.7"
          />
        </>
      )}
      {/* Sonrisa mínima. */}
      <path
        d="M 26 42 Q 32 46, 38 42"
        fill="none"
        stroke={mouthStroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
