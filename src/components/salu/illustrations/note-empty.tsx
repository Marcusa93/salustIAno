/**
 * Note empty illustration — papelito doblado con una flor diminuta y
 * una estrella. Para "todavía no escribiste momentos". Cálido sin ser
 * cursi.
 */
export function NoteEmptyIllustration({ size = 160 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Papel principal — fondo card con shadow leve */}
      <g>
        <rect
          x="55"
          y="55"
          width="100"
          height="120"
          rx="8"
          fill="oklch(1 0 0)"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.95"
        />
        {/* Esquina doblada */}
        <path
          d="M140 55 L140 70 L155 70"
          fill="oklch(0.95 0.012 235)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Líneas de "texto" placeholder muy sutiles */}
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25">
          <path d="M68 90 L142 90" />
          <path d="M68 105 L130 105" />
          <path d="M68 120 L138 120" />
          <path d="M68 135 L120 135" />
        </g>
      </g>

      {/* Flor pequeña arriba a la izquierda — accent peach */}
      <g transform="translate(35, 45)">
        <circle cx="0" cy="0" r="4" fill="oklch(0.93 0.035 60)" />
        <circle cx="6" cy="-3" r="4" fill="oklch(0.93 0.035 60)" />
        <circle cx="6" cy="3" r="4" fill="oklch(0.93 0.035 60)" />
        <circle cx="0" cy="6" r="4" fill="oklch(0.93 0.035 60)" />
        <circle cx="-6" cy="3" r="4" fill="oklch(0.93 0.035 60)" />
        <circle cx="-6" cy="-3" r="4" fill="oklch(0.93 0.035 60)" />
        <circle cx="0" cy="0" r="2.5" fill="oklch(0.6 0.085 235)" />
        {/* Tallo */}
        <path
          d="M0 8 Q3 18 0 30"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity="0.4"
        />
      </g>

      {/* Estrella pequeña en el aire */}
      <g
        transform="translate(170, 35)"
        stroke="oklch(0.6 0.085 235)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      >
        <path d="M0 -6 L0 6" />
        <path d="M-6 0 L6 0" />
        <path d="M-4 -4 L4 4" />
        <path d="M-4 4 L4 -4" />
      </g>

      {/* Pequeño corazón flotando */}
      <path
        d="M155 175 C155 175 145 168 145 160 C145 156 149 153 152 154 C153 154 154 155 155 156 C156 155 157 154 158 154 C161 153 165 156 165 160 C165 168 155 175 155 175 Z"
        fill="oklch(0.93 0.035 60)"
        opacity="0.7"
      />
    </svg>
  );
}
