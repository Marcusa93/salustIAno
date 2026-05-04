import { cn } from '@/lib/utils';

interface SaluLogoProps {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showTagline?: boolean;
}

const sizes = {
  sm: 'text-lg',
  default: 'text-2xl',
  lg: 'text-4xl',
};

const dotSizes = {
  sm: 'size-1.5',
  default: 'size-2',
  lg: 'size-2.5',
};

/**
 * Logo de Salu — palabra "Sa**lu**" con la 2da sílaba en primary, + un dot
 * decorativo en la esquina superior derecha que respira (animate-breathe).
 * El dot es el guiño de marca: sutil pero presente, refuerza identidad sin
 * competir con headers o nav. Usa el accent-foreground (peach) para
 * romper la frialdad del azul.
 */
export function SaluLogo({ size = 'default', className, showTagline = false }: SaluLogoProps) {
  return (
    <div className={cn('flex select-none flex-col', className)}>
      <span
        className={cn('relative inline-block font-semibold tracking-tight', sizes[size])}
        aria-label="Salu"
      >
        <span className="text-foreground">Sa</span>
        <span className="text-primary">lu</span>
        <span
          aria-hidden
          className={cn(
            '-translate-y-1 -right-2 absolute top-0 inline-block animate-breathe rounded-full bg-accent-foreground/60',
            dotSizes[size],
          )}
        />
      </span>
      {showTagline && (
        <span className="-mt-0.5 text-muted-foreground text-xs">el lugar de Salustiano</span>
      )}
    </div>
  );
}
