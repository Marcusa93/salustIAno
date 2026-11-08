/**
 * Menú semanal de la alimentación complementaria.
 *
 * Dos mitades, las dos puras (sin I/O) para poder testearlas:
 *   - `buildMenuInput`: arma lo que recibe la IA (qué probó, alérgenos,
 *     método, catálogo apto) y el historial con el que después se valida.
 *   - `validateMenu`: no le cree a la IA. Resuelve cada alimento contra el
 *     catálogo, saca lo prohibido, deja un solo alérgeno nuevo bien
 *     espaciado, recalcula las etiquetas y avisa si algún día quedó sin
 *     hierro. Devuelve el menú limpio y la lista de ajustes que hizo.
 */

import type {
  MenuTag,
  SolidsMenuInput,
  SolidsMenuOutput,
} from '@/lib/ai/agents/solids-menu/schema';
import {
  ALLERGEN_LABELS,
  AVOID_UNDER_12,
  FOODS,
  FOOD_BY_KEY,
  FOOD_GROUP_LABELS,
  matchFood,
  normalizeFoodName,
} from './catalog';
import {
  type FoodSummary,
  allergenStatuses,
  arDateKey,
  dayNumber,
  daysBetween,
  mealsPerDayGuide,
  methodOf,
  reofferList,
  suggestNext,
  summarizeFoods,
} from './progress';
import type { AllergenKey, Food, FoodGroup, Meal, SolidMethod } from './types';

const DAY_MS = 86_400_000;

export const MENU_DAYS = 7;
export const MAX_MEALS_PER_DAY = 2;
/** Días mínimos entre un alérgeno nuevo y el siguiente. */
export const NEW_ALLERGEN_GAP_DAYS = 3;
/** Alimentos que conviene que conozca antes del primer alérgeno (igual que `suggestNext`). */
const FOODS_BEFORE_FIRST_ALLERGEN = 3;
/** Comidas recientes que miramos para saber cómo vienen ofreciendo la comida. */
const RECENT_METHOD_MEALS = 10;
const RECENT_REACTION_DAYS = 14;
const MAX_TIPS = 3;

const TAG_ORDER: readonly MenuTag[] = ['nuevo', 'alergeno', 'hierro'];

export const SHOPPING_GROUP_ORDER: readonly ShoppingGroupKey[] = [
  'verduras',
  'frutas',
  'cereales',
  'carnes',
  'legumbres',
  'huevo_lacteos',
  'grasas',
  'otros',
];

const CUSTOM_FOOD_EMOJI = '🍽️';
const CUSTOM_ITEM_EMOJI = '🛒';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ShoppingGroupKey = FoodGroup | 'otros';

export interface MenuFood {
  /** Clave del catálogo, o null si es algo que no está en el catálogo. */
  key: string | null;
  name: string;
  emoji: string;
  tags: MenuTag[];
}

export interface MenuMeal {
  name: string;
  foods: MenuFood[];
  prep: string;
  /** Unión de las etiquetas de sus alimentos. */
  tags: MenuTag[];
  /** Si en esta comida prueba un alérgeno por primera vez, cuál. */
  newAllergen: { key: AllergenKey; label: string } | null;
}

export interface MenuDay {
  /** "YYYY-MM-DD" en Argentina. */
  date: string;
  /** "Sábado 7". */
  label: string;
  meals: MenuMeal[];
  hasIron: boolean;
}

export interface ShoppingItem {
  /** Estable entre regeneraciones: clave del catálogo o el nombre normalizado. */
  id: string;
  name: string;
  emoji: string;
  quantity: string;
}

export interface ShoppingGroup {
  group: ShoppingGroupKey;
  label: string;
  items: ShoppingItem[];
}

export interface WeeklyMenu {
  startDate: string;
  endDate: string;
  /** "Del 7 al 13 de noviembre". */
  rangeLabel: string;
  method: SolidMethod | null;
  days: MenuDay[];
  shoppingList: ShoppingGroup[];
  tips: string[];
}

