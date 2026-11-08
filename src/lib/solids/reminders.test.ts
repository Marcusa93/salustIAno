import { describe, expect, it } from 'vitest';

import { ALLERGEN_FIRST_FOOD, FOOD_BY_KEY } from './catalog';
import { ALLERGEN_ORDER } from './progress';
import { MAX_BODY_CHARS, allergenReminder, gapPhrase } from './reminders';
import type { FoodReaction, Meal, Tasting } from './types';

let seq = 0;

interface T {
  key: string;
  reaction?: FoodReaction;
}

function meal(at: string, foods: Array<string | T>): Meal {
  seq += 1;
  const id = `m${seq}`;
  const tastings: Tasting[] = foods.map((f, i) => {
    const t: T = typeof f === 'string' ? { key: f } : f;
    return {
      id: `${id}-${i}`,
      mealId: id,
      occurredAt: at,
      foodKey: t.key,
      foodName: FOOD_BY_KEY.get(t.key)?.name ?? t.key,
      format: null,
      acceptance: null,
      amount: null,
      gagged: false,
      reaction: t.reaction ?? 'none',
      reactionSigns: [],
    };
  });
  return { id, occurredAt: at, notes: null, reaction: 'none', tastings };
}

// 7 de noviembre de 2026, 18:00 en Argentina: la hora del cron.
const NOW = new Date('2026-11-07T21:00:00Z');

/** Hace `n` días, a las 10 de la mañana de Argentina. */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000 - 8 * 3_600_000).toISOString();
}

/** Tres comidas con esos alimentos, la última hace `last` días: ya incorporado. */
function introduced(foods: string[], last: number): Meal[] {
  return [
    meal(daysAgo(last + 6), foods),
    meal(daysAgo(last + 3), foods),
    meal(daysAgo(last), foods),
  ];
}

