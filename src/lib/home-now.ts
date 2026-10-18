import type { WakeWindow } from '@/lib/wake-windows';

/**
 * Cálculos del bloque "Ahora" del inicio: cuánto pasó desde cada cosa, la
 * edad exacta y en qué punto de la ventana de vigilia está Salu. Todo puro
 * y con `now` inyectable para testear.
 */

const AR_TZ = 'America/Argentina/Buenos_Aires';
const MINUTE_MS = 60_000;

export interface DurationParts {
  hours: number;
  minutes: number;
  totalMinutes: number;
}

/** Horas y minutos transcurridos desde `fromISO`. Nunca negativo. */
export function elapsedParts(fromISO: string, now: Date = new Date()): DurationParts {
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - Date.parse(fromISO)) / MINUTE_MS));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60, totalMinutes };
}

/**
 * La base rechaza sueños de 24 h o más (`sleep_sessions_max_duration`). Un
 * sueño abierto hace tanto es casi seguro un olvido: ya no se puede cerrar
 * "ahora" y hay que preguntar a qué hora se despertó de verdad.
 */
export const MAX_SLEEP_MINUTES = 24 * 60;

export function isOverdueSleep(startedISO: string, now: Date = new Date()): boolean {
  return elapsedParts(startedISO, now).totalMinutes >= MAX_SLEEP_MINUTES;
}

/**
 * Hora que propone el formulario de "se despertó": ahora, salvo que el
 * sueño quedó abierto de más; ahí una hora después de que empezó (válida
 * para la base, y obviamente para ajustar).
 */
export function suggestedWakeTime(startedISO: string, now: Date = new Date()): Date {
  if (!isOverdueSleep(startedISO, now)) return now;
  return new Date(Date.parse(startedISO) + 60 * MINUTE_MS);
}

/** "recién", "hace 12 min", "hace 2 h 5 min", "hace 2 días" y, pasada la semana, "el 14 jul". */
export function sinceLabel(fromISO: string, now: Date = new Date()): string {
  const { hours, minutes, totalMinutes } = elapsedParts(fromISO, now);
  if (totalMinutes < 1) return 'recién';
  if (hours === 0) return `hace ${minutes} min`;
  if (hours < 24) return minutes === 0 ? `hace ${hours} h` : `hace ${hours} h ${minutes} min`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  const date = new Intl.DateTimeFormat('es-AR', { timeZone: AR_TZ, day: 'numeric', month: 'short' })
    .format(new Date(fromISO))
    .replace('.', '');
  return `el ${date}`;
}

/** Si algo pasó hace tanto que ya no sirve como referencia del día (48 h). */
export function isStale(fromISO: string, now: Date = new Date()): boolean {
  return elapsedParts(fromISO, now).totalMinutes > 48 * 60;
}

interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

function calendarDayAr(date: Date): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayNumber({ year, month, day }: CalendarDay): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Edad exacta en calendario argentino: "12 días", "3 semanas y 2 días",
 * "5 meses y 12 días", "1 año y 2 meses". `birthDate` es 'YYYY-MM-DD'.
 */
export function preciseAgeLabel(birthDate: string, now: Date = new Date()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!match) return null;
  const birth = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const today = calendarDayAr(now);
  const todayNumber = dayNumber(today);
  if (todayNumber < dayNumber(birth)) return null;

  // Cumple-mes número `m`: mismo día que el nacimiento o, en meses más
  // cortos, el último día (del 31/1 se pasa al 28/2).
  const monthiversary = (m: number): number => {
    const index = birth.month - 1 + m;
    const year = birth.year + Math.floor(index / 12);
    const month = (index % 12) + 1;
    return dayNumber({ year, month, day: Math.min(birth.day, daysInMonth(year, month)) });
  };
  let months = (today.year - birth.year) * 12 + (today.month - birth.month);
  while (months > 0 && monthiversary(months) > todayNumber) months -= 1;
  const days = todayNumber - monthiversary(months);

  if (months === 0) {
    if (days < 14) return plural(days, 'día', 'días');
    const weeks = Math.floor(days / 7);
    const rest = days % 7;
    return rest === 0
      ? plural(weeks, 'semana', 'semanas')
      : `${plural(weeks, 'semana', 'semanas')} y ${plural(rest, 'día', 'días')}`;
  }
  if (months < 24) {
    const base = plural(months, 'mes', 'meses');
    return days === 0 ? base : `${base} y ${plural(days, 'día', 'días')}`;
  }
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const base = plural(years, 'año', 'años');
  return restMonths === 0 ? base : `${base} y ${plural(restMonths, 'mes', 'meses')}`;
}

export type WakeStatus = 'early' | 'ideal' | 'late';

export interface WakeProgress {
  /** 0 al despertarse, 1 al final de la ventana ideal (puede pasarse de 1). */
  fraction: number;
  status: WakeStatus;
  /** Dónde empieza la ventana ideal, en la misma escala que `fraction`. */
  idealStart: number;
}

/** En qué punto de la ventana de vigilia recomendada está el bebé. */
export function wakeProgress(
  lastWokeUpAt: string,
  window: WakeWindow,
  now: Date = new Date(),
): WakeProgress {
  const { totalMinutes } = elapsedParts(lastWokeUpAt, now);
  const status: WakeStatus =
    totalMinutes < window.minMinutes
      ? 'early'
      : totalMinutes <= window.maxMinutes
        ? 'ideal'
        : 'late';
  return {
    fraction: totalMinutes / window.maxMinutes,
    status,
    idealStart: window.minMinutes / window.maxMinutes,
  };
}

/** Si dormirse ahora sería siesta o la noche (19 a 7 hs de Argentina = noche). */
export function sleepKindAt(now: Date = new Date()): 'nap' | 'night' {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: AR_TZ, hour: '2-digit', hourCycle: 'h23' }).format(
      now,
    ),
  );
  return hour >= 19 || hour < 7 ? 'night' : 'nap';
}
