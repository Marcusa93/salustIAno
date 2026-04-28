export function ScaleIllustration({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Base */}
      <line
        x1="10"
        y1="34"
        x2="30"
        y2="34"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Palo central */}
      <line
        x1="20"
        y1="34"
        x2="20"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Brazo */}
      <line
        x1="9"
        y1="16"
        x2="31"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Platillo izquierdo */}
      <path
        d="M9 16 Q9 22 14 23 Q19 24 14 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Platillo derecho (ligeramente más bajo) */}
      <path
        d="M31 16 Q31 24 26 25 Q21 26 26 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Punto superior */}
      <circle cx="20" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
