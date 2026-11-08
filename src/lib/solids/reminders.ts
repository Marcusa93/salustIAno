/**
 * Recordatorio push de alérgenos (sólidos). Puro, sin I/O: el cron de las
 * 18 h (Argentina) le pasa las comidas y decide si la familia recibe un aviso
 * para planear la comida de mañana. Como mucho uno por día.
 *
 * - Sostener: una vez que lo incorporó, el alérgeno se mantiene dándolo al
 *   menos una vez por semana. Avisamos desde los 5 días sin comerlo.
 * - Sumar: mientras lo está incorporando (1 o 2 veces), conviene ofrecerlo
 *   unas 3 veces con unos días de diferencia. Avisamos desde los 3 días.
 * - Si hubo cualquier reacción en las últimas 2 semanas no avisamos nada:
 *   primero se habla con la pediatra.
 */

import { type AllergenStatus, allergenStatuses, daysBetween } from './progress';
import type { AllergenKey, Meal } from './types';

/** Desde cuántos días sin comerlo avisamos de un alérgeno ya incorporado. */
export const MAINTAIN_REMIND_AFTER_DAYS = 5;
/** Desde cuántos días sin comerlo avisamos de un alérgeno que está sumando. */
export const INTRO_REMIND_AFTER_DAYS = 3;
/** Veces que conviene ofrecerlo mientras se incorpora. */
export const INTRO_TARGET = 3;
/** Con una reacción en estos últimos días, silencio total. */
export const REACTION_HOLD_DAYS = 14;
/** Arriba de esto el sistema corta el texto del push. */
export const MAX_BODY_CHARS = 160;
/** Alérgenos a sostener que nombramos como mucho en un aviso. */
const MAX_MAINTAIN_MENTIONS = 2;

export interface AllergenPush {
  title: string;
  body: string;
}

interface Noun {
  /** Cómo se nombra dentro de una frase, en minúscula. */
  name: string;
  feminine: boolean;
  plural: boolean;
}

/**
 * Nombres para el push. No usamos ALLERGEN_LABELS tal cual: "Trigo (gluten)"
 * o "Leche de vaca" quedan raros en una frase ("no la come"); el bebé la
 * recibe como yogur o queso, así que hablamos de lácteos.
 */
const NOUNS: Record<AllergenKey, Noun> = {
  huevo: { name: 'huevo', feminine: false, plural: false },
  mani: { name: 'maní', feminine: false, plural: false },
  leche: { name: 'lácteos', feminine: false, plural: true },
  trigo: { name: 'trigo', feminine: false, plural: false },
  pescado: { name: 'pescado', feminine: false, plural: false },
  sesamo: { name: 'sésamo', feminine: false, plural: false },
  frutos_secos: { name: 'frutos secos', feminine: false, plural: true },
  soja: { name: 'soja', feminine: true, plural: false },
  mariscos: { name: 'mariscos', feminine: false, plural: true },
};

type Due = AllergenStatus & { daysSinceLast: number };

/**
 * El aviso de alérgenos del día para la familia, o null si no hay nada que
 * decir. `firstName` es el nombre de pila del bebé ("Salu").
 */
export function allergenReminder(
  meals: readonly Meal[],
  now: Date,
  firstName: string,
): AllergenPush | null {
  if (meals.length === 0) return null;
  if (hadRecentReaction(meals, now)) return null;

  const statuses = allergenStatuses(meals, now);
  // `allergenStatuses` viene en ALLERGEN_ORDER y el sort es estable: a igual
  // cantidad de días, primero el que se suma antes en el camino.
  const maintain = statuses
    .filter(isDue)
    .filter(
      (s) =>
        (s.state === 'maintain' || s.state === 'lapsed') &&
        s.daysSinceLast >= MAINTAIN_REMIND_AFTER_DAYS,
    )
    .sort(mostOverdueFirst)
    .slice(0, MAX_MAINTAIN_MENTIONS);
  const intro =
    statuses
      .filter(isDue)
      .filter((s) => s.state === 'introducing' && s.daysSinceLast >= INTRO_REMIND_AFTER_DAYS)
      .sort(mostOverdueFirst)[0] ?? null;

  // "tu bebé" encaja igual en todas las frases ("que tu bebé no lo come").
  const name = firstName.trim() || 'tu bebé';

  // Sostener tiene prioridad. Si además hay uno sumándose, lo agregamos
  // en versión corta solo si entra; si no, queda para otro día.
  let candidates: string[];
  if (maintain.length > 0) {
    candidates = [
      ...(intro ? [combinedBody(maintain, intro, name)] : []),
      maintainBody(maintain, name, true),
      maintainBody(maintain, name, false),
    ];
  } else if (intro) {
    candidates = [introBody(intro, name)];
  } else {
    return null;
  }

  return { title: `🥚 Alérgenos de ${name}`, body: firstThatFits(candidates) };
}

