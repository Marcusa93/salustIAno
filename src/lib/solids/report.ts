/**
 * Informe de alimentación para llevarle a la pediatra.
 *
 * Junta todo lo que la familia anotó en Comidas (qué probó, alérgenos,
 * reacciones, texturas, arcadas, hierro) y arma preguntas para el control,
 * dichas como las haría una familia. Es un registro, no un diagnóstico:
 * describe y pregunta, nunca concluye. Todo puro (sin I/O) para testearlo.
 */

import { babyAgeFromBirth } from '@/lib/baby-age';
import { ALLERGEN_FIRST_FOOD, FOOD_GROUP_LABELS } from './catalog';
import { EMERGENCY_SIGNS, FORMAT_LABELS, REACTION_SIGN_LABELS } from './labels';
import {
  type AllergenState,
  type FoodStatus,
  type FoodSummary,
  allergenStatuses,
  arDateKey,
  daysBetween,
  foodFor,
  maxReaction,
  reofferList,
  summarizeFoods,
} from './progress';
import type {
  AllergenKey,
  FoodAcceptance,
  FoodFormat,
  FoodGroup,
  FoodReaction,
  Meal,
  ReactionSign,
} from './types';

const AR_TZ = 'America/Argentina/Buenos_Aires';
const DAY_MS = 86_400_000;

/** Ventana para contar los días con hierro. */
export const IRON_WINDOW_DAYS = 14;
/** Ventana para decidir si las arcadas son "seguido". */
export const GAG_WINDOW_DAYS = 14;
/** Arcadas en la ventana a partir de las cuales vale la pena preguntarlo. */
export const FREQUENT_GAGS = 3;
/** Veces que rechazó un alimento a partir de las cuales vale preguntarlo. */
export const REFUSALS_TO_ASK = 5;
/** Desde esta edad, si faltan alérgenos o sigue todo en papilla lisa, se pregunta. */
export const CHECK_FROM_MONTHS = 8;
/** Ventana para mirar qué texturas viene comiendo ahora. */
const TEXTURE_WINDOW_DAYS = 30;
/** Más de esto, el resto de las reacciones va en una sola pregunta. */
const MAX_REACTION_QUESTIONS = 5;

export const GROUP_ORDER: readonly FoodGroup[] = [
  'verduras',
  'frutas',
  'cereales',
  'carnes',
  'legumbres',
  'huevo_lacteos',
  'grasas',
];

const FORMATS: readonly FoodFormat[] = ['puree', 'mashed', 'preloaded', 'finger'];
/** Grumos o trozos: lo que muestra que ya pasó de la papilla lisa. */
const TEXTURED: ReadonlySet<FoodFormat> = new Set<FoodFormat>(['mashed', 'finger']);

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ReportGroup {
  group: FoodGroup;
  label: string;
  count: number;
  foods: string[];
}

export interface ReportAllergen {
  allergen: AllergenKey;
  label: string;
  state: AllergenState;
  firstAt: string | null;
  lastAt: string | null;
  exposures: number;
  daysSinceLast: number | null;
  /** La peor reacción anotada en una comida con este alérgeno. */
  reaction: FoodReaction;
  foods: string[];
}

export interface ReportSign {
  sign: ReactionSign;
  label: string;
  /** Hinchazón o dificultad para respirar: siempre es una urgencia. */
  emergency: boolean;
}

export interface ReportReaction {
  mealId: string;
  at: string;
  severity: Exclude<FoodReaction, 'none'>;
  /** Todo lo que comió en esa comida. */
  foods: string[];
  /** Los alimentos marcados con reacción (todos, si la comida no tiene detalle). */
  suspects: string[];
  signs: ReportSign[];
  emergency: boolean;
  notes: string | null;
}

export interface ReportFood {
  key: string;
  name: string;
  emoji: string | null;
  status: FoodStatus;
  exposures: number;
  /** Veces que lo rechazó o no le gustó. */
  refusals: number;
  lastAcceptance: FoodAcceptance | null;
  lastAt: string;
}

export interface ReportTextureMonth {
  /** Edad en meses (si sabemos la fecha de nacimiento) o mes desde que empezó (1, 2…). */
  key: number;
  label: string;
  counts: Record<FoodFormat, number>;
  total: number;
}

