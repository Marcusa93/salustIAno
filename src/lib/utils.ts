import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind manejando conflictos correctamente.
 * Uso preferido a través de toda la app para construir classNames condicionales.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
