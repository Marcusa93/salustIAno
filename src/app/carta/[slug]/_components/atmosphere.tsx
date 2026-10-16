import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

// Posiciones fijas (no random) para que server y cliente pinten lo mismo.
const STARS = [
  [8, 12, 0],
  [22, 6, 1.4],
  [37, 18, 2.2],
  [52, 9, 0.6],
  [68, 15, 3.1],
  [83, 7, 1.8],
  [93, 21, 0.9],
  [14, 31, 2.7],
  [45, 27, 1.1],
  [76, 33, 2.4],
  [5, 47, 1.6],
  [31, 44, 0.3],
  [61, 49, 2.9],
  [89, 45, 1.2],
  [19, 62, 2.1],
  [48, 66, 0.7],
  [72, 61, 1.9],
  [95, 68, 2.6],
  [9, 81, 1.3],
  [36, 86, 2.3],
  [58, 79, 0.5],
  [81, 88, 1.7],
] as const;

/** Cielo de noche con estrellas que titilan, para las escenas oscuras. */
export function NightSky({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div className="-translate-x-1/2 absolute top-[-20%] left-1/2 size-[42rem] rounded-full bg-carta-glow/10 blur-3xl" />
      {STARS.map(([left, top, delay], i) => (
        <span
          key={`${left}-${top}`}
          className={cn(
            'absolute animate-twinkle rounded-full bg-carta-night-foreground',
            i % 3 === 0 ? 'size-[3px]' : 'size-[2px]',
          )}
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

/** Grano de papel: ruido SVG muy tenue multiplicado sobre el fondo. */
export function PaperGrain() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 size-full opacity-[0.07] mix-blend-multiply"
    >
      <filter id="carta-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#carta-grain)" />
    </svg>
  );
}

/** Tira de cinta de papel que "pega" una polaroid. */
export function Tape({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute z-10 h-6 w-20 bg-carta-tape shadow-[0_1px_2px_var(--carta-shadow)] backdrop-blur-[1px]',
        className,
      )}
      style={style}
    />
  );
}