export interface ReportGag {
  mealId: string;
  at: string;
  foods: string[];
}

export type ReportQuestionTopic =
  | 'reaction'
  | 'allergens'
  | 'texture'
  | 'gagging'
  | 'iron'
  | 'refusals'
  | 'start';

export interface ReportQuestion {
  topic: ReportQuestionTopic;
  text: string;
  /** Va primero y resaltada (reacción fuerte o con signos de alarma). */
  urgent: boolean;
}

export interface SolidsReport {
  generatedAt: string;
  ageMonths: number;
  hasMeals: boolean;
  start: { at: string; daysSince: number; ageMonths: number | null } | null;
  totals: { meals: number; foods: number; tastings: number };
  groups: ReportGroup[];
  /** Alimentos que no están en el catálogo (los escribió la familia). */
  otherFoods: string[];
  allergens: ReportAllergen[];
  reactions: ReportReaction[];
  acceptance: {
    favorites: ReportFood[];
    /** Lo que la última vez rechazó o no le gustó, de lo más rechazado a lo menos. */
    notYet: ReportFood[];
    /** Para volver a ofrecer, primero lo que hace más que no ve. */
    reoffer: ReportFood[];
  };
  textures: {
    totals: Record<FoodFormat, number>;
    /** Alimentos con formato anotado. */
    total: number;
    /** Alimentos sin formato anotado (comidas viejas o sin detalle). */
    unknown: number;
    byMonth: ReportTextureMonth[];
    /** En el último mes hubo comidas con formato y ninguna con grumos ni trozos. */
    noLumpsRecently: boolean;
    /** true si `byMonth` va por edad; false si va por mes desde que empezó. */
    byAge: boolean;
  };
  gagging: {
    /** Comidas con arcadas, en total. */
    meals: number;
    /** Comidas con arcadas en las últimas 2 semanas. */
    recent: number;
    /** Comidas en las últimas 2 semanas (con o sin arcadas). */
    recentMeals: number;
    /** Con qué alimentos tuvo arcadas en las últimas 2 semanas. */
    recentFoods: string[];
    /** De la más nueva a la más vieja. */
    episodes: ReportGag[];
  };
  iron: {
    windowDays: number;
    daysWithIron: number;
    daysWithMeals: number;
    foods: string[];
    /** Cada día de la ventana, del más viejo a hoy ("YYYY-MM-DD" en Argentina). */
    days: { date: string; meals: boolean; iron: boolean }[];
  };
  questions: ReportQuestion[];
}

