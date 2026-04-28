export function MoonIllustration({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22 8C15.373 8 10 13.373 10 20s5.373 12 12 12c2.21 0 4.277-.597 6.046-1.637C26.04 32.118 23.09 33 20 33 12.268 33 6 26.732 6 19S12.268 5 20 5c1.06 0 2.09.13 3.076.375A12.038 12.038 0 0 0 22 8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="29" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="33" cy="16" r="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
