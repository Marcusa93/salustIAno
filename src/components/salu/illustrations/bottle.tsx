export function BottleIllustration({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cuello */}
      <rect x="16" y="5" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Tapa */}
      <rect x="14" y="3" width="12" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Cuerpo */}
      <path
        d="M14 10h12l2 4v16a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V14l2-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Marca de nivel */}
      <line
        x1="15"
        y1="22"
        x2="25"
        y2="22"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <line
        x1="15"
        y1="27"
        x2="25"
        y2="27"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
}
