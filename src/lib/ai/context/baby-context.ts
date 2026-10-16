/**
 * Contexto del bebé que los agentes reciben ya digerido.
 *
 * El modelo calcula mal edades y diferencias horarias si le pasamos solo
 * fechas crudas. Estas funciones puras arman frases cortas y exactas
 * ("5 meses y 2 días (154 días)", "Última toma: hace 2 h 10 min (12:40)")
 * para que el agente las use tal cual.
 *
 * Todo lo que sale de acá va al prompt del modelo, nunca a `ai_logs`.
 *
 * Sin `import 'server-only'`: funciones puras, testeables.
 */

import { durationLabel } from '@/lib/baby-age';
import { formatTimeAr, startOfTodayAr } from '@/lib/format-ar';

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;
// Un sueño abierto hace más de esto casi seguro es un despertar que no se cargó.
const STALE_OPEN_SLEEP_MINUTES = 12 * 60;

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Edad en castellano con precisión de días.
 *
 *   describeAge(5)   → "5 días"
 *   describeAge(40)  → "5 semanas y 5 días (40 días)"
 *   describeAge(154) → "5 meses y 2 días (154 días)"
 *   describeAge(800) → "2 años y 2 meses (800 días)"
 *
 * Los meses son promedio (30,44 días), así que pueden diferir en un día
 * del calendario; el total de días entre paréntesis es exacto.
 */
export function describeAge(ageDays: number | null): string | null {
  if (ageDays === null || !Number.isFinite(ageDays)) return null;
  const days = Math.floor(ageDays);

  if (days < 0) return `todavía no nació (faltan ${plural(-days, 'día', 'días')})`;
  if (days === 0) return 'recién nacido (0 días)';
  if (days < 14) return plural(days, 'día', 'días');

  const total = `(${days} días)`;
  if (days < 56) {
    const weeks = Math.floor(days / 7);
    const rest = days % 7;
    const restLabel = rest > 0 ? ` y ${plural(rest, 'día', 'días')}` : '';
    return `${weeks} semanas${restLabel} ${total}`;
  }
  if (days < 730) {
    // +0,5 para que 365 días sea "12 meses" y no "11 meses y 31 días".
    const months = Math.floor((days + 0.5) / DAYS_PER_MONTH);
    const rest = days - Math.floor(months * DAYS_PER_MONTH);
    const restLabel = rest > 0 ? ` y ${plural(rest, 'día', 'días')}` : '';
    return `${plural(months, 'mes', 'meses')}${restLabel} ${total}`;
  }
  const years = Math.floor(days / DAYS_PER_YEAR);
  const months = Math.floor((days - years * DAYS_PER_YEAR) / DAYS_PER_MONTH);
  const monthsLabel = months > 0 ? ` y ${plural(months, 'mes', 'meses')}` : '';
  return `${plural(years, 'año', 'años')}${monthsLabel} ${total}`;
}

function arCalendarDate(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * Como `describeAge`, pero con meses de calendario contados en hora de
 * Argentina: si nació un 4, cumple mes cada 4. Es como cuenta la familia
 * y la pediatra. Para menos de 8 semanas o más de 2 años usa el mismo
 * formato que `describeAge`.
 *
 *   describeAgeFromBirth('2026-05-04', <16/10/2026 AR>) → "5 meses y 12 días (165 días)"
 */
export function describeAgeFromBirth(birthDate: string | null, now: Date): string | null {
  const match = birthDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate) : null;
  if (!match || Number.isNaN(now.getTime())) return null;
  const [by, bm, bd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const today = arCalendarDate(now);
  const totalDays = utcDay(today.year, today.month, today.day) - utcDay(by, bm, bd);
  if (totalDays < 56 || totalDays >= 730) return describeAge(totalDays);

  let months = (today.year - by) * 12 + (today.month - bm);
  if (today.day < bd) months -= 1;
  // Día del "cumplemes" anterior; si el mes es más corto (nació un 31), el último día.
  const anchorMonthIndex = bm - 1 + months;
  const anchorYear = by + Math.floor(anchorMonthIndex / 12);
  const anchorMonth = (anchorMonthIndex % 12) + 1;
  const lastDayOfAnchorMonth = new Date(Date.UTC(anchorYear, anchorMonth, 0)).getUTCDate();
  const anchorDay = Math.min(bd, lastDayOfAnchorMonth);
  const rest =
    utcDay(today.year, today.month, today.day) - utcDay(anchorYear, anchorMonth, anchorDay);
  const restLabel = rest > 0 ? ` y ${plural(rest, 'día', 'días')}` : '';
  return `${plural(months, 'mes', 'meses')}${restLabel} (${totalDays} días)`;
}

/**
 * Edad corregida para prematuros (< 37 semanas): la que usan las guías
 * pediátricas hasta los 2 años para hitos, sueño y alimentación. null si
 * no aplica.
 */
export function describeCorrectedAge(
  ageDays: number | null,
  gestationalWeeks: number | null,
): string | null {
  if (ageDays === null || gestationalWeeks === null || gestationalWeeks >= 37) return null;
  return describeAge(ageDays - (40 - gestationalWeeks) * 7);
}

/** Fila de `get_timeline` (solo los campos que usamos). */
export interface TimelineRow {
  event_type: string;
  occurred_at: string;
  payload: unknown;
}

function field(payload: unknown, key: string): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined;
  return (payload as Record<string, unknown>)[key];
}

