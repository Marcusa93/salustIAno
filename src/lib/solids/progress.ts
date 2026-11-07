/**
 * Motor de la alimentación complementaria: arma las comidas a partir de la
 * base, cuenta cuántas veces probó cada alimento, sigue los alérgenos y
 * sugiere qué ofrecer después. Todo puro (sin I/O) para poder testearlo.
 */

import {
  ALLERGEN_FIRST_FOOD,
  ALLERGEN_LABELS,
  FOODS,
  FOOD_BY_KEY,
  FOOD_GROUP_LABELS,
  matchFood,
  normalizeFoodName,
} from './catalog';
import type {
  AllergenKey,
  Food,
  FoodAcceptance,
  FoodColor,
  FoodFormat,
  FoodGroup,
  FoodReaction,
  Meal,
  ReactionSign,
  SolidMethod,
  Tasting,
} from './types';

const DAY_MS = 86_400_000;
const AR_TZ = 'America/Argentina/Buenos_Aires';

/** Veces que suele hacer falta ofrecer un alimento hasta que lo acepte. */
export const REOFFER_TARGET = 15;
/** Meta opcional y popular: 100 alimentos distintos antes del año. */
export const FOOD_GOAL = 100;

export const CUSTOM_PREFIX = 'otro:';

const REACTION_RANK: Record<FoodReaction, number> = { none: 0, mild: 1, strong: 2 };

const VALID_SIGNS: ReadonlySet<string> = new Set<ReactionSign>([
  'boca_roja',
  'ronchas',
  'hinchazon',
  'vomitos',
  'diarrea',
  'tos',
  'respirar',
]);

export const ALLERGEN_ORDER: readonly AllergenKey[] = [
  'huevo',
  'mani',
  'leche',
  'trigo',
  'pescado',
  'sesamo',
  'frutos_secos',
  'soja',
  'mariscos',
];

/** Primeros alimentos: suaves, fáciles de preparar en papilla o en bastones. */
const STARTERS: readonly string[] = [
  'zapallo',
  'batata',
  'palta',
  'zanahoria',
  'banana',
  'carne',
  'zapallito',
  'pera',
  'brocoli',
  'pollo',
  'papa',
  'manzana',
  'lentejas',
  'avena',
];

// ---------------------------------------------------------------------------
// Alimentos
// ---------------------------------------------------------------------------

export function customFoodKey(name: string): string {
  const slug = normalizeFoodName(name).replace(/\s+/g, '_');
  return `${CUSTOM_PREFIX}${slug}`.slice(0, 120);
}