export type MenuWarningCode =
  | 'food_removed'
  | 'allergen_removed'
  | 'extra_new_food'
  | 'prep_replaced'
  | 'missing_iron';

export interface MenuWarning {
  code: MenuWarningCode;
  message: string;
}

export interface ValidatedMenu {
  menu: WeeklyMenu;
  warnings: MenuWarning[];
}

/** Lo que sabemos del historial para validar el menú. */
export interface MenuHistory {
  ageMonths: number;
  /** Hoy en Argentina, "YYYY-MM-DD": el primer día del menú. */
  today: string;
  method: SolidMethod | null;
  /** Todo lo que ya comió alguna vez (claves). */
  triedKeys: ReadonlySet<string>;
  /** Alimentos con reacción anotada: clave → nombre. */
  reactionFoods: ReadonlyMap<string, string>;
  /** Alérgenos con reacción: nada que los contenga. */
  reactionAllergens: ReadonlySet<AllergenKey>;
  /** Alérgenos que ya probó sin reacción. */
  introducedAllergens: ReadonlySet<AllergenKey>;
  /** Día en que sumó por primera vez el alérgeno más reciente. */
  lastNewAllergenDate: string | null;
  /** Por qué no sumar un alérgeno nuevo ahora (null si se puede). */
  allergenHold: string | null;
  /** Alimentos con hierro para sugerir si un día queda sin hierro. */
  ironFallback: string[];
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** Suma días a un "YYYY-MM-DD" (aritmética en UTC, sin sorpresas de zona horaria). */
export function addDaysKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function diffDaysKey(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

function dateOf(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Sábado 7". */
export function dayLabel(key: string): string {
  return capitalize(
    new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(
      dateOf(key),
    ),
  );
}

/** Los 7 días del menú, desde `today`. */
export function menuWeekDays(today: string): Array<{ date: string; label: string }> {
  return Array.from({ length: MENU_DAYS }, (_, i) => {
    const date = addDaysKey(today, i);
    return { date, label: dayLabel(date) };
  });
}

/** "Del 7 al 13 de noviembre" o "Del 28 de noviembre al 4 de diciembre". */
export function weekRangeLabel(start: string, end: string): string {
  const month = (key: string) =>
    new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(dateOf(key));
  const day = (key: string) => Number(key.slice(8, 10));
  return month(start) === month(end)
    ? `Del ${day(start)} al ${day(end)} de ${month(end)}`
    : `Del ${day(start)} de ${month(start)} al ${day(end)} de ${month(end)}`;
}

// ---------------------------------------------------------------------------
// Historial → input de la IA
// ---------------------------------------------------------------------------

/** Método que más usaron en las últimas comidas; si empatan, el de la más reciente. */
export function usualMethod(meals: readonly Meal[]): SolidMethod | null {
  const counts = new Map<SolidMethod, { n: number; last: number }>();
  meals.slice(-RECENT_METHOD_MEALS).forEach((meal, i) => {
    const method = methodOf(meal);
    if (!method) return;
    counts.set(method, { n: (counts.get(method)?.n ?? 0) + 1, last: i });
  });
  let best: SolidMethod | null = null;
  let bestN = -1;
  let bestLast = -1;
  for (const [method, { n, last }] of counts) {
    if (n > bestN || (n === bestN && last > bestLast)) {
      best = method;
      bestN = n;
      bestLast = last;
    }
  }
  return best;
}

function ref(s: FoodSummary) {
  return { key: s.key, name: s.name, times: s.exposures };
}

/** Algo con hierro para sugerir: primero lo que ya comió sin drama, si no lo más clásico del catálogo. */
function ironFallbackFor(
  summaries: readonly FoodSummary[],
  ageMonths: number,
  blocked: (food: Food) => boolean,
): string[] {
  const tried = summaries
    .filter((s) => s.food?.iron && (s.status === 'favorite' || s.status === 'accepted'))
    .sort((a, b) => (a.food?.iron === 'high' ? 0 : 1) - (b.food?.iron === 'high' ? 0 : 1))
    .map((s) => s.name.toLowerCase());
  if (tried.length > 0) return tried.slice(0, 3);
  return ['carne', 'lentejas', 'pollo', 'cereal_fortificado']
    .map((key) => FOOD_BY_KEY.get(key))
    .filter((f): f is Food => f !== undefined && f.fromMonths <= ageMonths && !blocked(f))
    .map((f) => f.name.toLowerCase())
    .slice(0, 3);
}

/**
 * Arma lo que le mandamos a la IA y el historial con el que después se valida
 * lo que devuelve. `now` define el primer día del menú (hoy, en Argentina).
 */
export function buildMenuInput(
  meals: readonly Meal[],
  { ageMonths, now }: { ageMonths: number; now: Date },
): { input: SolidsMenuInput; history: MenuHistory } {
  const today = arDateKey(now);
  const summaries = summarizeFoods(meals);
  const statuses = allergenStatuses(meals, now);
  const method = usualMethod(meals);
  const solidsDay = dayNumber(meals, now);

  const reactionFoods = new Map(
    summaries.filter((s) => s.status === 'reaction').map((s) => [s.key, s.name] as const),
  );
  const reactionAllergens = new Set(
    statuses.filter((s) => s.state === 'reaction').map((s) => s.allergen),
  );
  const introducedAllergens = new Set(
    statuses.filter((s) => s.exposures > 0 && s.state !== 'reaction').map((s) => s.allergen),
  );
  const firstAllergenDays = statuses
    .map((s) => s.firstAt)
    .filter((at): at is string => at !== null)
    .map((at) => arDateKey(at))
    .sort();
  const lastNewAllergenDate = firstAllergenDays.at(-1) ?? null;

  // `suggestNext` solo frena alérgenos cuando ya probó 3 cosas; una reacción
  // reciente los frena siempre.
  const { allergenHold: suggestHold } = suggestNext(meals, summaries, { ageMonths, now });
  const recentReaction = meals.some(
    (m) =>
      daysBetween(m.occurredAt, now) <= RECENT_REACTION_DAYS &&
      m.tastings.some((t) => t.reaction !== 'none'),
  );
  const allergenHold =
    suggestHold ??
    (recentReaction
      ? 'Hubo una reacción hace poco: antes de sumar un alérgeno nuevo, consultalo con la pediatra.'
      : null);

  const blocked = (food: Food) =>
    reactionFoods.has(food.key) || (food.allergens ?? []).some((a) => reactionAllergens.has(a));

  let earliestNewAllergenDate: string | null = null;
  if (!allergenHold) {
    const candidates = [
      today,
      addDaysKey(today, Math.max(0, FOODS_BEFORE_FIRST_ALLERGEN - summaries.length)),
    ];
    if (lastNewAllergenDate) {
      candidates.push(addDaysKey(lastNewAllergenDate, NEW_ALLERGEN_GAP_DAYS));
    }
    const earliest = candidates.sort().at(-1) ?? today;
    earliestNewAllergenDate =
      diffDaysKey(today, earliest) < MENU_DAYS && hasPendingAllergen(statuses) ? earliest : null;
  }

  const history: MenuHistory = {
    ageMonths,
    today,
    method,
    triedKeys: new Set(summaries.map((s) => s.key)),
    reactionFoods,
    reactionAllergens,
    introducedAllergens,
    lastNewAllergenDate,
    allergenHold,
    ironFallback: ironFallbackFor(summaries, ageMonths, blocked),
  };

  const input: SolidsMenuInput = {
    today,
    weekDays: menuWeekDays(today),
    ageMonths,
    mealsPerDayGuide: mealsPerDayGuide(ageMonths),
    method,
    // Una comida anotada con hora futura no tiene que romper el input.
    solidsDay: solidsDay === null ? null : Math.max(1, solidsDay),
    foodsTried: {
      favorites: summaries.filter((s) => s.status === 'favorite').map(ref),
      accepted: summaries.filter((s) => s.status === 'accepted' || s.status === 'unknown').map(ref),
      learning: summaries
        .filter((s) => s.status === 'learning' && s.lastAcceptance !== 'refused')
        .map(ref),
      refused: summaries
        .filter(
          (s) =>
            s.status === 'paused' || (s.status === 'learning' && s.lastAcceptance === 'refused'),
        )
        .map(ref),
    },
    reoffer: reofferList(summaries).map(ref),
    allergens: statuses.map((s) => ({
      allergen: s.allergen,
      label: s.label,
      state: s.state,
      exposures: s.exposures,
      daysSinceLast: s.daysSinceLast,
    })),
    allergenHold,
    earliestNewAllergenDate,
    forbidden: [
      ...[...reactionFoods].map(([key, name]) => ({
        key,
        name,
        reason: 'Tuvo una reacción: no lo incluyas.',
      })),
      ...[...reactionAllergens].map((allergen) => ({
        key: `alergeno:${allergen}`,
        name: ALLERGEN_LABELS[allergen],
        reason: 'Hubo una reacción con este alérgeno: nada que lo contenga.',
      })),
    ],
    catalog: FOODS.filter((f) => f.fromMonths <= ageMonths && !blocked(f)).map((f) => ({
      key: f.key,
      name: f.name,
      group: f.group,
      ...(f.iron ? { iron: f.iron } : {}),
      ...(f.allergens?.length ? { allergens: [...f.allergens] } : {}),
    })),
  };

  return { input, history };
}

function hasPendingAllergen(statuses: ReturnType<typeof allergenStatuses>): boolean {
  return statuses.some((s) => s.state === 'pending');
}

// ---------------------------------------------------------------------------
// Lo que no va antes del año
// ---------------------------------------------------------------------------

/**
 * Patrones (sobre el nombre normalizado, sin tildes) para lo de
 * `AVOID_UNDER_12`, que no son alimentos del catálogo. Se miran ANTES de
 * resolver contra el catálogo: "jugo de naranja" no es "naranja".
 */
const AVOID_MATCHERS: ReadonlyArray<{ avoid: string; re: RegExp }> = [
  { avoid: 'Miel', re: /\bmiel\b/ },
  { avoid: 'Sal y caldos en cubo', re: /\b(sal|caldos? en cubos?|cubitos?|caldito)\b/ },
  {
    avoid: 'Azúcar, dulces y golosinas',
    re: /\b(azucar|dulces?|golosinas?|galletitas?|postrecitos?|gaseosas?|edulcorantes?|mermeladas?|chocolates?)\b/,
  },
  { avoid: 'Jugos, aunque sean naturales', re: /\bjugos?\b/ },
  { avoid: 'Té, mate e infusiones', re: /\b(te|mate|infusion|infusiones|cafe)\b/ },
  {
    avoid: 'Fiambres, embutidos y ultraprocesados',
    re: /\b(jamon|salames?|salchichas?|chorizos?|fiambres?|embutidos?|nuggets?|snacks?|sopas? instantaneas?)\b/,
  },
  {
    avoid: 'Frutos secos enteros, pochoclo y caramelos',
    re: /\b(pochoclos?|caramelos?)\b|\b(mani|almendras?|nueces|nuez|frutos secos)\b.*\benter[oa]s?\b/,
  },
  {
    avoid: 'Uvas, arándanos y tomates cherry enteros',
    re: /\b(uvas?|arandanos?|cherry|cherrys)\b.*\benter[oa]s?\b/,
  },
  { avoid: 'Pescados grandes con mercurio', re: /\b(pez espada|tiburon|atun rojo)\b/ },
  {
    avoid: 'Bebidas vegetales como reemplazo de la leche',
    re: /\b(bebidas? vegetal(es)?|leches? (vegetal(es)?|de (almendras?|arroz|avena|soja|coco)))\b/,
  },
  { avoid: 'Leche de vaca como bebida principal', re: /\bleche de vaca\b/ },
  {
    avoid: 'Huevo crudo o poco cocido',
    re: /\b(huevos?|yemas?) (crud[oa]s?|poco cocid[oa]s?|pasad[oa]s? por agua|blandas?)\b|\b(mayonesa casera|merengue)\b/,
  },
  {
    avoid: 'Carnes y pescados crudos o poco cocidos',
    re: /\b(sushi|ceviche|carpaccio|tartar|jugos[oa])\b|\b(carnes?|pollo|cerdo|pescados?|salmon|atun|merluza|trucha)\b.*\b(crud[oa]s?|poco cocid[oa]s?)\b/,
  },
  {
    avoid: 'Leche y quesos sin pasteurizar',
    re: /\b(sin pasteurizar|leche cruda|queso de campo)\b/,
  },
];

/** Si el nombre es algo de `AVOID_UNDER_12`, el porqué; si no, null. */
export function avoidReason(name: string): string | null {
  const normalized = normalizeFoodName(name);
  for (const { avoid, re } of AVOID_MATCHERS) {
    if (re.test(normalized)) {
      return AVOID_UNDER_12.find((a) => a.name === avoid)?.why ?? 'No va antes del año.';
    }
  }
  return null;
}

const PREP_FORBIDDEN: ReadonlySet<string> = new Set([
  'miel',
  'sal',
  'azucar',
  'edulcorante',
  'edulcorantes',
  'cubito',
  'cubitos',
]);
const PREP_NEGATIONS: ReadonlySet<string> = new Set([
  'sin',
  'ni',
  'no',
  'nada',
  'nunca',
  'cero',
  'evita',
  'evitar',
  'vez',
  'lugar',
]);

/** ¿La preparación agrega sal, azúcar o miel? ("sin sal" no cuenta). */
export function prepAddsForbidden(prep: string): boolean {
  const words = normalizeFoodName(prep)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  return words.some(
    (word, i) =>
      PREP_FORBIDDEN.has(word) &&
      !words.slice(Math.max(0, i - 3), i).some((prev) => PREP_NEGATIONS.has(prev)),
  );
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

function isExactName(food: Food, name: string): boolean {
  const n = normalizeFoodName(name);
  return [food.name, ...(food.aliases ?? [])].some((term) => normalizeFoodName(term) === n);
}

/**
 * Del alimento que escribió la IA al catálogo. Si la clave y el nombre no
 * coinciden, gana el nombre cuando es exacto (la preparación habla de ese).
 */
export function resolveMenuFood(raw: { key?: string | null; name: string }): Food | null {
  const byName = matchFood(raw.name);
  const byKey = raw.key ? (FOOD_BY_KEY.get(raw.key) ?? null) : null;
  if (byName && byKey && byName.key !== byKey.key) {
    return isExactName(byName, raw.name) ? byName : byKey;
  }
  return byName ?? byKey ?? (raw.key ? matchFood(raw.key.replace(/_/g, ' ')) : null);
}

/** Por qué un alimento del catálogo no puede ir en el menú (o null si puede). */
function forbiddenReason(food: Food, history: MenuHistory): string | null {
  if (history.reactionFoods.has(food.key)) {
    return 'anotaron una reacción. Antes de volver a darlo, hablalo con la pediatra.';
  }
  const reacted = (food.allergens ?? []).find((a) => history.reactionAllergens.has(a));
  if (reacted) {
    return `tiene ${ALLERGEN_LABELS[reacted].toLowerCase()} y hubo una reacción con eso.`;
  }
  if (food.fromMonths > history.ageMonths) {
    return `conviene esperar hasta los ${food.fromMonths} meses.`;
  }
  return null;
}

function joinList(items: readonly string[], last = 'y'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`;
}

function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/.exec(text.trim());
  return match ? match[0] : text.trim();
}

/** Preparación armada con el catálogo, para cuando la de la IA no sirve. */
function catalogPrep(foods: readonly Food[], method: SolidMethod | null): string {
  if (foods.length === 0) return 'Ofrecelo como lo vienen haciendo, sin sal ni azúcar.';
  return foods
    .map((f) => `${f.name}: ${firstSentence(method === 'blw' ? f.blw : f.puree)}`)
    .join(' ');
}

function mentions(text: string, name: string): boolean {
  const words = new Set(
    normalizeFoodName(text)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' '),
  );
  return normalizeFoodName(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .some(
      (w) => w.length >= 3 && (words.has(w) || words.has(`${w}s`) || words.has(w.slice(0, -1))),
    );
}

function sortTags(tags: Iterable<MenuTag>): MenuTag[] {
  const set = new Set(tags);
  return TAG_ORDER.filter((t) => set.has(t));
}

/** Junta avisos iguales en uno solo con la lista de días ("Sacamos X (sábado 7 y lunes 9): …"). */
class WarningLog {
  private readonly entries = new Map<
    string,
    { code: MenuWarningCode; subject: string; why: string; days: string[] }
  >();
  private readonly extra: MenuWarning[] = [];

  removed(code: MenuWarningCode, subject: string, why: string, day: string) {
    const id = `${code}|${subject}|${why}`;
    const entry = this.entries.get(id) ?? { code, subject, why, days: [] };
    if (!entry.days.includes(day)) entry.days.push(day);
    this.entries.set(id, entry);
  }

  add(warning: MenuWarning) {
    this.extra.push(warning);
  }

  list(): MenuWarning[] {
    const removed = [...this.entries.values()].map(({ code, subject, why, days }) => ({
      code,
      message: `Sacamos ${subject} (${joinList(days.map((d) => d.toLowerCase()))}): ${why.charAt(0).toLowerCase()}${why.slice(1)}`,
    }));
    return [...removed, ...this.extra];
  }
}

interface ChosenAllergen {
  key: AllergenKey;
  date: string;
}

/**
 * Limpia el menú que devolvió la IA con las reglas que no se negocian.
 * Recorre los días en orden, así "nuevo" y "primer alérgeno" se deciden
 * como los va a vivir la familia.
 */
export function validateMenu(raw: SolidsMenuOutput, history: MenuHistory): ValidatedMenu {
  const log = new WarningLog();
  const week = menuWeekDays(history.today);
  const seen = new Set<string>();
  const removedKeys = new Set<string>();
  let knownCount = history.triedKeys.size;
  let chosen: ChosenAllergen | null = null;

  /** ¿Puede ir este alérgeno nuevo este día? Devuelve el motivo si no. */
  const allergenVerdict = (
    fresh: readonly AllergenKey[],
    date: string,
  ): { ok: true; intro: boolean } | { ok: false; why: string } => {
    const [first] = fresh;
    if (!first) return { ok: true, intro: false };
    if (fresh.length > 1) {
      return { ok: false, why: 'suma dos alérgenos nuevos a la vez. Mejor de a uno.' };
    }
    if (chosen) {
      return chosen.key === first
        ? { ok: true, intro: false }
        : {
            ok: false,
            why: `esta semana ya se suma ${ALLERGEN_LABELS[chosen.key].toLowerCase()}. Los alérgenos nuevos, de a uno.`,
          };
    }
    if (history.allergenHold) return { ok: false, why: history.allergenHold };
    if (knownCount < FOODS_BEFORE_FIRST_ALLERGEN) {
      return {
        ok: false,
        why: 'antes del primer alérgeno conviene que pruebe algunos alimentos más.',
      };
    }
    if (
      history.lastNewAllergenDate &&
      diffDaysKey(history.lastNewAllergenDate, date) < NEW_ALLERGEN_GAP_DAYS
    ) {
      return {
        ok: false,
        why: `entre un alérgeno nuevo y el siguiente tienen que pasar al menos ${NEW_ALLERGEN_GAP_DAYS} días.`,
      };
    }
    chosen = { key: first, date };
    return { ok: true, intro: true };
  };

  const days: MenuDay[] = week.map((day, i) => {
    const rawMeals = (raw.days[i]?.meals ?? []).slice(0, MAX_MEALS_PER_DAY);
    const meals: MenuMeal[] = [];

    for (const rawMeal of rawMeals) {
      const foods: MenuFood[] = [];
      const catalogFoods: Food[] = [];
      const removedNames: string[] = [];
      const keysInMeal = new Set<string>();
      const customInMeal = new Set<string>();
      let newInMeal = 0;
      let newAllergen: MenuMeal['newAllergen'] = null;

      for (const rawFood of rawMeal.foods) {
        const avoid = avoidReason(rawFood.name);
        if (avoid) {
          log.removed('food_removed', rawFood.name.toLowerCase(), avoid, day.label);
          removedNames.push(rawFood.name);
          continue;
        }

        const food = resolveMenuFood(rawFood);
        if (!food) {
          const id = normalizeFoodName(rawFood.name);
          if (customInMeal.has(id)) continue;
          customInMeal.add(id);
          foods.push({
            key: null,
            name: capitalize(rawFood.name.trim()),
            emoji: CUSTOM_FOOD_EMOJI,
            tags: [],
          });
          continue;
        }
        if (keysInMeal.has(food.key)) continue;

        const forbidden = forbiddenReason(food, history);
        if (forbidden) {
          log.removed('food_removed', food.name.toLowerCase(), forbidden, day.label);
          removedNames.push(food.name);
          removedKeys.add(food.key);
          continue;
        }

        const isNew = !history.triedKeys.has(food.key) && !seen.has(food.key);
        if (isNew && newInMeal >= 1) {
          log.removed(
            'extra_new_food',
            food.name.toLowerCase(),
            'ya había otro alimento nuevo en esa comida. Mejor de a uno, así se nota qué le cae bien.',
            day.label,
          );
          removedNames.push(food.name);
          removedKeys.add(food.key);
          continue;
        }

        const fresh = (food.allergens ?? []).filter((a) => !history.introducedAllergens.has(a));
        const verdict = allergenVerdict(fresh, day.date);
        if (!verdict.ok) {
          log.removed('allergen_removed', food.name.toLowerCase(), verdict.why, day.label);
          removedNames.push(food.name);
          removedKeys.add(food.key);
          continue;
        }
        const [introduced] = fresh;
        if (verdict.intro && introduced) {
          newAllergen = { key: introduced, label: ALLERGEN_LABELS[introduced] };
        }

        keysInMeal.add(food.key);
        if (isNew) newInMeal += 1;
        const tags: MenuTag[] = [];
        if (isNew) tags.push('nuevo');
        if (food.allergens?.length) tags.push('alergeno');
        if (food.iron) tags.push('hierro');
        foods.push({ key: food.key, name: food.name, emoji: food.emoji, tags });
        catalogFoods.push(food);
      }

      for (const key of keysInMeal) seen.add(key);
      knownCount += newInMeal;
      if (foods.length === 0) continue;

      let prep = rawMeal.prep;
      if (prepAddsForbidden(prep)) {
        prep = catalogPrep(catalogFoods, history.method);
        log.add({
          code: 'prep_replaced',
          message: `Cambiamos la preparación del ${day.label.toLowerCase()} (${rawMeal.name.toLowerCase()}): le agregaba sal, azúcar o miel, y antes del año va sin nada de eso.`,
        });
      } else if (removedNames.some((name) => mentions(prep, name))) {
        prep = catalogPrep(catalogFoods, history.method);
      }

      meals.push({
        name: rawMeal.name,
        foods,
        prep,
        tags: sortTags(foods.flatMap((f) => f.tags)),
        newAllergen,
      });
    }

    return {
      date: day.date,
      label: day.label,
      meals,
      hasIron: meals.some((m) => m.tags.includes('hierro')),
    };
  });

  const ironless = days.filter((d) => !d.hasIron);
  if (ironless.length > 0) {
    const which =
      ironless.length === days.length
        ? 'Ningún día tiene'
        : `${capitalize(joinList(ironless.map((d) => d.label.toLowerCase())))} ${ironless.length === 1 ? 'no tiene' : 'no tienen'}`;
    const fix =
      history.ironFallback.length > 0
        ? ` Sumale ${joinList(history.ironFallback, 'o')}.`
        : ' Sumale algo con hierro.';
    log.add({
      code: 'missing_iron',
      message: `${which} nada con hierro, y desde los 6 meses hace falta todos los días.${fix}`,
    });
  }

  const usedKeys = new Set(
    days
      .flatMap((d) => d.meals.flatMap((m) => m.foods.map((f) => f.key)))
      .filter((k): k is string => k !== null),
  );

  return {
    menu: {
      startDate: week[0]?.date ?? history.today,
      endDate: week.at(-1)?.date ?? history.today,
      rangeLabel: weekRangeLabel(
        week[0]?.date ?? history.today,
        week.at(-1)?.date ?? history.today,
      ),
      method: history.method,
      days,
      shoppingList: cleanShoppingList(raw.shoppingList, history, {
        usedKeys,
        removedKeys,
        chosenAllergen: (chosen as ChosenAllergen | null)?.key ?? null,
      }),
      tips: raw.tips.slice(0, MAX_TIPS),
    },
    warnings: log.list(),
  };
}

// ---------------------------------------------------------------------------
// Lista de compras
// ---------------------------------------------------------------------------

function shoppingGroupOf(raw: string): ShoppingGroupKey {
  const n = normalizeFoodName(raw);
  for (const [key, label] of Object.entries(FOOD_GROUP_LABELS) as Array<[FoodGroup, string]>) {
    if (n === key || n === normalizeFoodName(label)) return key;
  }
  return 'otros';
}

function shoppingGroupLabel(group: ShoppingGroupKey): string {
  return group === 'otros' ? 'Otros' : FOOD_GROUP_LABELS[group];
}

/**
 * Reagrupa por grupo del catálogo, saca lo prohibido y lo que el menú ya no
 * usa, y suma lo que el menú usa y la IA se olvidó de anotar.
 */
function cleanShoppingList(
  rawGroups: SolidsMenuOutput['shoppingList'],
  history: MenuHistory,
  {
    usedKeys,
    removedKeys,
    chosenAllergen,
  }: {
    usedKeys: ReadonlySet<string>;
    removedKeys: ReadonlySet<string>;
    chosenAllergen: AllergenKey | null;
  },
): ShoppingGroup[] {
  const byGroup = new Map<ShoppingGroupKey, ShoppingItem[]>();
  const ids = new Set<string>();
  const add = (group: ShoppingGroupKey, item: ShoppingItem) => {
    if (ids.has(item.id)) return;
    ids.add(item.id);
    byGroup.set(group, [...(byGroup.get(group) ?? []), item]);
  };

  for (const rawGroup of rawGroups) {
    for (const { item, quantity } of rawGroup.items) {
      if (avoidReason(item)) continue;
      const food = matchFood(item);
      if (!food) {
        add(shoppingGroupOf(rawGroup.group), {
          id: `item:${normalizeFoodName(item).replace(/\s+/g, '_')}`,
          name: capitalize(item),
          emoji: CUSTOM_ITEM_EMOJI,
          quantity,
        });
        continue;
      }
      if (forbiddenReason(food, history)) continue;
      if (removedKeys.has(food.key) && !usedKeys.has(food.key)) continue;
      const fresh = (food.allergens ?? []).filter((a) => !history.introducedAllergens.has(a));
      if (fresh.length > 0 && !(fresh.length === 1 && fresh[0] === chosenAllergen)) continue;
      add(food.group, { id: food.key, name: capitalize(item), emoji: food.emoji, quantity });
    }
  }

  for (const key of usedKeys) {
    const food = FOOD_BY_KEY.get(key);
    if (food && !ids.has(key)) {
      add(food.group, { id: key, name: food.name, emoji: food.emoji, quantity: '' });
    }
  }

  return SHOPPING_GROUP_ORDER.flatMap((group) => {
    const items = byGroup.get(group);
    return items?.length ? [{ group, label: shoppingGroupLabel(group), items }] : [];
  });
}
