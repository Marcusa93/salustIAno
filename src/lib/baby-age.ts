import { chronologicalAgeDays } from '@/lib/validators/child-profile';

export interface BabyAge {
  days: number;
  weeks: number;
  months: number;
  /**
   * Etiqueta corta en español rioplatense, ej. "3 meses", "5 semanas",
   * "12 días". Para fechas previas al nacimiento devuelve "Falta(n) X día(s)".
   */
  label: string;
  /**
   * `true` si el bebé todavía no nació (fecha esperada en el futuro).
   */
  unborn: boolean;
}

export function babyAgeFromBirth(birthDate: string | null, now: Date = new Date()): BabyAge | null {
  if (!birthDate) return null;
  const days = chronologicalAgeDays(birthDate, now);
  if (days === null) return null;

  const unborn = days < 0;
  const absDays = Math.abs(days);
  const weeks = Math.floor(absDays / 7);
  const months = Math.floor(absDays / 30);

  return {
    days,
    weeks: unborn ? -weeks : weeks,
    months: unborn ? -months : months,
    label: ageLabel(days),
    unborn,
  };
}

function ageLabel(days: number): string {
  if (days < 0) {
    const abs = Math.abs(days);
    return `Falta${abs === 1 ? '' : 'n'} ${abs} día${abs === 1 ? '' : 's'}`;
  }
  if (days < 7) return `${days} día${days === 1 ? '' : 's'}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} semana${weeks === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} mes${months === 1 ? '' : 'es'}`;
  const years = Math.floor(days / 365);
  return `${years} año${years === 1 ? '' : 's'}`;
}

/**
 * Calcula horas/minutos transcurridos entre dos timestamps. Usado para
 * mostrar "hace 1 h 20 min" en el tracker de sueño.
 */
export function durationLabel(fromISO: string, toISO: string | Date = new Date()): string {
  const from = new Date(fromISO).getTime();
  const to = typeof toISO === 'string' ? new Date(toISO).getTime() : toISO.getTime();
  const ms = Math.max(0, to - from);
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return 'recién';
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
