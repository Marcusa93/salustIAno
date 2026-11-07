/**
 * Resumen de la alimentación complementaria para el contexto de SalustIA:
 * lo justo para que responda como especialista en nutrición infantil sin
 * tener que llamar herramientas (qué probó, cómo le fue, alérgenos, hierro).
 */

import { FOOD_GROUP_LABELS } from './catalog';
import { ACCEPTANCE_LABELS, FORMAT_LABELS, METHOD_LABELS, REACTION_SIGN_LABELS } from './labels';
import {
  allergenStatuses,
  dayNumber,
  ironFoods,
  mealsOnDay,
  methodOf,
  reofferList,
  suggestNext,
  summarizeFoods,
} from './progress';
import type { FoodGroup, Meal, SolidMethod } from './types';

const MAX_FOODS = 40;

const ALLERGEN_STATE_TEXT = {
  pending: 'sin probar',
  introducing: 'sumándolo',
  maintain: 'incorporado',
  lapsed: 'hace rato que no lo come',
  reaction: 'HUBO REACCIÓN',
} as const;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/** Método que más usaron en las últimas comidas (papilla / BLW / mixto). */
function usualMethod(meals: readonly Meal[]): SolidMethod | null {
  const counts = new Map<SolidMethod, number>();
  const lastSeen = new Map<SolidMethod, number>();
  meals.slice(-10).forEach((m, i) => {
    const method = methodOf(m);
    if (!method) return;
    counts.set(method, (counts.get(method) ?? 0) + 1);
    lastSeen.set(method, i);
  });
  // El más usado; si empatan, el de la comida más reciente.
  let best: SolidMethod | null = null;
  for (const [method, n] of counts) {
    const bestN = best ? (counts.get(best) ?? 0) : -1;
    if (
      n > bestN ||
      (n === bestN && (lastSeen.get(method) ?? 0) > (lastSeen.get(best as SolidMethod) ?? 0))
    ) {
      best = method;
    }
  }
  return best;
}

export function solidsContextForAI(
  meals: readonly Meal[],
  { now, ageMonths }: { now: Date; ageMonths: number },
): string | null {
  if (meals.length === 0) {
    if (ageMonths < 5) return null;
    return [
      '## Alimentación complementaria',
      '',
      '- Todavía no hay comidas sólidas anotadas en la app (sección Comidas).',
    ].join('\n');
  }

  const summaries = summarizeFoods(meals);
  const lines: string[] = [];
  const first = meals[0];
  const day = dayNumber(meals, now);
  if (first)
    lines.push(`- Empezó con sólidos el ${fmtDate(first.occurredAt)} (hoy es el día ${day}).`);
  const method = usualMethod(meals);
  if (method) lines.push(`- Método que vienen usando: ${METHOD_LABELS[method]}.`);

  const today = mealsOnDay(meals, now);
  if (today.length === 0) {
    lines.push('- Hoy todavía no comió sólidos.');
  } else {
    for (const m of today) {
      const foods = m.tastings
        .map((t) => {
          const bits = [
            t.acceptance ? ACCEPTANCE_LABELS[t.acceptance].toLowerCase() : null,
            t.format ? FORMAT_LABELS[t.format].toLowerCase() : null,
            t.gagged ? 'arcadas' : null,
          ].filter(Boolean);
          return bits.length ? `${t.foodName} (${bits.join(', ')})` : t.foodName;
        })
        .join('; ');
      lines.push(`- Hoy a las ${fmtTime(m.occurredAt)}: ${foods}.`);
    }
  }
  const iron = ironFoods(today);
  lines.push(
    iron.length > 0
      ? `- Hierro hoy: sí (${iron.join(', ').toLowerCase()}).`
      : '- Hierro hoy: todavía no comió nada con hierro.',
  );

  const listed = summaries.slice(0, MAX_FOODS).map((s) => {
    const last = s.lastAcceptance
      ? `, última vez: ${ACCEPTANCE_LABELS[s.lastAcceptance].toLowerCase()}`
      : '';
    const reaction = s.maxReaction !== 'none' ? ', TUVO REACCIÓN' : '';
    return `${s.name} (${s.exposures}×${last}${reaction})`;
  });
  lines.push(
    `- Probó ${summaries.length} alimentos distintos: ${listed.join('; ')}${
      summaries.length > MAX_FOODS ? '; …' : ''
    }.`,
  );

  const groups = new Set(summaries.map((s) => s.food?.group).filter(Boolean) as FoodGroup[]);
  const missing = (Object.keys(FOOD_GROUP_LABELS) as FoodGroup[]).filter((g) => !groups.has(g));
  if (missing.length > 0) {
    lines.push(
      `- Grupos que todavía no probó: ${missing.map((g) => FOOD_GROUP_LABELS[g].toLowerCase()).join(', ')}.`,
    );
  }

  const reoffer = reofferList(summaries);
  if (reoffer.length > 0) {
    lines.push(
      `- Todavía no le entran (volver a ofrecer sin presión): ${reoffer
        .map((s) => `${s.name} (${s.exposures} ${s.exposures === 1 ? 'intento' : 'intentos'})`)
        .join(', ')}.`,
    );
  }

  const reactions = summaries.filter((s) => s.maxReaction !== 'none');
  if (reactions.length > 0) {
    lines.push(
      `- Reacciones anotadas: ${reactions
        .map((s) => {
          const signs = s.reactionSigns
            .map((x) => REACTION_SIGN_LABELS[x].toLowerCase())
            .join(', ');
          return `${s.name} (${s.maxReaction === 'strong' ? 'fuerte' : 'leve'}${signs ? `: ${signs}` : ''})`;
        })
        .join('; ')}.`,
    );
  }

  const allergens = allergenStatuses(meals, now)
    .map((a) => `${a.label.toLowerCase()}: ${ALLERGEN_STATE_TEXT[a.state]}`)
    .join('; ');
  lines.push(`- Alérgenos: ${allergens}.`);

  const { suggestions, allergenHold } = suggestNext(meals, summaries, { ageMonths, now });
  if (suggestions.length > 0) {
    lines.push(
      `- La app le sugiere probar: ${suggestions.map((s) => s.food.name.toLowerCase()).join(', ')}.`,
    );
  }
  if (allergenHold) lines.push(`- ${allergenHold}`);

  return ['## Alimentación complementaria (ya lo sabés, no preguntes)', '', ...lines].join('\n');
}