function stringField(payload: unknown, key: string): string | null {
  const value = field(payload, key);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberField(payload: unknown, key: string): number | null {
  const value = field(payload, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function ago(iso: string, now: Date): string {
  const label = durationLabel(iso, now);
  return label === 'recién' ? 'recién' : `hace ${label}`;
}

function minutesBetween(fromIso: string, to: Date | string): number {
  const toMs = typeof to === 'string' ? new Date(to).getTime() : to.getTime();
  return Math.max(0, Math.round((toMs - new Date(fromIso).getTime()) / 60_000));
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const SIDE_LABELS: Record<string, string> = {
  left: 'izquierdo',
  right: 'derecho',
  both: 'ambos lados',
};

function describeFeeding(payload: unknown): string {
  const type = stringField(payload, 'type');
  const ml = numberField(payload, 'amount_ml');
  const minutes = numberField(payload, 'duration_minutes');
  if (type === 'bottle') return ml !== null ? `mamadera ${ml} ml` : 'mamadera';
  if (type === 'solid') return 'sólidos';
  if (type === 'breastfeeding') {
    const side = SIDE_LABELS[stringField(payload, 'side') ?? ''];
    const parts = ['pecho', side, minutes !== null ? `${minutes} min` : null];
    return parts.filter(Boolean).join(' ');
  }
  return 'toma';
}

const DIAPER_LABELS: Record<string, string> = {
  wet: 'pis',
  dirty: 'caca',
  both: 'pis y caca',
  dry: 'seco',
};

function byNewest(rows: ReadonlyArray<TimelineRow>, type: string): TimelineRow[] {
  return rows
    .filter((r) => r.event_type === type)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
}

/**
 * Resume las últimas 24 h de tomas, sueño y pañales en 1-4 líneas listas
 * para el prompt. Espera filas de `get_timeline` filtradas a esos tipos.
 */
export function summarizeRecentCare(rows: ReadonlyArray<TimelineRow>, now: Date): string[] {
  const feedings = byNewest(rows, 'feeding');
  const sleeps = byNewest(rows, 'sleep');
  const diapers = byNewest(rows, 'diaper');

  if (feedings.length === 0 && sleeps.length === 0 && diapers.length === 0) {
    return ['- Sin tomas, sueños ni pañales cargados en las últimas 24 h.'];
  }

  const lines: string[] = [];

  const openSleep = sleeps.find((s) => stringField(s.payload, 'ended_at') === null);
  const lastClosed = sleeps.find((s) => stringField(s.payload, 'ended_at') !== null);
  if (openSleep) {
    const kind = field(openSleep.payload, 'is_nap') === true ? 'siesta' : 'sueño de noche';
    const since = formatTimeAr(openSleep.occurred_at);
    const elapsed = minutesBetween(openSleep.occurred_at, now);
    const state =
      elapsed < 1 ? 'se acaba de dormir' : `durmiendo desde hace ${formatMinutes(elapsed)}`;
    lines.push(
      elapsed > STALE_OPEN_SLEEP_MINUTES
        ? `- Ahora: hay un sueño abierto desde las ${since} (${ago(openSleep.occurred_at, now)}); probablemente falta cargar el despertar.`
        : `- Ahora: ${state} (${kind}, desde las ${since}).`,
    );
  } else if (lastClosed) {
    const endedAt = stringField(lastClosed.payload, 'ended_at') ?? lastClosed.occurred_at;
    lines.push(
      `- Ahora: despierto; se despertó ${ago(endedAt, now)} (a las ${formatTimeAr(endedAt)}).`,
    );
  }

  const lastFeeding = feedings[0];
  if (lastFeeding) {
    lines.push(
      `- Última toma: ${ago(lastFeeding.occurred_at, now)} (${formatTimeAr(lastFeeding.occurred_at)}), ${describeFeeding(lastFeeding.payload)}.`,
    );
  }

  const lastDiaper = diapers[0];
  if (lastDiaper) {
    const type = DIAPER_LABELS[stringField(lastDiaper.payload, 'type') ?? ''] ?? 'pañal';
    lines.push(
      `- Último pañal: ${ago(lastDiaper.occurred_at, now)} (${formatTimeAr(lastDiaper.occurred_at)}), ${type}.`,
    );
  }

  const todayStartMs = startOfTodayAr(now).getTime();
  const isToday = (r: TimelineRow) => new Date(r.occurred_at).getTime() >= todayStartMs;
  const feedingsToday = feedings.filter(isToday);
  const sleepsToday = sleeps.filter(isToday);
  const diapersToday = diapers.filter(isToday);

  const bottleMl = feedingsToday.reduce(
    (sum, f) =>
      stringField(f.payload, 'type') === 'bottle'
        ? sum + (numberField(f.payload, 'amount_ml') ?? 0)
        : sum,
    0,
  );
  const sleepMinutes = sleepsToday.reduce((sum, s) => {
    const endedAt = stringField(s.payload, 'ended_at');
    if (endedAt) return sum + minutesBetween(s.occurred_at, endedAt);
    const elapsed = minutesBetween(s.occurred_at, now);
    // Un sueño abierto viejo no suma: inflaría el total con horas que no se durmieron.
    return elapsed > STALE_OPEN_SLEEP_MINUTES ? sum : sum + elapsed;
  }, 0);

  const feedingLabel = `${plural(feedingsToday.length, 'toma', 'tomas')}${bottleMl > 0 ? ` (${bottleMl} ml de mamadera)` : ''}`;
  const sleepLabel = `${plural(sleepsToday.length, 'sueño', 'sueños')}${sleepMinutes > 0 ? ` (${formatMinutes(sleepMinutes)})` : ''}`;
  const diaperLabel = plural(diapersToday.length, 'pañal', 'pañales');
  lines.push(`- Hoy desde las 00:00: ${feedingLabel}, ${sleepLabel}, ${diaperLabel}.`);

  return lines;
}
