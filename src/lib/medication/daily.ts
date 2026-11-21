/**
 * Remedios de todos los días (hierro, vitamina D…).
 *
 * No hay tabla de "tratamientos": un remedio es diario cuando su última
 * dosis se cargó con intervalo de ~24 h. A partir de las dosis armamos,
 * por remedio, qué días se dio, cuáles faltaron y si hoy ya se dio. Todo
 * en días de Argentina, que es como lo vive la familia.
 */

const AR_TZ = 'America/Argentina/Buenos_Aires';

/** Si no se da hace más de estos días, el tratamiento se da por terminado. */
const ACTIVE_WINDOW_DAYS = 4;

/** Un corte de más de estos días entre dosis separa dos tratamientos. */
const COURSE_GAP_DAYS = 7;

export interface DailyDoseRow {
  id: string;
  medication_name: string;
  dose_amount: string | null;
  given_at: string;
  interval_hours: number | null;
  created_by?: string | null;
  notes?: string | null;
  next_dose_at?: string | null;
}

export type DailyDayStatus = 'given' | 'double' | 'missed' | 'pending';

export interface DailyDay {
  /** YYYY-MM-DD en hora Argentina. */
  key: string;
  status: DailyDayStatus;
  doses: DailyDoseRow[];
}

export interface DailyCourse {
  name: string;
  doseAmount: string | null;
  /** Última dosis cargada: sirve de molde para "Se lo di". */
  latestDoseId: string;
  /** Día en que empezó el tratamiento (YYYY-MM-DD AR). */
  startKey: string;
  /** Hoy es el día N del tratamiento (el primer día es 1). */
  dayNumber: number;
  /** Dosis de hoy, de la más vieja a la más nueva. */
  today: DailyDoseRow[];
  /** Días con al menos una dosis, desde el inicio. */
  daysGiven: number;
  /** Días que ya tendrían que tener dosis (hoy cuenta solo si ya se dio). */
  daysDue: number;
  /** Últimos días del tratamiento (como mucho `windowDays`), del más viejo a hoy. */
  days: DailyDay[];
}

/** ~24 h, con margen por si alguien cargó 23 o 25. */
export function isDailyInterval(hours: number | null | undefined): boolean {
  return hours != null && hours >= 20 && hours <= 28;
}

/** Día calendario en Argentina (YYYY-MM-DD). */
export function dayKeyAr(value: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function addDaysToKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function daysBetweenKeys(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('es');
}

/**
 * Arma un tratamiento por cada remedio diario activo. `doses` puede venir
 * en cualquier orden y mezclar remedios; conviene traer ~45 días.
 */
export function buildDailyCourses(
  doses: DailyDoseRow[],
  now: Date = new Date(),
  windowDays = 14,
): DailyCourse[] {
  const todayKey = dayKeyAr(now);

  const groups = new Map<string, DailyDoseRow[]>();
  for (const dose of doses) {
    const key = normalizeName(dose.medication_name);
    const list = groups.get(key) ?? [];
    list.push(dose);
    groups.set(key, list);
  }

  const courses: DailyCourse[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.given_at.localeCompare(b.given_at));
    const latest = sorted.at(-1);
    if (!latest || !isDailyInterval(latest.interval_hours)) continue;

    const latestKey = dayKeyAr(latest.given_at);
    if (daysBetweenKeys(latestKey, todayKey) > ACTIVE_WINDOW_DAYS) continue;

    // Inicio: la primera dosis después del último corte largo.
    let startIndex = 0;
    for (let i = sorted.length - 1; i > 0; i--) {
      const gap = daysBetweenKeys(
        dayKeyAr((sorted[i - 1] as DailyDoseRow).given_at),
        dayKeyAr((sorted[i] as DailyDoseRow).given_at),
      );
      if (gap > COURSE_GAP_DAYS) {
        startIndex = i;
        break;
      }
    }
    const course = sorted.slice(startIndex);
    const startKey = dayKeyAr((course[0] as DailyDoseRow).given_at);

    const byDay = new Map<string, DailyDoseRow[]>();
    for (const dose of course) {
      const key = dayKeyAr(dose.given_at);
      const list = byDay.get(key) ?? [];
      list.push(dose);
      byDay.set(key, list);
    }

    // Una dosis cargada "para mañana" no debería pasar, pero si pasa no
    // rompe el conteo: solo miramos hasta hoy.
    const today = byDay.get(todayKey) ?? [];
    const dayNumber = Math.max(1, daysBetweenKeys(startKey, todayKey) + 1);
    let daysGiven = 0;
    for (const key of byDay.keys()) {
      if (key <= todayKey) daysGiven++;
    }
    const daysDue = today.length > 0 ? dayNumber : dayNumber - 1;

    const firstShown = Math.max(0, dayNumber - windowDays);
    const days: DailyDay[] = [];
    for (let i = firstShown; i < dayNumber; i++) {
      const key = addDaysToKey(startKey, i);
      const dayDoses = byDay.get(key) ?? [];
      let status: DailyDayStatus;
      if (dayDoses.length >= 2) status = 'double';
      else if (dayDoses.length === 1) status = 'given';
      else status = key === todayKey ? 'pending' : 'missed';
      days.push({ key, status, doses: dayDoses });
    }

    courses.push({
      name: latest.medication_name.trim(),
      doseAmount: latest.dose_amount,
      latestDoseId: latest.id,
      startKey,
      dayNumber,
      today,
      daysGiven,
      daysDue,
      days,
    });
  }

  // Primero lo que falta dar hoy.
  return courses.sort((a, b) => {
    const pendingA = a.today.length === 0 ? 0 : 1;
    const pendingB = b.today.length === 0 ? 0 : 1;
    return pendingA - pendingB || a.name.localeCompare(b.name, 'es');
  });
}

/** Escapa `%` y `_` para usar un nombre en un `ilike` exacto. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