describe('allergenReminder', () => {
  it('sin comidas no hay aviso', () => {
    expect(allergenReminder([], NOW, 'Salu')).toBeNull();
  });

  it('sin alérgenos probados, o comidos hace poco, tampoco', () => {
    expect(allergenReminder([meal(daysAgo(6), ['zapallo', 'banana'])], NOW, 'Salu')).toBeNull();
    expect(allergenReminder(introduced(['huevo'], 4), NOW, 'Salu')).toBeNull();
    expect(allergenReminder([meal(daysAgo(2), ['pasta_mani'])], NOW, 'Salu')).toBeNull();
  });

  it('sostener: a los 5 días sin comerlo avisa, con el nombre del bebé', () => {
    expect(allergenReminder(introduced(['huevo'], 5), NOW, 'Salu')).not.toBeNull();
    expect(allergenReminder(introduced(['huevo'], 6), NOW, 'Salu')).toEqual({
      title: '🥚 Alérgenos de Salu',
      body: 'Huevo: hace 6 días que Salu no lo come. Para sostener la tolerancia, conviene darlo al menos una vez por semana. ¿Lo sumás mañana?',
    });
  });

  it('nombra hasta dos, el más atrasado primero, en plural', () => {
    const same = allergenReminder(introduced(['huevo', 'pasta_mani'], 6), NOW, 'Salu');
    expect(same?.body).toBe(
      'Huevo y maní: hace 6 días que Salu no los come. Para sostener la tolerancia, conviene darlos al menos una vez por semana. ¿Los sumás mañana?',
    );

    const meals = [
      ...introduced(['huevo'], 6),
      ...introduced(['pasta_mani'], 9),
      ...introduced(['yogur'], 7),
    ];
    const body = allergenReminder(meals, NOW, 'Salu')?.body ?? '';
    expect(body.startsWith('Maní y lácteos: hace al menos 7 días que Salu no los come.')).toBe(
      true,
    );
    expect(body).not.toMatch(/huevo/i);
  });

  it('concuerda género y número', () => {
    const soja = allergenReminder(introduced(['tofu'], 6), NOW, 'Salu')?.body ?? '';
    expect(soja).toMatch(/^Soja: .* no la come\. .*darla .*¿La sumás mañana\?$/);
    const nuts = allergenReminder(introduced(['almendras'], 6), NOW, 'Salu')?.body ?? '';
    expect(nuts).toMatch(/^Frutos secos: .* no los come\. .*darlos .*¿Los sumás mañana\?$/);
  });

  it('para los huecos largos habla de semanas o meses', () => {
    expect(allergenReminder(introduced(['huevo'], 16), NOW, 'Salu')?.body).toMatch(
      /^Huevo: hace más de 2 semanas que/,
    );
    expect(allergenReminder(introduced(['huevo'], 45), NOW, 'Salu')?.body).toMatch(
      /^Huevo: hace más de un mes que/,
    );
  });

  it('sumar: con 1 o 2 veces, a los 3 días propone seguir', () => {
    const meals = [meal(daysAgo(6), ['pasta_mani']), meal(daysAgo(3), ['pasta_mani'])];
    expect(allergenReminder(meals, NOW, 'Salu')).toEqual({
      title: '🥚 Alérgenos de Salu',
      body: 'Mañana seguí con el maní: Salu lleva 2 de 3 veces. Ofrecerlo con unos días de diferencia ayuda a confirmar que lo tolera.',
    });
    expect(allergenReminder([meal(daysAgo(4), ['yogur'])], NOW, 'Salu')?.body).toMatch(
      /^Mañana seguí con los lácteos: Salu lleva 1 de 3 veces\. Ofrecerlos .* que los tolera\.$/,
    );
  });

  it('sostener va primero; si entra, suma el que se está incorporando', () => {
    const meals = [...introduced(['huevo', 'pasta_mani'], 6), meal(daysAgo(4), ['merluza'])];
    expect(allergenReminder(meals, NOW, 'Salu')?.body).toBe(
      'Huevo y maní: hace 6 días que Salu no los come. Para sostener la tolerancia, sumalos mañana. Y seguí con el pescado: lleva 1 de 3 veces.',
    );
  });

  it('si no entra todo, se queda con sostener', () => {
    const meals = [
      ...introduced(['almendras'], 13),
      ...introduced(['langostinos'], 11),
      meal(daysAgo(4), ['tahini']),
    ];
    const body = allergenReminder(meals, NOW, 'Salustiano')?.body ?? '';
    expect(body.startsWith('Frutos secos y mariscos: hace al menos 11 días')).toBe(true);
    expect(body).not.toMatch(/sésamo/);
    expect(body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
  });

  it('con una reacción en las últimas 2 semanas no avisa nada', () => {
    const due = introduced(['huevo'], 8);
    expect(
      allergenReminder(
        [...due, meal(daysAgo(10), [{ key: 'durazno', reaction: 'mild' }])],
        NOW,
        'Salu',
      ),
    ).toBeNull();
    expect(
      allergenReminder(
        [...due, meal(daysAgo(14), [{ key: 'zapallo', reaction: 'strong' }])],
        NOW,
        'Salu',
      ),
    ).toBeNull();
    // Pasadas las 2 semanas vuelve a avisar.
    expect(
      allergenReminder(
        [...due, meal(daysAgo(15), [{ key: 'durazno', reaction: 'mild' }])],
        NOW,
        'Salu',
      ),
    ).not.toBeNull();
  });

  it('nunca nombra un alérgeno con reacción ni uno sin probar', () => {
    const meals = [
      ...introduced(['huevo'], 6),
      meal(daysAgo(30), [{ key: 'pasta_mani', reaction: 'mild' }]),
    ];
    const body = allergenReminder(meals, NOW, 'Salu')?.body ?? '';
    expect(body).toMatch(/^Huevo: /);
    expect(body).not.toMatch(/maní|soja|pescado|lácteos/i);

    expect(
      allergenReminder([meal(daysAgo(30), [{ key: 'pasta_mani', reaction: 'mild' }])], NOW, 'Salu'),
    ).toBeNull();
  });

  it('sin nombre, habla de "tu bebé"', () => {
    const push = allergenReminder(introduced(['huevo'], 6), NOW, '  ');
    expect(push?.title).toBe('🥚 Alérgenos de tu bebé');
    expect(push?.body).toMatch(/que tu bebé no lo come/);
  });

  it('el texto entra en un push para cualquier combinación', () => {
    const first = (a: (typeof ALLERGEN_ORDER)[number]) => ALLERGEN_FIRST_FOOD[a];
    for (const a of ALLERGEN_ORDER) {
      for (const b of ALLERGEN_ORDER) {
        for (const c of ALLERGEN_ORDER) {
          if (a === b || b === c || a === c) continue;
          const meals = [
            ...introduced([first(a)], 40),
            ...introduced([first(b)], 13),
            meal(daysAgo(4), [first(c)]),
          ];
          const push = allergenReminder(meals, NOW, 'Salustiano');
          expect(push?.body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
        }
      }
    }
  });
});

describe('gapPhrase', () => {
  it('días, semanas y meses', () => {
    expect(gapPhrase(6)).toBe('hace 6 días');
    expect(gapPhrase(6, true)).toBe('hace al menos 6 días');
    expect(gapPhrase(14)).toBe('hace 2 semanas');
    expect(gapPhrase(14, true)).toBe('hace al menos 2 semanas');
    expect(gapPhrase(16)).toBe('hace más de 2 semanas');
    expect(gapPhrase(30)).toBe('hace más de 4 semanas');
    expect(gapPhrase(31)).toBe('hace más de un mes');
    expect(gapPhrase(60)).toBe('hace más de un mes');
    expect(gapPhrase(75)).toBe('hace más de 2 meses');
  });
});
