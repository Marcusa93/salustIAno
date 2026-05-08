import { durationLabel } from '@/lib/baby-age';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface QuickActionTileProps {
  Icon: LucideIcon;
  label: string;
  /**
   * Último evento del tipo. Si lo pasás, se muestra "Hace 1h 20min"
   * debajo del label.
   */
  lastAt?: string | null;
  /**
   * Cantidad hoy. Se muestra junto al label si > 0.
   */
  todayCount?: number;
  /**
   * Texto custom que pisa el cálculo automático de "Hace X". Útil para
   * casos especiales como sueño activo ("En curso").
   */
  microInfoOverride?: string;
  /**
   * Tono — el "primary" es la acción más cargada visualmente; los otros
   * son neutros. Se rota la prominencia según contexto en la page.
   */
  emphasis?: 'normal' | 'primary';
}

/**
 * Tile presentacional para los CTA de carga rápida del home. La page los
 * envuelve en los Sheet triggers (FeedingQuickAdd, SleepQuickAdd,
 * DiaperQuickAdd), o en un Link para "Momento". El componente NO maneja
 * estado — solo pinta.
 *
 * Diseño:
 *   - Icono circular grande arriba.
 *   - Label en negrita.
 *   - Micro-info: "Hace 1h 20m · 6 hoy" o solo una de las dos.
 *   - Press feedback: scale-down + sombra interna; en hover desktop
 *     levanta y ensombra el borde.
 */
export function QuickActionTile({
  Icon,
  label,
  lastAt,
  todayCount,
  microInfoOverride,
  emphasis = 'normal',
}: QuickActionTileProps) {
  const microParts: string[] = [];
  if (microInfoOverride) {
    microParts.push(microInfoOverride);
  } else if (lastAt) {
    microParts.push(`Hace ${durationLabel(lastAt)}`);
  }
  if (todayCount !== undefined && todayCount > 0) {
    microParts.push(`${todayCount} hoy`);
  }
  const micro = microParts.length > 0 ? microParts.join(' · ') : 'Sin registros hoy';

  return (
    <span
      className={cn(
        'group/qa relative flex h-full flex-col items-start justify-between gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left text-foreground shadow-sm transition-all duration-200',
        // Hover desktop + tap mobile.
        'hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:translate-y-0 active:scale-[0.97]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        emphasis === 'primary'
          ? 'border-primary/25 from-primary/[0.10] via-primary/[0.04] to-card'
          : 'border-border/60 from-card to-card/40',
      )}
    >
      {/* Sutil "ping" cuando se interactúa (visible solo en :active) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/0 transition-colors duration-200 group-active/qa:bg-primary/5"
      />
      <span className="relative flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-transform duration-200 group-hover/qa:scale-110 group-hover/qa:bg-primary/15 group-active/qa:scale-95">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="relative flex flex-col gap-0.5">
        <span className="font-medium text-foreground text-sm leading-tight">{label}</span>
        <span className="line-clamp-1 text-[11px] text-muted-foreground/90">{micro}</span>
      </span>
    </span>
  );
}
