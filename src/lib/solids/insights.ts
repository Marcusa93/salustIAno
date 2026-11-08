/**
 * Señales del cuerpo alrededor de la comida: cómo avanzan las texturas,
 * qué pasa con la caca y si la leche se mantiene desde que empezó con
 * sólidos. Todo puro: recibe filas ya cargadas y devuelve números y, si
 * corresponde, un mensaje corto para la familia.
 */

import { arDateKey, daysBetween } from './progress';
import type { FoodFormat, Meal } from './types';

const DAY_MS = 86_400_000;

export type InsightTone = 'ok' | 'info' | 'warn';

export interface Insight {
  tone: InsightTone;
  title: string;
  text: string;
}

// ─── Texturas ────────────────────────────────────────────────────────────────

export type TextureLevel = 1 | 2 | 3;

/** Cuánta textura tiene cada formato: lisa, espesa/pisada o trozos. */
export const TEXTURE_LEVEL: Record<FoodFormat, TextureLevel> = {
  puree: 1,
  mashed: 2,
  preloaded: 2,
  finger: 3,
};

export const TEXTURE_LABELS: Record<TextureLevel, string> = {
  1: 'Papilla lisa',
  2: 'Pisado o espeso',
  3: 'Trozos con la mano',
};

export interface TextureWeek {
  /** 0 = la semana en que empezó. */
  index: number;
  counts: Record<TextureLevel, number>;
  total: number;
}

export interface TextureProgress {
  /** Hasta las últimas 8 semanas, sin huecos. */
  weeks: TextureWeek[];
  /** La textura más avanzada que come seguido en las últimas 2 semanas. */
  stage: TextureLevel | null;
  insight: Insight | null;
}

const emptyCounts = (): Record<TextureLevel, number> => ({ 1: 0, 2: 0, 3: 0 });

export function textureProgress(
  meals: readonly Meal[],
  { ageMonths, now }: { ageMonths: number; now: Date },
): TextureProgress {
  const tastings = meals.flatMap((m) => m.tastings).filter((t) => t.format !== null);
  if (tastings.length === 0) return { weeks: [], stage: null, insight: null };

  const startAt = tastings.reduce(
    (min, t) => (t.occurredAt < min ? t.occurredAt : min),
    tastings[0]?.occurredAt ?? now.toISOString(),
  );
  const currentWeek = Math.max(0, Math.floor(daysBetween(startAt, now) / 7));
  const firstWeek = Math.max(0, currentWeek - 7);

  const byWeek = new Map<number, Record<TextureLevel, number>>();
  const recent = emptyCounts();
  for (const t of tastings) {
    const level = TEXTURE_LEVEL[t.format as FoodFormat];
    const week = Math.floor(daysBetween(startAt, t.occurredAt) / 7);
    const counts = byWeek.get(week) ?? emptyCounts();
    counts[level] += 1;
    byWeek.set(week, counts);
    if (daysBetween(t.occurredAt, now) < 14) recent[level] += 1;
  }

  const weeks: TextureWeek[] = [];
  for (let i = firstWeek; i <= currentWeek; i++) {
    const counts = byWeek.get(i) ?? emptyCounts();
    weeks.push({ index: i, counts, total: counts[1] + counts[2] + counts[3] });
  }

  const recentTotal = recent[1] + recent[2] + recent[3];
  let stage: TextureLevel | null = null;
  if (recentTotal > 0) {
    // "Lo come seguido": al menos 2 veces y un 20% de lo que comió.
    const threshold = Math.max(2, Math.ceil(recentTotal * 0.2));
    if (recent[3] >= threshold) stage = 3;
    else if (recent[2] >= threshold) stage = 2;
    else if (recent[1] > 0) stage = 1;
    // Pocas comidas y ninguna papilla: lo que haya probado.
    else stage = recent[2] > 0 ? 2 : 3;
  }

  return { weeks, stage, insight: textureInsight(stage, ageMonths, currentWeek) };
}

