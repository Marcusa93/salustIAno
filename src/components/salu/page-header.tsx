import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Texto chiquito uppercase encima del título — sirve como categoría/contexto. */
  eyebrow?: string;
  /** Título grande tipográfico — usa la `font-display` (Fraunces). */
  title: string;
  /** Descripción opcional debajo, en text-muted. */
  description?: string;
  /** Slot a la derecha del header — botones, links, badges, etc. */
  action?: ReactNode;
  className?: string;
}

/**
 * Header de página unificado para todas las rutas de `(app)`. Asegura jerarquía
 * tipográfica consistente: eyebrow → title clamp → descripción opcional. El
 * action queda alineado a la derecha cuando hay espacio (en mobile baja debajo
 * del título por flex-wrap).
 *
 * Eyebrow → 11px uppercase tracking-[0.22em] muted/80
 * Title   → clamp(2rem, 5vw, 3.5rem) font-display
 * Desc    → text-base/sm:text-lg muted, max-w-md
 */
export function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn('animate-stagger-up flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          {eyebrow && (
            <span className="font-medium text-muted-foreground/80 text-[11px] uppercase tracking-[0.22em]">
              {eyebrow}
            </span>
          )}
          <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] text-foreground leading-[1.05] tracking-tight">
            {title}
          </h1>
        </div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
      {description && (
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">{description}</p>
      )}
    </header>
  );
}