/** De lo que escribió la familia a un alimento del catálogo (o uno propio). */
export function resolveFood(input: string): { key: string; name: string; food: Food | null } {
  const food = matchFood(input);
  if (food) return { key: food.key, name: food.name, food };
  const name = input.trim().replace(/\s+/g, ' ');
  return { key: customFoodKey(name), name: capitalize(name), food: null };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function foodFor(key: string): Food | null {
  return FOOD_BY_KEY.get(key) ?? null;
}

// ---------------------------------------------------------------------------
// Comidas
// ---------------------------------------------------------------------------

export interface SolidEventRow {
  id: string;
  occurred_at: string;
  foods: string[] | null;
  reaction: FoodReaction;
  notes: string | null;
}

export interface TastingRow {
  id: string;
  feeding_event_id: string;
  food_key: string;
  food_name: string;
  format: FoodFormat | null;
  acceptance: FoodAcceptance | null;
  amount: Tasting['amount'];
  gagged: boolean;
  reaction: FoodReaction;
  reaction_signs: string[] | null;
  position: number;
}

/**
 * Junta los feeding_events sólidos con sus alimentos. Las comidas viejas
 * (anotadas antes de que existiera el detalle) traen solo `foods`: se
 * reconocen contra el catálogo y la reacción de la comida se le atribuye a
 * cada alimento, del lado seguro.
 */
export function buildMeals(events: readonly SolidEventRow[], rows: readonly TastingRow[]): Meal[] {
  const byEvent = new Map<string, TastingRow[]>();
  for (const row of rows) {
    const list = byEvent.get(row.feeding_event_id) ?? [];
    list.push(row);
    byEvent.set(row.feeding_event_id, list);
  }

  return [...events]
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((event) => {
      const own = (byEvent.get(event.id) ?? []).sort((a, b) => a.position - b.position);
      const tastings: Tasting[] =
        own.length > 0
          ? own.map((row) => ({
              id: row.id,
              mealId: event.id,
              occurredAt: event.occurred_at,
              foodKey: row.food_key,
              foodName: row.food_name,
              format: row.format,
              acceptance: row.acceptance,
              amount: row.amount,
              gagged: row.gagged,
              reaction: row.reaction,
              reactionSigns: (row.reaction_signs ?? []).filter((s): s is ReactionSign =>
                VALID_SIGNS.has(s),
              ),
            }))
          : (event.foods ?? [])
              .filter((name) => name.trim().length > 0)
              .map((name, i) => {
                const resolved = resolveFood(name);
                return {
                  id: `legacy:${event.id}:${i}`,
                  mealId: event.id,
                  occurredAt: event.occurred_at,
                  foodKey: resolved.key,
                  foodName: resolved.name,
                  format: null,
                  acceptance: null,
                  amount: null,
                  gagged: false,
                  reaction: event.reaction,
                  reactionSigns: [],
                };
              });
      return {
        id: event.id,
        occurredAt: event.occurred_at,
        notes: event.notes,
        reaction: event.reaction,
        tastings,
      };
    });
}

export function maxReaction(reactions: readonly FoodReaction[]): FoodReaction {
  let max: FoodReaction = 'none';
  for (const r of reactions) if (REACTION_RANK[r] > REACTION_RANK[max]) max = r;
  return max;
}

/** Papilla si todo fue con cuchara, BLW si todo lo agarró él, mixto si hubo de los dos. */
export function methodOf(meal: Meal): SolidMethod | null {
  const formats = meal.tastings.map((t) => t.format).filter((f): f is FoodFormat => f !== null);
  if (formats.length === 0) return null;
  const spoon = formats.some((f) => f === 'puree' || f === 'mashed');
  const self = formats.some((f) => f === 'finger' || f === 'preloaded');
  if (spoon && self) return 'mixto';
  return spoon ? 'papilla' : 'blw';
}

// ---------------------------------------------------------------------------
// Resumen por alimento
// ---------------------------------------------------------------------------

export type FoodStatus = 'reaction' | 'favorite' | 'accepted' | 'learning' | 'paused' | 'unknown';

export interface FoodSummary {
  key: string;
  name: string;
  food: Food | null;
  /** Comidas en las que apareció (dos veces en la misma comida cuenta una). */
  exposures: number;
  firstAt: string;
  lastAt: string;
  /** Aceptaciones anotadas, de la más vieja a la más nueva. */
  acceptances: FoodAcceptance[];
  lastAcceptance: FoodAcceptance | null;
  gaggedCount: number;
  maxReaction: FoodReaction;
  reactionSigns: ReactionSign[];
  formats: FoodFormat[];
  status: FoodStatus;
}

export function summarizeFoods(meals: readonly Meal[]): FoodSummary[] {
  const map = new Map<string, Omit<FoodSummary, 'status' | 'lastAcceptance'>>();
  const seenInMeal = new Set<string>();

  for (const meal of meals) {
    for (const t of meal.tastings) {
      const current = map.get(t.foodKey) ?? {
        key: t.foodKey,
        name: foodFor(t.foodKey)?.name ?? t.foodName,
        food: foodFor(t.foodKey),
        exposures: 0,
        firstAt: t.occurredAt,
        lastAt: t.occurredAt,
        acceptances: [],
        gaggedCount: 0,
        maxReaction: 'none' as FoodReaction,
        reactionSigns: [],
        formats: [],
      };
      const mealKey = `${meal.id}|${t.foodKey}`;
      if (!seenInMeal.has(mealKey)) {
        seenInMeal.add(mealKey);
        current.exposures += 1;
      }
      if (t.occurredAt < current.firstAt) current.firstAt = t.occurredAt;
      if (t.occurredAt > current.lastAt) current.lastAt = t.occurredAt;
      if (t.acceptance) current.acceptances.push(t.acceptance);
      if (t.gagged) current.gaggedCount += 1;
      current.maxReaction = maxReaction([current.maxReaction, t.reaction]);
      for (const s of t.reactionSigns) {
        if (!current.reactionSigns.includes(s)) current.reactionSigns.push(s);
      }
      if (t.format && !current.formats.includes(t.format)) current.formats.push(t.format);
      map.set(t.foodKey, current);
    }
  }

  return [...map.values()]
    .map((s) => {
      const lastAcceptance = s.acceptances.at(-1) ?? null;
      return { ...s, lastAcceptance, status: statusOf({ ...s, lastAcceptance }) };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

function statusOf(s: Omit<FoodSummary, 'status'>): FoodStatus {
  if (s.maxReaction !== 'none') return 'reaction';
  const last = s.lastAcceptance;
  if (!last) return 'unknown';
  if (last === 'disliked' || last === 'refused') {
    return s.exposures >= REOFFER_TARGET ? 'paused' : 'learning';
  }
  const lastTwo = s.acceptances.slice(-2);
  const likedBoth = lastTwo.length === 2 && lastTwo.every((a) => a === 'loved' || a === 'liked');
  return last === 'loved' || likedBoth ? 'favorite' : 'accepted';
}

/** Lo que todavía no le entra: se vuelve a ofrecer, sin presión. Primero lo que hace más que no ve. */
export function reofferList(summaries: readonly FoodSummary[]): FoodSummary[] {
  return summaries
    .filter((s) => s.status === 'learning')
    .sort((a, b) => a.lastAt.localeCompare(b.lastAt));
}

export function groupCoverage(summaries: readonly FoodSummary[]): Record<FoodGroup, number> {
  const out: Record<FoodGroup, number> = {
    verduras: 0,
    frutas: 0,
    cereales: 0,
    carnes: 0,
    huevo_lacteos: 0,
    legumbres: 0,
    grasas: 0,
  };
  for (const s of summaries) if (s.food) out[s.food.group] += 1;
  return out;
}

export function colorsTried(summaries: readonly FoodSummary[]): FoodColor[] {
  const set = new Set<FoodColor>();
  for (const s of summaries) if (s.food) set.add(s.food.color);
  return [...set];
}

// ---------------------------------------------------------------------------
// Alérgenos
// ---------------------------------------------------------------------------

export type AllergenState = 'pending' | 'introducing' | 'maintain' | 'lapsed' | 'reaction';

export interface AllergenStatus {
  allergen: AllergenKey;
  label: string;
  state: AllergenState;
  exposures: number;
  firstAt: string | null;
  lastAt: string | null;
  daysSinceLast: number | null;
  foodNames: string[];
}

/** Una vez que lo toleró, conviene que lo siga comiendo al menos una vez por semana. */
const MAINTAIN_WITHIN_DAYS = 7;

export function allergenStatuses(meals: readonly Meal[], now: Date): AllergenStatus[] {
  return ALLERGEN_ORDER.map((allergen) => {
    const mealIds = new Set<string>();
    const names = new Set<string>();
    let firstAt: string | null = null;
    let lastAt: string | null = null;
    let reacted = false;

    for (const meal of meals) {
      for (const t of meal.tastings) {
        const food = foodFor(t.foodKey);
        if (!food?.allergens?.includes(allergen)) continue;
        mealIds.add(meal.id);
        names.add(food.name);
        if (!firstAt || t.occurredAt < firstAt) firstAt = t.occurredAt;
        if (!lastAt || t.occurredAt > lastAt) lastAt = t.occurredAt;
        if (t.reaction !== 'none') reacted = true;
      }
    }

    const exposures = mealIds.size;
    const daysSinceLast = lastAt ? daysBetween(lastAt, now) : null;
    let state: AllergenState;
    if (reacted) state = 'reaction';
    else if (exposures === 0) state = 'pending';
    else if (daysSinceLast !== null && daysSinceLast > MAINTAIN_WITHIN_DAYS) state = 'lapsed';
    else if (exposures < 3) state = 'introducing';
    else state = 'maintain';

    return {
      allergen,
      label: ALLERGEN_LABELS[allergen],
      state,
      exposures,
      firstAt,
      lastAt,
      daysSinceLast,
      foodNames: [...names],
    };
  });
}

// ---------------------------------------------------------------------------
// Qué probar después
// ---------------------------------------------------------------------------

export type SuggestionTag = 'inicio' | 'hierro' | 'alergeno' | 'verdura' | 'variedad';

export interface Suggestion {
  food: Food;
  tag: SuggestionTag;
  why: string;
}

export interface SuggestOptions {
  ageMonths: number;
  now: Date;
  limit?: number;
}

export interface SuggestResult {
  suggestions: Suggestion[];
  /** Por qué no sugerimos un alérgeno nuevo ahora (si aplica). */
  allergenHold: string | null;
}

export function suggestNext(
  meals: readonly Meal[],
  summaries: readonly FoodSummary[],
  { ageMonths, now, limit = 4 }: SuggestOptions,
): SuggestResult {
  const tried = new Set(summaries.map((s) => s.key));
  const eligible = FOODS.filter((f) => f.fromMonths <= ageMonths && !tried.has(f.key));
  const plain = eligible.filter((f) => !f.allergens?.length);
  const picks: Suggestion[] = [];
  const picked = new Set<string>();
  const push = (food: Food | undefined, tag: SuggestionTag, why: string) => {
    if (!food || picked.has(food.key) || picks.length >= limit) return;
    picked.add(food.key);
    picks.push({ food, tag, why });
  };
  const byStarter = (list: readonly Food[]) =>
    [...list].sort((a, b) => starterRank(a.key) - starterRank(b.key));

  // 1. Hierro: si en los últimos 2 días no comió nada con hierro, va primero.
  const recentIron = meals.some(
    (m) =>
      daysBetween(m.occurredAt, now) <= 1 &&
      m.tastings.some((t) => foodFor(t.foodKey)?.iron !== undefined),
  );
  if (!recentIron) {
    push(
      byStarter(plain).find((f) => f.iron === 'high') ??
        byStarter(plain).find((f) => f.iron === 'medium'),
      'hierro',
      'Aporta hierro: desde los 6 meses la leche sola ya no alcanza a cubrirlo.',
    );
  }

  // 2. Los primeros días: alimentos suaves y fáciles.
  if (tried.size < 3) {
    for (const food of byStarter(plain).filter((f) => starterRank(f.key) < STARTERS.length)) {
      push(food, 'inicio', 'Ideal para los primeros días: suave, dulce y fácil de preparar.');
    }
  }

  // 3. Un alérgeno nuevo, de a uno por vez y cuando ya probó algunas cosas.
  let allergenHold: string | null = null;
  if (tried.size >= 3) {
    const recentReaction = meals.some(
      (m) => daysBetween(m.occurredAt, now) <= 14 && m.tastings.some((t) => t.reaction !== 'none'),
    );
    const statuses = allergenStatuses(meals, now);
    const justStarted = statuses.some(
      (s) => s.firstAt !== null && daysBetween(s.firstAt, now) < 3 && s.state !== 'reaction',
    );
    if (recentReaction) {
      allergenHold =
        'Hubo una reacción hace poco: antes de sumar un alérgeno nuevo, consultalo con la pediatra.';
    } else if (justStarted) {
      allergenHold = 'Hace poco sumó un alérgeno: esperá unos días antes del próximo, de a uno.';
    } else {
      const next = statuses.find((s) => {
        if (s.state !== 'pending') return false;
        const food = foodFor(ALLERGEN_FIRST_FOOD[s.allergen]);
        return food !== null && food.fromMonths <= ageMonths;
      });
      if (next) {
        push(
          foodFor(ALLERGEN_FIRST_FOOD[next.allergen]) ?? undefined,
          'alergeno',
          `Para sumar ${next.label.toLowerCase()}: solo, a la mañana, y mirándolo las 2 horas siguientes.`,
        );
      }
    }
  }

  // 4. Una verdura nueva, mejor de un color que todavía no probó.
  const colors = new Set(colorsTried(summaries));
  const veggies = byStarter(plain.filter((f) => f.group === 'verduras'));
  push(
    veggies.find((f) => !colors.has(f.color)) ?? veggies[0],
    'verdura',
    'Una verdura nueva: ofrecerlas seguido desde el principio ayuda a que las acepte.',
  );

  // 5. Variedad: el grupo que menos exploró.
  const coverage = groupCoverage(summaries);
  const groups = (Object.keys(coverage) as FoodGroup[]).sort((a, b) => coverage[a] - coverage[b]);
  for (const group of groups) {
    const food = byStarter(plain.filter((f) => f.group === group))[0];
    if (food && !picked.has(food.key)) {
      push(
        food,
        'variedad',
        coverage[group] === 0
          ? `Todavía no probó nada de ${FOOD_GROUP_LABELS[group].toLowerCase()}.`
          : `Para sumar variedad en ${FOOD_GROUP_LABELS[group].toLowerCase()}.`,
      );
    }
  }

  return { suggestions: picks, allergenHold };
}

function starterRank(key: string): number {
  const i = STARTERS.indexOf(key);
  return i === -1 ? STARTERS.length : i;
}

// ---------------------------------------------------------------------------
// El día y el camino
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" del día en Argentina. */
export function arDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Días calendario (en Argentina) entre dos momentos. */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = Date.parse(`${arDateKey(from)}T00:00:00Z`);
  const b = Date.parse(`${arDateKey(to)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export function mealsOnDay(meals: readonly Meal[], day: Date): Meal[] {
  const key = arDateKey(day);
  return meals.filter((m) => arDateKey(m.occurredAt) === key);
}

/** Alimentos con hierro que comió en esas comidas. */
export function ironFoods(meals: readonly Meal[]): string[] {
  const names = new Set<string>();
  for (const m of meals) {
    for (const t of m.tastings) {
      const food = foodFor(t.foodKey);
      if (food?.iron) names.add(food.name);
    }
  }
  return [...names];
}

/** "Día 1", "Día 2"… desde la primera comida. */
export function dayNumber(meals: readonly Meal[], now: Date): number | null {
  const first = meals[0];
  if (!first) return null;
  return daysBetween(first.occurredAt, now) + 1;
}

/** Cuántas comidas por día según la edad (OMS / SAP), dicho para la familia. */
export function mealsPerDayGuide(ageMonths: number): string {
  if (ageMonths < 7) return 'Arrancá con 1 comida por día y en unas semanas pasá a 2.';
  if (ageMonths < 9) return 'A esta edad, 2 o 3 comidas por día.';
  if (ageMonths < 12) return '3 comidas por día y 1 o 2 colaciones.';
  return '3 o 4 comidas por día y 1 o 2 colaciones.';
}