function textureInsight(
  stage: TextureLevel | null,
  ageMonths: number,
  weeksSinceStart: number,
): Insight | null {
  if (stage === null) return null;
  if (stage === 3) {
    return {
      tone: 'ok',
      title: 'Ya agarra trozos con la mano',
      text: 'Eso entrena la masticación, la coordinación y la autonomía. Seguí alternando texturas.',
    };
  }
  if (stage === 2) {
    return ageMonths >= 8
      ? {
          tone: 'info',
          title: 'Sumá trozos para agarrar',
          text: 'Ya come pisado. Probá palitos blandos que pueda tomar con la mano: banana, brócoli cocido, batata. Antes de los 9 meses se aceptan más fácil.',
        }
      : {
          tone: 'ok',
          title: 'Va bien con las texturas',
          text: 'Ya come pisado o espeso. Cuando lo maneje, sumá trozos blandos para que agarre solo.',
        };
  }
  if (ageMonths >= 8) {
    return {
      tone: 'warn',
      title: 'Conviene avanzar con las texturas',
      text: 'Todavía come casi todo en papilla lisa. Antes de los 9 meses conviene sumar grumos y trozos blandos: después suelen costar más.',
    };
  }
  if (ageMonths >= 7 || weeksSinceStart >= 2) {
    return {
      tone: 'info',
      title: 'Probá el próximo paso',
      text: 'Cuando la papilla lisa le salga bien, pisá con tenedor en vez de procesar: los grumos se aprenden de a poco.',
    };
  }
  return null;
}

// ─── Ventanas de días ────────────────────────────────────────────────────────

function solidsStart(meals: readonly Meal[]): string | null {
  let start: string | null = null;
  for (const m of meals) if (!start || m.occurredAt < start) start = m.occurredAt;
  return start;
}

/** Los 7 días anteriores al primer día de sólidos. */
function daysBefore(start: string): string[] {
  const base = Date.parse(start);
  return Array.from({ length: 7 }, (_, i) => arDateKey(new Date(base - (i + 1) * DAY_MS)));
}

/** Hasta 7 días completos (de ayer para atrás) desde que empezó con sólidos. */
function completeDaysSince(start: string, now: Date): string[] {
  const startKey = arDateKey(start);
  const days: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const key = arDateKey(new Date(now.getTime() - i * DAY_MS));
    if (key < startKey) break;
    days.push(key);
  }
  return days;
}

/** Mínimo de días con datos para comparar sin sacar conclusiones apuradas. */
const MIN_BEFORE_DAYS = 4;
const MIN_RECENT_DAYS = 3;

/** De esos días, los que tienen al menos una fila anotada. */
function loggedDays(
  days: readonly string[],
  rows: readonly { occurred_at: string }[],
): Set<string> {
  const wanted = new Set(days);
  const logged = new Set<string>();
  for (const r of rows) {
    const key = arDateKey(r.occurred_at);
    if (wanted.has(key)) logged.add(key);
  }
  return logged;
}

// ─── Caca ────────────────────────────────────────────────────────────────────

export interface DiaperRow {
  occurred_at: string;
  type: 'wet' | 'dirty' | 'both' | 'dry';
}

export interface DiaperSignal {
  lastPoopAt: string | null;
  /** Días enteros desde la última caca. */
  daysWithoutPoop: number | null;
  /** Cacas por día la semana antes de empezar (null si no se anotaban pañales). */
  beforePerDay: number | null;
  /** Cacas por día desde que empezó (null si todavía no hay días suficientes). */
  recentPerDay: number | null;
  /** Alimentos nuevos de las últimas 72 horas, por si hay que relacionar. */
  newFoods: string[];
  insight: Insight | null;
}

export function diaperSignal(
  diapers: readonly DiaperRow[],
  meals: readonly Meal[],
  now: Date,
): DiaperSignal | null {
  const start = solidsStart(meals);
  if (!start) return null;

  const isPoop = (d: DiaperRow) => d.type === 'dirty' || d.type === 'both';
  const poops = diapers.filter(isPoop);
  const lastPoopAt = poops.reduce<string | null>(
    (max, d) => (!max || d.occurred_at > max ? d.occurred_at : max),
    null,
  );
  const daysWithoutPoop = lastPoopAt
    ? Math.floor((now.getTime() - Date.parse(lastPoopAt)) / DAY_MS)
    : null;

  const perDay = (days: string[], minDays: number): number | null => {
    // Un día sin ningún pañal anotado no es "cero cacas": no se sabe.
    const logged = loggedDays(days, diapers);
    if (logged.size < minDays) return null;
    const count = poops.filter((d) => logged.has(arDateKey(d.occurred_at))).length;
    return Math.round((count / logged.size) * 10) / 10;
  };

  const beforePerDay = perDay(daysBefore(start), MIN_BEFORE_DAYS);
  const recentPerDay = perDay(completeDaysSince(start, now), MIN_RECENT_DAYS);

  const firstSeen = new Map<string, { name: string; at: string }>();
  for (const m of meals) {
    for (const t of m.tastings) {
      const prev = firstSeen.get(t.foodKey);
      if (!prev || t.occurredAt < prev.at) {
        firstSeen.set(t.foodKey, { name: t.foodName, at: t.occurredAt });
      }
    }
  }
  const since = now.getTime() - 3 * DAY_MS;
  const newFoods = [...firstSeen.values()]
    .filter((f) => Date.parse(f.at) >= since)
    .map((f) => f.name);

  // Solo hablamos de "días sin caca" si se vienen anotando pañales.
  const loggingDiapers = diapers.some(
    (d) => now.getTime() - Date.parse(d.occurred_at) < 2 * DAY_MS,
  );

  let insight: Insight | null = null;
  if (loggingDiapers && daysWithoutPoop !== null && daysWithoutPoop >= 3) {
    insight = {
      tone: 'warn',
      title: `Hace ${daysWithoutPoop} días sin caca`,
      text: 'Al empezar con sólidos pasa seguido. Ofrecele agua en las comidas y frutas como pera, ciruela o durazno. Si está dura, le duele o tiene sangre, consultá con la pediatra.',
    };
  } else if (
    beforePerDay !== null &&
    recentPerDay !== null &&
    beforePerDay >= 1 &&
    recentPerDay <= beforePerDay * 0.5
  ) {
    insight = {
      tone: 'info',
      title: 'Hace menos caca que antes',
      text: `Antes de empezar hacía ${formatNumber(beforePerDay)} por día y ahora ${formatNumber(recentPerDay)}. Es un cambio común con los sólidos; si además está dura o le cuesta, sumá agua y frutas con fibra.`,
    };
  }

  return { lastPoopAt, daysWithoutPoop, beforePerDay, recentPerDay, newFoods, insight };
}