/** Cualquier reacción (de cualquier alimento) en las últimas 2 semanas. */
function hadRecentReaction(meals: readonly Meal[], now: Date): boolean {
  return meals.some((m) => {
    const days = daysBetween(m.occurredAt, now);
    if (days < 0 || days > REACTION_HOLD_DAYS) return false;
    return m.reaction !== 'none' || m.tastings.some((t) => t.reaction !== 'none');
  });
}

function isDue(s: AllergenStatus): s is Due {
  return s.daysSinceLast !== null;
}

function mostOverdueFirst(a: Due, b: Due): number {
  return b.daysSinceLast - a.daysSinceLast;
}

function firstThatFits(candidates: readonly string[]): string {
  return candidates.find((c) => c.length <= MAX_BODY_CHARS) ?? (candidates.at(-1) as string);
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/**
 * "Huevo y maní: hace 6 días que Salu no los come. Para sostener la
 * tolerancia, conviene darlos al menos una vez por semana. ¿Los sumás mañana?"
 */
function maintainBody(due: readonly Due[], name: string, withPlan: boolean): string {
  const pron = pronoun(due);
  const text = `${maintainLead(due, name)} Para sostener la tolerancia, conviene dar${pron} al menos una vez por semana.`;
  return withPlan ? `${text} ¿${capitalize(pron)} sumás mañana?` : text;
}

/**
 * "Huevo: hace 6 días que Salu no lo come. Para sostener la tolerancia,
 * sumalo mañana. Y seguí con el maní: lleva 2 de 3 veces."
 */
function combinedBody(due: readonly Due[], intro: Due, name: string): string {
  return `${maintainLead(due, name)} Para sostener la tolerancia, suma${pronoun(due)} mañana. Y seguí con ${withArticle(intro)}: lleva ${introProgress(intro)}.`;
}

/**
 * "Mañana seguí con el maní: Salu lleva 2 de 3 veces. Ofrecerlo con unos días
 * de diferencia ayuda a confirmar que lo tolera."
 */
function introBody(intro: Due, name: string): string {
  const pron = pronoun([intro]);
  return `Mañana seguí con ${withArticle(intro)}: ${name} lleva ${introProgress(intro)}. Ofrecer${pron} con unos días de diferencia ayuda a confirmar que ${pron} tolera.`;
}

/** "Huevo y maní: hace 6 días que Salu no los come." */
function maintainLead(due: readonly Due[], name: string): string {
  const subject = capitalize(due.map((s) => NOUNS[s.allergen].name).join(' y '));
  const days = due.map((s) => s.daysSinceLast);
  const min = Math.min(...days);
  const gap = gapPhrase(min, Math.max(...days) !== min);
  return `${subject}: ${gap} que ${name} no ${pronoun(due)} come.`;
}

function introProgress(intro: Due): string {
  return `${Math.min(intro.exposures, INTRO_TARGET)} de ${INTRO_TARGET} veces`;
}

/**
 * Cuánto hace que no lo come, en palabras. Con `atLeast`, el número es el
 * menor de varios alérgenos y la frase tiene que valer para todos.
 */
export function gapPhrase(days: number, atLeast = false): string {
  if (days < 14) return atLeast ? `hace al menos ${days} días` : `hace ${days} días`;
  if (days <= 30) {
    const weeks = Math.floor(days / 7);
    if (days % 7 !== 0) return `hace más de ${weeks} semanas`;
    return atLeast ? `hace al menos ${weeks} semanas` : `hace ${weeks} semanas`;
  }
  const months = Math.floor((days - 1) / 30);
  return months === 1 ? 'hace más de un mes' : `hace más de ${months} meses`;
}

/** lo / la / los / las, según el o los alérgenos. */
function pronoun(due: readonly Due[]): string {
  const nouns = due.map((s) => NOUNS[s.allergen]);
  const plural = nouns.length > 1 || nouns.some((n) => n.plural);
  const feminine = nouns.every((n) => n.feminine);
  return `l${feminine ? 'a' : 'o'}${plural ? 's' : ''}`;
}

/** "el maní", "la soja", "los frutos secos". */
function withArticle(s: Due): string {
  const noun = NOUNS[s.allergen];
  const article = noun.feminine ? (noun.plural ? 'las' : 'la') : noun.plural ? 'los' : 'el';
  return `${article} ${noun.name}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
