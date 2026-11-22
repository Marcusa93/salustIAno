import { cn } from '@/lib/utils';
import { Share } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Pasos para instalar Salu en iPhone/iPad (no hay prompt automático). En
 * iOS 26 el botón Compartir de Safari quedó dentro del menú "···".
 */
export function IosInstallSteps({
  finalStep,
  className,
}: {
  finalStep: ReactNode;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        'flex list-decimal flex-col gap-0.5 pl-4 text-muted-foreground text-xs leading-snug',
        className,
      )}
    >
      <li>
        Tocá <Share className="inline size-3.5 align-[-2px]" aria-hidden />{' '}
        <span className="font-medium text-foreground">Compartir</span> (si no lo ves, está en el
        menú ···).
      </li>
      <li>
        Elegí <span className="font-medium text-foreground">Agregar a inicio</span>.
      </li>
      <li>{finalStep}</li>
    </ol>
  );
}