// ─── Leche ───────────────────────────────────────────────────────────────────

export interface MilkRow {
  occurred_at: string;
  type: 'breastfeeding' | 'bottle' | 'solid';
  amount_ml: number | null;
}

export interface MilkWindow {
  /** Promedios por día. */
  bottleMl: number;
  bottles: number;
  breastfeeds: number;
}

export interface MilkBalance {
  before: MilkWindow | null;
  recent: MilkWindow | null;
  /** Cambio relativo de la leche principal (mamadera en ml o tomas de pecho). */
  change: number | null;
  insight: Insight | null;
}

/** Bajó más de esto respecto de antes de empezar: vale la pena avisar. */
export const MILK_DROP_ALERT = 0.25;

export function milkBalance(
  milk: readonly MilkRow[],
  meals: readonly Meal[],
  now: Date,
): MilkBalance | null {
  const start = solidsStart(meals);
  if (!start) return null;

  const liquid = milk.filter((r) => r.type !== 'solid');
  const window = (days: string[], minDays: number): MilkWindow | null => {
    // Solo los días en que se anotó alguna toma: los demás no se saben.
    const logged = loggedDays(days, liquid);
    if (logged.size < minDays) return null;
    const rows = liquid.filter((r) => logged.has(arDateKey(r.occurred_at)));
    const bottles = rows.filter((r) => r.type === 'bottle');
    const ml = bottles.reduce((sum, r) => sum + (r.amount_ml ?? 0), 0);
    const n = logged.size;
    return {
      bottleMl: Math.round(ml / n),
      bottles: Math.round((bottles.length / n) * 10) / 10,
      breastfeeds:
        Math.round((rows.filter((r) => r.type === 'breastfeeding').length / n) * 10) / 10,
    };
  };

  const before = window(daysBefore(start), MIN_BEFORE_DAYS);
  const recent = window(completeDaysSince(start, now), MIN_RECENT_DAYS);
  if (!before || !recent) return { before, recent, change: null, insight: null };

  // La leche "principal" es la que más pesaba antes de empezar.
  const bottleChange = before.bottleMl >= 100 ? recent.bottleMl / before.bottleMl - 1 : null;
  const breastChange = before.breastfeeds >= 2 ? recent.breastfeeds / before.breastfeeds - 1 : null;
  const changes = [bottleChange, breastChange].filter((c): c is number => c !== null);
  if (changes.length === 0) return { before, recent, change: null, insight: null };
  const change = Math.min(...changes);

  const what = change === bottleChange ? 'mamadera' : 'pecho';
  const insight: Insight =
    change <= -MILK_DROP_ALERT
      ? {
          tone: 'warn',
          title: 'Toma menos leche que antes',
          text: `Desde que empezó con sólidos toma un ${Math.round(-change * 100)}% menos de ${what}. Hasta el año la leche sigue siendo lo principal: ofrecésela antes de la comida o separada, no en lugar de.`,
        }
      : {
          tone: 'ok',
          title: 'La leche se mantiene',
          text: 'Toma parecido a antes de empezar con sólidos. Así tiene que ser: hasta el año la comida suma, no reemplaza.',
        };

  return { before, recent, change, insight };
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}
