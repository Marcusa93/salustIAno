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

export function SaluLogo({ size = 'default', className, showTagline = false }: SaluLogoProps) {
  return (
    <div className={cn('flex select-none flex-col', className)}>
      <span
        className={cn('font-semibold text-primary tracking-tight', sizes[size])}
        aria-label="Salu"
      >
        <span className="text-foreground">Sa</span>
        <span className="text-primary">lu</span>
      </span>
      {showTagline && (
        <span className="-mt-0.5 text-muted-foreground text-xs">el lugar de Salustiano</span>
      )}
    </div>
  );
}
