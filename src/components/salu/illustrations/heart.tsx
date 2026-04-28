export function HeartIllustration({ size = 40 }: { size?: number }) {
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
        d="M20 32C20 32 6 23 6 14.5A7.5 7.5 0 0 1 20 11.5 7.5 7.5 0 0 1 34 14.5C34 23 20 32 20 32Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
