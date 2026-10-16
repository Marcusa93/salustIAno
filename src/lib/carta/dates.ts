const AR_TZ = 'America/Argentina/Buenos_Aires';
const DAY_MS = 24 * 60 * 60 * 1000;

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

function dayNumber({ year, month, day }: CalendarDay): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** Meses calendario cumplidos: del 4/5 al 4/6 es 1 mes, al 3/6 todavía 0. */
function fullMonthsBetween(from: CalendarDay, to: CalendarDay): number {
  const months = (to.year - from.year) * 12 + (to.month - from.month);
  return to.day >= from.day ? months : months - 1;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Edad de Salu en una fecha, contada en días calendario de Argentina y
 * con la voz de la carta: "Faltaban 10 días", "El día que nací",
 * "3 semanas", "2 meses".
 */
export function ageLabelAt(birthAt: string, at: string): string {
  const birth = calendarDayAr(new Date(birthAt));
  const moment = calendarDayAr(new Date(at));
  const days = dayNumber(moment) - dayNumber(birth);

  if (days < 0) {
    const left = Math.abs(days);
    return left === 1 ? 'Faltaba 1 día' : `Faltaban ${left} días`;
  }
  if (days === 0) return 'El día que nací';
  if (days < 14) return plural(days, 'día', 'días');

  const months = fullMonthsBetween(birth, moment);
  if (months < 1) return plural(Math.floor(days / 7), 'semana', 'semanas');
  return plural(months, 'mes', 'meses');
}

/** Fecha corta para el pie de las polaroids: "24 may". */
export function polaroidDateLabel(at: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: AR_TZ, day: 'numeric', month: 'short' })
    .format(new Date(at))
    .replace('.', '');
}

/** Días calendario (AR) desde el nacimiento, contando el día de hoy. */
export function daysSinceBirth(birthAt: string, now: Date = new Date()): number {
  return Math.max(0, dayNumber(calendarDayAr(now)) - dayNumber(calendarDayAr(new Date(birthAt))));
}

export function secondsSinceBirth(birthAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(birthAt)) / 1000));
}