export interface SolidsReportInput {
  meals: readonly Meal[];
  ageMonths: number;
  birthDate: string | null;
  now: Date;
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

export function buildSolidsReport({
  meals: input,
  ageMonths,
  birthDate,
  now,
}: SolidsReportInput): SolidsReport {
  // Por las dudas, de la más vieja a la más nueva (como las arma buildMeals).
  const meals = [...input].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const summaries = summarizeFoods(meals);
  const first = meals[0];
  const ageAt = ageResolver(birthDate, now);

  const start = first
    ? {
        at: first.occurredAt,
        daysSince: daysBetween(first.occurredAt, now),
        ageMonths: ageAt ? ageAt(first.occurredAt) : null,
      }
    : null;

  const tastings = meals.flatMap((m) => m.tastings);
  const groups = GROUP_ORDER.map((group) => {
    const foods = summaries.filter((s) => s.food?.group === group).map((s) => s.name);
    return { group, label: FOOD_GROUP_LABELS[group], count: foods.length, foods };
  });
  const otherFoods = summaries.filter((s) => !s.food).map((s) => s.name);

  const allergens = buildAllergens(meals, now);
  const reactions = buildReactions(meals);
  const acceptance = buildAcceptance(summaries);
  const textures = buildTextures(meals, now, start?.at ?? null, ageAt);
  const gagging = buildGagging(meals, now);
  const iron = buildIron(meals, now, start?.daysSince ?? null);

  const report: Omit<SolidsReport, 'questions'> = {
    generatedAt: now.toISOString(),
    ageMonths,
    hasMeals: meals.length > 0,
    start,
    totals: { meals: meals.length, foods: summaries.length, tastings: tastings.length },
    groups,
    otherFoods,
    allergens,
    reactions,
    acceptance,
    textures,
    gagging,
    iron,
  };
  return { ...report, questions: buildQuestions(report) };
}

/** Edad en meses en un momento dado, o null si no sabemos la fecha de nacimiento. */
function ageResolver(birthDate: string | null, now: Date): ((iso: string) => number) | null {
  const today = babyAgeFromBirth(birthDate, now);
  if (!birthDate || !today || !Number.isFinite(today.months)) return null;
  return (iso) => Math.max(0, babyAgeFromBirth(birthDate, new Date(iso))?.months ?? 0);
}

function buildAllergens(meals: readonly Meal[], now: Date): ReportAllergen[] {
  return allergenStatuses(meals, now).map((a) => {
    let reaction: FoodReaction = 'none';
    for (const meal of meals) {
      for (const t of meal.tastings) {
        if (foodFor(t.foodKey)?.allergens?.includes(a.allergen)) {
          reaction = maxReaction([reaction, t.reaction]);
        }
      }
    }
    return {
      allergen: a.allergen,
      label: a.label,
      state: a.state,
      firstAt: a.firstAt,
      lastAt: a.lastAt,
      exposures: a.exposures,
      daysSinceLast: a.daysSinceLast,
      reaction,
      foods: a.foodNames,
    };
  });
}

function nameOf(foodKey: string, fallback: string): string {
  return foodFor(foodKey)?.name ?? fallback;
}

function uniq<T>(list: readonly T[]): T[] {
  return [...new Set(list)];
}

function buildReactions(meals: readonly Meal[]): ReportReaction[] {
  const out: ReportReaction[] = [];
  for (const meal of meals) {
    const severity = maxReaction([meal.reaction, ...meal.tastings.map((t) => t.reaction)]);
    if (severity === 'none') continue;
    const foods = uniq(meal.tastings.map((t) => nameOf(t.foodKey, t.foodName)));
    const marked = uniq(
      meal.tastings.filter((t) => t.reaction !== 'none').map((t) => nameOf(t.foodKey, t.foodName)),
    );
    const signs = uniq(meal.tastings.flatMap((t) => t.reactionSigns));
    const reportSigns: ReportSign[] = signs.map((sign) => ({
      sign,
      label: REACTION_SIGN_LABELS[sign],
      emergency: EMERGENCY_SIGNS.has(sign),
    }));
    out.push({
      mealId: meal.id,
      at: meal.occurredAt,
      severity,
      foods,
      suspects: marked.length > 0 ? marked : foods,
      signs: reportSigns,
      emergency: reportSigns.some((s) => s.emergency),
      notes: meal.notes?.trim() || null,
    });
  }
  return out.reverse();
}

function toReportFood(s: FoodSummary): ReportFood {
  return {
    key: s.key,
    name: s.name,
    emoji: s.food?.emoji ?? null,
    status: s.status,
    exposures: s.exposures,
    refusals: s.acceptances.filter((a) => a === 'refused' || a === 'disliked').length,
    lastAcceptance: s.lastAcceptance,
    lastAt: s.lastAt,
  };
}

function buildAcceptance(summaries: readonly FoodSummary[]): SolidsReport['acceptance'] {
  const favorites = summaries.filter((s) => s.status === 'favorite').map(toReportFood);
  const notYet = summaries
    .filter((s) => s.status === 'learning' || s.status === 'paused')
    .map(toReportFood)
    .sort((a, b) => b.refusals - a.refusals || b.exposures - a.exposures);
  const reoffer = reofferList(summaries).map(toReportFood);
  return { favorites, notYet, reoffer };
}

function emptyCounts(): Record<FoodFormat, number> {
  return { puree: 0, mashed: 0, preloaded: 0, finger: 0 };
}

function buildTextures(
  meals: readonly Meal[],
  now: Date,
  startAt: string | null,
  ageAt: ((iso: string) => number) | null,
): SolidsReport['textures'] {
  const totals = emptyCounts();
  const months = new Map<number, Record<FoodFormat, number>>();
  let total = 0;
  let unknown = 0;
  let recent = 0;
  let recentTextured = 0;

  for (const meal of meals) {
    for (const t of meal.tastings) {
      if (!t.format) {
        unknown += 1;
        continue;
      }
      total += 1;
      totals[t.format] += 1;
      const key = ageAt
        ? ageAt(t.occurredAt)
        : Math.floor(daysBetween(startAt ?? t.occurredAt, t.occurredAt) / 30) + 1;
      const counts = months.get(key) ?? emptyCounts();
      counts[t.format] += 1;
      months.set(key, counts);
      if (daysBetween(t.occurredAt, now) < TEXTURE_WINDOW_DAYS) {
        recent += 1;
        if (TEXTURED.has(t.format)) recentTextured += 1;
      }
    }
  }

  const byMonth: ReportTextureMonth[] = [];
  const keys = [...months.keys()];
  if (keys.length > 0) {
    // Meses seguidos, aunque alguno no tenga datos: el hueco también dice algo.
    for (let key = Math.min(...keys); key <= Math.max(...keys); key++) {
      const counts = months.get(key) ?? emptyCounts();
      byMonth.push({
        key,
        label: ageAt ? monthsLabel(key) : `Mes ${key}`,
        counts,
        total: FORMATS.reduce((n, f) => n + counts[f], 0),
      });
    }
  }

  return {
    totals,
    total,
    unknown,
    byMonth,
    noLumpsRecently: recent > 0 && recentTextured === 0,
    byAge: ageAt !== null,
  };
}

function buildGagging(meals: readonly Meal[], now: Date): SolidsReport['gagging'] {
  const episodes: ReportGag[] = [];
  let recentMeals = 0;
  for (const meal of meals) {
    const inWindow = daysBetween(meal.occurredAt, now) < GAG_WINDOW_DAYS;
    if (inWindow) recentMeals += 1;
    const gagged = meal.tastings.filter((t) => t.gagged);
    if (gagged.length === 0) continue;
    episodes.push({
      mealId: meal.id,
      at: meal.occurredAt,
      foods: uniq(gagged.map((t) => nameOf(t.foodKey, t.foodName))),
    });
  }
  const recent = episodes.filter((e) => daysBetween(e.at, now) < GAG_WINDOW_DAYS);
  return {
    meals: episodes.length,
    recent: recent.length,
    recentMeals,
    recentFoods: uniq(recent.flatMap((e) => e.foods)),
    episodes: episodes.reverse(),
  };
}

function buildIron(
  meals: readonly Meal[],
  now: Date,
  daysSinceStart: number | null,
): SolidsReport['iron'] {
  // Si empezó hace menos de 14 días, la cuenta es sobre los días que van.
  const windowDays = daysSinceStart === null ? 0 : Math.min(IRON_WINDOW_DAYS, daysSinceStart + 1);
  const withMeals = new Set<string>();
  const withIron = new Set<string>();
  const foods = new Set<string>();
  for (const meal of meals) {
    const ago = daysBetween(meal.occurredAt, now);
    if (ago < 0 || ago >= windowDays) continue;
    const day = arDateKey(meal.occurredAt);
    withMeals.add(day);
    for (const t of meal.tastings) {
      const food = foodFor(t.foodKey);
      if (food?.iron) {
        withIron.add(day);
        foods.add(food.name);
      }
    }
  }
  const days = Array.from({ length: windowDays }, (_, i) => {
    const date = arDateKey(new Date(now.getTime() - (windowDays - 1 - i) * DAY_MS));
    return { date, meals: withMeals.has(date), iron: withIron.has(date) };
  });
  return {
    windowDays,
    daysWithIron: withIron.size,
    daysWithMeals: withMeals.size,
    foods: [...foods],
    days,
  };
}

// ---------------------------------------------------------------------------
// Preguntas para la pediatra
// ---------------------------------------------------------------------------

function buildQuestions(r: Omit<SolidsReport, 'questions'>): ReportQuestion[] {
  const out: ReportQuestion[] = [];
  const age = monthsLabel(r.ageMonths);

  if (!r.hasMeals) {
    if (r.ageMonths >= 6) {
      out.push({
        topic: 'start',
        text: `Todavía no empezó con sólidos y tiene ${age}: ¿cuándo y cómo arrancamos?`,
        urgent: false,
      });
    }
    return out;
  }

  // 1. Una por reacción: primero las fuertes o con signos de alarma, después por fecha.
  const reactions = [...r.reactions].sort(
    (a, b) => Number(isUrgent(b)) - Number(isUrgent(a)) || b.at.localeCompare(a.at),
  );
  for (const reaction of reactions.slice(0, MAX_REACTION_QUESTIONS)) {
    out.push({ topic: 'reaction', text: reactionQuestion(reaction), urgent: isUrgent(reaction) });
  }
  const rest = reactions.length - MAX_REACTION_QUESTIONS;
  if (rest > 0) {
    out.push({
      topic: 'reaction',
      text: `Además anotamos ${rest === 1 ? 'otra reacción' : `${rest} reacciones más`} (están en la lista): ¿las revisamos?`,
      urgent: false,
    });
  }

  // 2. Alérgenos sin probar a una edad en la que ya conviene haberlos sumado.
  if (r.ageMonths >= CHECK_FROM_MONTHS) {
    const pending = r.allergens.filter((a) => {
      if (a.state !== 'pending') return false;
      const food = foodFor(ALLERGEN_FIRST_FOOD[a.allergen]);
      return food !== null && food.fromMonths <= r.ageMonths;
    });
    if (pending.length > 0) {
      out.push({
        topic: 'allergens',
        text: `Todavía no probó ${joinEs(pending.map((a) => a.label.toLowerCase()))}, y ya tiene ${age}: ¿en qué orden y cómo se ${pending.length === 1 ? 'lo' : 'los'} damos?`,
        urgent: false,
      });
    }
  }

  // 3. Sigue todo en papilla lisa: los grumos conviene sumarlos antes de los 9 meses.
  if (r.ageMonths >= CHECK_FROM_MONTHS && r.textures.noLumpsRecently) {
    out.push({
      topic: 'texture',
      text: `Ya tiene ${age} y en el último mes comió todo en papilla lisa: ¿cómo pasamos a grumos y trocitos? Leímos que conviene empezar antes de los 9 meses.`,
      urgent: false,
    });
  }

  // 4. Arcadas seguido.
  if (r.gagging.recent >= FREQUENT_GAGS) {
    const foods = r.gagging.recentFoods.slice(0, 4).map((f) => f.toLowerCase());
    out.push({
      topic: 'gagging',
      text: `Tuvo arcadas en ${r.gagging.recent} de ${r.gagging.recentMeals} comidas de las últimas 2 semanas${
        foods.length > 0 ? ` (con ${joinEs(foods)})` : ''
      }: ¿es lo esperable mientras aprende o conviene cambiar la textura o la forma de ofrecer?`,
      urgent: false,
    });
  }

  // 5. Poco hierro.
  if (r.iron.windowDays >= 7 && r.iron.daysWithIron < r.iron.windowDays / 2) {
    const window =
      r.iron.windowDays === IRON_WINDOW_DAYS
        ? 'En las últimas 2 semanas'
        : `En los últimos ${r.iron.windowDays} días`;
    out.push({
      topic: 'iron',
      text: `${window} comió algo con hierro ${r.iron.daysWithIron} de ${r.iron.windowDays} días: ¿le alcanza o conviene reforzarlo?`,
      urgent: false,
    });
  }

  // 6. Alimentos que rechaza muchas veces.
  const refused = r.acceptance.notYet.filter((f) => f.refusals >= REFUSALS_TO_ASK).slice(0, 4);
  if (refused.length > 0) {
    out.push({
      topic: 'refusals',
      text: `Rechaza seguido ${joinEs(refused.map((f) => `${f.name.toLowerCase()} (${f.refusals} veces)`))}: ¿${refused.length === 1 ? 'lo seguimos' : 'los seguimos'} ofreciendo igual o probamos de otra forma?`,
      urgent: false,
    });
  }

  return out;
}

function isUrgent(r: ReportReaction): boolean {
  return r.severity === 'strong' || r.emergency;
}

function reactionQuestion(r: ReportReaction): string {
  const when = fmtDayMonth(r.at);
  const foods = joinEs(r.suspects.map((f) => f.toLowerCase()));
  const signs = r.signs.length > 0 ? ` (${joinEs(r.signs.map((s) => s.label.toLowerCase()))})` : '';
  return r.severity === 'strong' || r.emergency
    ? `El ${when} tuvo una reacción ${r.severity === 'strong' ? 'fuerte' : 'leve'} después de comer ${foods}${signs}. ¿Puede ser alergia? ¿Hace falta algún estudio antes de volver a dárselo?`
    : `El ${when} tuvo una reacción leve después de comer ${foods}${signs}. ¿Puede ser alergia? ¿Se lo seguimos dando o esperamos?`;
}

// ---------------------------------------------------------------------------
// Texto para el borrador del control (pediatric-prep)
// ---------------------------------------------------------------------------

const ALLERGEN_STATE_TEXT: Record<AllergenState, string> = {
  pending: 'sin probar',
  introducing: 'sumándolo',
  maintain: 'incorporado',
  lapsed: 'hace rato que no lo come',
  reaction: 'hubo reacción',
};

/**
 * Resumen compacto del informe para el agente del control. Abarca todo el
 * historial de sólidos (no solo el período del borrador). null si no aplica.
 */
export function solidsReportForPrep(r: SolidsReport): string | null {
  if (!r.hasMeals) {
    return r.ageMonths >= 5 ? 'Todavía no hay comidas sólidas anotadas.' : null;
  }
  const lines: string[] = [];
  if (r.start) {
    lines.push(
      `Empezó con sólidos el ${fmtDayMonth(r.start.at, true)}${
        r.start.ageMonths !== null ? `, a los ${monthsLabel(r.start.ageMonths)}` : ''
      } (hace ${r.start.daysSince} ${r.start.daysSince === 1 ? 'día' : 'días'}). ${r.totals.meals} comidas, ${r.totals.foods} alimentos distintos.`,
    );
  }
  lines.push(
    `Alérgenos: ${r.allergens
      .map((a) => {
        const extra = a.exposures > 0 ? `, ${a.exposures}×` : '';
        return `${a.label.toLowerCase()} ${ALLERGEN_STATE_TEXT[a.state]}${extra}`;
      })
      .join('; ')}.`,
  );
  if (r.reactions.length > 0) {
    lines.push(
      `Reacciones: ${r.reactions
        .slice(0, MAX_REACTION_QUESTIONS)
        .map((x) => {
          const signs = x.signs.map((s) => s.label.toLowerCase()).join(', ');
          return `${fmtDayMonth(x.at)}, ${x.severity === 'strong' ? 'fuerte' : 'leve'}, ${x.suspects
            .join(', ')
            .toLowerCase()}${signs ? ` (${signs})` : ''}`;
        })
        .join('; ')}.`,
    );
  }
  if (r.acceptance.favorites.length > 0) {
    lines.push(
      `Le encantan: ${r.acceptance.favorites
        .slice(0, 8)
        .map((f) => f.name.toLowerCase())
        .join(', ')}.`,
    );
  }
  if (r.acceptance.notYet.length > 0) {
    lines.push(
      `Todavía no le gustan: ${r.acceptance.notYet
        .slice(0, 8)
        .map((f) => `${f.name.toLowerCase()} (rechazado ${f.refusals} de ${f.exposures})`)
        .join(', ')}.`,
    );
  }
  if (r.textures.total > 0) {
    lines.push(
      `Texturas: ${FORMATS.filter((f) => r.textures.totals[f] > 0)
        .map((f) => `${FORMAT_LABELS[f].toLowerCase()} ${r.textures.totals[f]}`)
        .join(', ')}.`,
    );
  }
  if (r.gagging.meals > 0) {
    lines.push(
      `Arcadas en ${r.gagging.meals} ${r.gagging.meals === 1 ? 'comida' : 'comidas'} (${r.gagging.recent} en las últimas 2 semanas).`,
    );
  }
  if (r.iron.windowDays > 0) {
    lines.push(
      `Hierro: comió algo con hierro ${r.iron.daysWithIron} de los últimos ${r.iron.windowDays} días.`,
    );
  }
  if (r.questions.length > 0) {
    lines.push(`Preguntas que sugiere la app: ${r.questions.map((q) => q.text).join(' ')}`);
  }
  return lines.map((l) => `- ${l}`).join('\n');
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function monthsLabel(n: number): string {
  return n === 1 ? '1 mes' : `${n} meses`;
}

/** "a", "a y b", "a, b y c". */
export function joinEs(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/** "3 de noviembre" (o "3 de noviembre de 2026") en hora de Argentina. */
export function fmtDayMonth(iso: string, withYear = false): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: AR_TZ,
  });
}
