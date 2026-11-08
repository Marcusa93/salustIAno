/**
 * Lógica de /anotar/[tipo], la pantalla a la que llevan los atajos del
 * ícono instalado (Anotar toma / sueño / pañal).
 */

export const QUICK_LOG_KINDS = ['toma', 'sueno', 'panal'] as const;
export type QuickLogKind = (typeof QUICK_LOG_KINDS)[number];

export function parseQuickLogKind(value: string): QuickLogKind | null {
  return (QUICK_LOG_KINDS as readonly string[]).includes(value) ? (value as QuickLogKind) : null;
}

export const DEFAULT_BOTTLE_PRESETS_ML = [60, 90, 120] as const;

/**
 * Tres cantidades de mamadera para botones de un toque: las más frecuentes
 * en las tomas recientes, completadas con defaults si hay menos de tres.
 * Mismo criterio que la barra rápida de la home.
 */
export function getBottlePresets(
  recentAmountsMl: ReadonlyArray<number | null>,
  defaults: ReadonlyArray<number> = DEFAULT_BOTTLE_PRESETS_ML,
): number[] {
  const frequency = new Map<number, number>();
  for (const ml of recentAmountsMl) {
    if (typeof ml !== 'number' || !Number.isFinite(ml) || ml <= 0) continue;
    frequency.set(ml, (frequency.get(ml) ?? 0) + 1);
  }
  const presets = Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([ml]) => ml);
  for (const ml of defaults) {
    if (presets.length >= 3) break;
    if (!presets.includes(ml)) presets.push(ml);
  }
  return presets.sort((a, b) => a - b);
}
