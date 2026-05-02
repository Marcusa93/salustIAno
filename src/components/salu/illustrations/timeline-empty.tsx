/**
 * Timeline empty illustration — un día con sol + nube + estrellitas
 * sobre una línea de horizonte ondulada. Sugiere "todavía no pasó nada
 * pero el día está abierto a que pase".
 */
export function TimelineEmptyIllustration({ size = 160 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Sol — accent peach soft */}
      <circle cx="55" cy="60" r="22" fill="oklch(0.93 0.035 60)" opacity="0.7" />
      <circle cx="55" cy="60" r="14" fill="oklch(0.985 0.006 90)" />
      {/* Rayos de sol — finos */}
      <g stroke="oklch(0.6 0.085 235)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4">
        <path d="M55 26 L55 32" />
        <path d="M28 60 L34 60" />
        <path d="M82 60 L76 60" />
        <path d="M35 40 L40 45" />
        <path d="M75 40 L70 45" />
        <path d="M35 80 L40 75" />
        <path d="M75 80 L70 75" />
      </g>

      {/* Nube — primary muted soft */}
      <g fill="oklch(0.92 0.012 235)">
        <circle cx="135" cy="58" r="14" />
        <circle cx="148" cy="55" r="11" />
        <circle cx="155" cy="62" r="13" />
        <circle cx="142" cy="65" r="14" />
      </g>

      {/* Pájaros mínimos en el cielo */}
      <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.5">
        <path d="M105 35 Q108 32 111 35 Q114 32 117 35" />
        <path d="M120 25 Q123 22 126 25" />
      </g>

      {/* Línea de horizonte ondulada */}
      <path
        d="M0 120 Q50 110 100 120 T200 120"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />

      {/* Pequeñas hierbas / detalles abajo */}
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4">
        <path d="M30 130 L30 135" />
        <path d="M65 132 L65 137" />
        <path d="M120 128 L120 134" />
        <path d="M170 130 L170 135" />
      </g>
    </svg>
  );
}
