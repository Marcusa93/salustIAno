/**
 * Cradle illustration — cuna estilizada con luna creciente. Para empty
 * states de "todavía no hay perfil del bebé". Editorial, hand-drawn,
 * bicolor (primary + accent peach) con stroke-only style.
 */
export function CradleIllustration({ size = 160 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Luna arriba a la derecha — accent peach soft fill, respirando */}
      <g
        className="animate-breathe"
        style={{ transformOrigin: '163px 39px', transformBox: 'fill-box' }}
      >
        <circle cx="160" cy="40" r="14" fill="oklch(0.93 0.035 60)" />
        <circle cx="166" cy="38" r="12" fill="oklch(0.985 0.006 90)" />
      </g>

      {/* Tres estrellitas dispersas — titilando con stagger */}
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6">
        <g className="animate-twinkle" style={{ animationDelay: '0s' }}>
          <path d="M40 30 L40 38 M36 34 L44 34" />
        </g>
        <g className="animate-twinkle" style={{ animationDelay: '0.8s' }}>
          <path d="M180 80 L180 84 M178 82 L182 82" />
        </g>
        <g className="animate-twinkle" style={{ animationDelay: '1.6s' }}>
          <path d="M30 70 L30 76 M27 73 L33 73" />
        </g>
      </g>

      {/* Cuna — base curva con barrotes verticales */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Curva inferior de la cuna */}
        <path d="M40 150 Q100 175 160 150" fill="none" />
        {/* Lados */}
        <path d="M40 150 L40 110" />
        <path d="M160 150 L160 110" />
        {/* Top rail */}
        <path d="M40 110 L160 110" />
        {/* Barrotes */}
        <path d="M55 110 L55 145" opacity="0.4" />
        <path d="M70 110 L70 148" opacity="0.4" />
        <path d="M85 110 L85 150" opacity="0.4" />
        <path d="M100 110 L100 151" opacity="0.4" />
        <path d="M115 110 L115 150" opacity="0.4" />
        <path d="M130 110 L130 148" opacity="0.4" />
        <path d="M145 110 L145 145" opacity="0.4" />
      </g>

      {/* Mantita / soft cushion adentro de la cuna */}
      <path
        d="M48 138 Q100 155 152 138 L152 150 Q100 165 48 150 Z"
        fill="oklch(0.93 0.035 60)"
        opacity="0.5"
      />

      {/* Patas */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M50 165 L50 175" />
        <path d="M150 165 L150 175" />
      </g>
    </svg>
  );
}
