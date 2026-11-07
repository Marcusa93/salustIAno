import { describe, expect, it } from 'vitest';

import { FOOD_BY_KEY } from './catalog';
import {
  allergenStatuses,
  buildMeals,
  dayNumber,
  daysBetween,
  ironFoods,
  mealsOnDay,
  mealsPerDayGuide,
  methodOf,
  reofferList,
  resolveFood,
  suggestNext,
  summarizeFoods,
} from './progress';
import type { FoodAcceptance, FoodFormat, FoodReaction, Meal, Tasting } from './types';

let seq = 0;

interface T {
  key: string;
  acceptance?: FoodAcceptance;
  format?: FoodFormat;
  reaction?: FoodReaction;
  gagged?: boolean;
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
      format: t.format ?? null,
      acceptance: t.acceptance ?? null,
      amount: null,
      gagged: t.gagged ?? false,
      reaction: t.reaction ?? 'none',
      reactionSigns: [],
    };
  });
  return { id, occurredAt: at, notes: null, reaction: 'none', tastings };
}

// 7 de noviembre de 2026, 15:00 en Argentina.
const NOW = new Date('2026-11-07T18:00:00Z');

describe('resolveFood', () => {
  it('reconoce el catálogo y arma claves propias para lo que no está', () => {
    expect(resolveFood('papilla de zapallo').key).toBe('zapallo');
    const custom = resolveFood('  guiso de la abuela ');
    expect(custom.key).toBe('otro:guiso_de_la_abuela');
    expect(custom.name).toBe('Guiso de la abuela');
    expect(custom.food).toBeNull();
  });
});

describe('buildMeals', () => {
  it('junta los alimentos de cada comida en orden y ordena las comidas por fecha', () => {
    const meals = buildMeals(
      [
        {
          id: 'b',
          occurred_at: '2026-11-08T15:00:00Z',
          foods: ['Banana'],
          reaction: 'none',
          notes: null,
        },
        {
          id: 'a',
          occurred_at: '2026-11-07T15:00:00Z',
          foods: ['Zapallo', 'Palta'],
          reaction: 'none',
          notes: 'rico',
        },
      ],
      [
        {
          id: 'r2',
          feeding_event_id: 'a',
          food_key: 'palta',
          food_name: 'Palta',
          format: 'finger',
          acceptance: 'liked',
          amount: 'some',
          gagged: true,
          reaction: 'none',
          reaction_signs: ['algo_raro'],
          position: 1,
        },
        {
          id: 'r1',
          feeding_event_id: 'a',
          food_key: 'zapallo',
          food_name: 'Zapallo',
          format: 'puree',
          acceptance: 'loved',
          amount: 'half',
          gagged: false,
          reaction: 'none',
          reaction_signs: null,
          position: 0,
        },
      ],
    );
    expect(meals.map((m) => m.id)).toEqual(['a', 'b']);
    expect(meals[0]?.tastings.map((t) => t.foodKey)).toEqual(['zapallo', 'palta']);
    expect(meals[0]?.tastings[1]?.reactionSigns).toEqual([]);
    expect(meals[0]?.notes).toBe('rico');
  });

  it('las comidas viejas sin detalle salen de `foods` y heredan la reacción', () => {
    const [m] = buildMeals(
      [
        {
          id: 'x',
          occurred_at: '2026-11-07T15:00:00Z',
          foods: ['zapallo', 'guiso'],
          reaction: 'mild',
          notes: null,
        },
      ],
      [],
    );
    expect(m?.tastings.map((t) => t.foodKey)).toEqual(['zapallo', 'otro:guiso']);
    expect(m?.tastings.every((t) => t.reaction === 'mild')).toBe(true);
  });
});

describe('methodOf', () => {
  it('papilla, BLW, mixto o sin dato', () => {
    expect(methodOf(meal('2026-11-07T15:00:00Z', [{ key: 'zapallo', format: 'puree' }]))).toBe(
      'papilla',
    );
    expect(methodOf(meal('2026-11-07T15:00:00Z', [{ key: 'banana', format: 'finger' }]))).toBe(
      'blw',
    );
    expect(
      methodOf(
        meal('2026-11-07T15:00:00Z', [
          { key: 'zapallo', format: 'mashed' },
          { key: 'banana', format: 'preloaded' },
        ]),
      ),
    ).toBe('mixto');
    expect(methodOf(meal('2026-11-07T15:00:00Z', ['zapallo']))).toBeNull();
  });
});

describe('summarizeFoods', () => {
  it('cuenta exposiciones por comida y calcula el estado', () => {
    const meals = [
      meal('2026-11-01T15:00:00Z', [
        { key: 'zapallo', acceptance: 'liked' },
        { key: 'zapallo', acceptance: 'liked' },
      ]),
      meal('2026-11-02T15:00:00Z', [{ key: 'zapallo', acceptance: 'loved' }]),
      meal('2026-11-03T15:00:00Z', [{ key: 'banana', acceptance: 'refused' }]),
      meal('2026-11-04T15:00:00Z', [{ key: 'palta', reaction: 'mild', acceptance: 'loved' }]),
      meal('2026-11-05T15:00:00Z', ['batata']),
    ];
    const byKey = new Map(summarizeFoods(meals).map((s) => [s.key, s]));
    expect(byKey.get('zapallo')?.exposures).toBe(2);
    expect(byKey.get('zapallo')?.status).toBe('favorite');
    expect(byKey.get('banana')?.status).toBe('learning');
    expect(byKey.get('palta')?.status).toBe('reaction');
    expect(byKey.get('batata')?.status).toBe('unknown');
    expect(summarizeFoods(meals)[0]?.key).toBe('batata');
  });

  it('después de muchos intentos sin suerte, sugiere una pausa', () => {
    const meals = Array.from({ length: 15 }, (_, i) =>
      meal(`2026-11-${String(i + 1).padStart(2, '0')}T15:00:00Z`, [
        { key: 'brocoli', acceptance: 'refused' },
      ]),
    );
    expect(summarizeFoods(meals)[0]?.status).toBe('paused');
  });
});

describe('reofferList', () => {
  it('solo lo que todavía no le entra, primero lo que hace más que no ve', () => {
    const meals = [
      meal('2026-11-01T15:00:00Z', [{ key: 'banana', acceptance: 'disliked' }]),
      meal('2026-11-02T15:00:00Z', [{ key: 'zapallo', acceptance: 'loved' }]),
      meal('2026-11-03T15:00:00Z', [{ key: 'pera', acceptance: 'refused' }]),
    ];
    expect(reofferList(summarizeFoods(meals)).map((s) => s.key)).toEqual(['banana', 'pera']);
  });
});

describe('allergenStatuses', () => {
  const byAllergen = (meals: Meal[]) =>
    new Map(allergenStatuses(meals, NOW).map((a) => [a.allergen, a]));

  it('sin probar, sumándolo, incorporado, hace rato y con reacción', () => {
    const map = byAllergen([
      meal('2026-11-07T13:00:00Z', ['huevo']),
      meal('2026-11-02T13:00:00Z', ['yogur']),
      meal('2026-11-04T13:00:00Z', ['yogur']),
      meal('2026-11-06T13:00:00Z', ['yogur']),
      meal('2026-10-20T13:00:00Z', ['merluza']),
      meal('2026-11-05T13:00:00Z', [{ key: 'pasta_mani', reaction: 'mild' }]),
    ]);
    expect(map.get('huevo')?.state).toBe('introducing');
    expect(map.get('leche')?.state).toBe('maintain');
    expect(map.get('leche')?.exposures).toBe(3);
    expect(map.get('pescado')?.state).toBe('lapsed');
    expect(map.get('mani')?.state).toBe('reaction');
    expect(map.get('soja')?.state).toBe('pending');
  });
});

describe('suggestNext', () => {
  it('el primer día: algo con hierro y alimentos suaves, nunca alérgenos', () => {
    const { suggestions, allergenHold } = suggestNext([], [], { ageMonths: 6, now: NOW });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.tag).toBe('hierro');
    expect(suggestions.some((s) => s.tag === 'inicio')).toBe(true);
    expect(suggestions.some((s) => (s.food.allergens ?? []).length > 0)).toBe(false);
    expect(allergenHold).toBeNull();
  });

  it('no repite lo que ya probó ni sugiere lo que es para más adelante', () => {
    const meals = [meal('2026-11-07T13:00:00Z', ['zapallo', 'carne', 'batata'])];
    const summaries = summarizeFoods(meals);
    const { suggestions } = suggestNext(meals, summaries, { ageMonths: 6, now: NOW, limit: 10 });
    const keys = suggestions.map((s) => s.food.key);
    expect(keys).not.toContain('zapallo');
    expect(suggestions.every((s) => s.food.fromMonths <= 6)).toBe(true);
  });

  it('con algunas comidas encima, suma un alérgeno (huevo primero)', () => {
    const meals = [meal('2026-11-03T13:00:00Z', ['zapallo', 'carne', 'batata', 'palta'])];
    const { suggestions } = suggestNext(meals, summarizeFoods(meals), { ageMonths: 6, now: NOW });
    const allergen = suggestions.find((s) => s.tag === 'alergeno');
    expect(allergen?.food.allergens).toContain('huevo');
  });

  it('espera unos días después de un alérgeno nuevo', () => {
    const meals = [
      meal('2026-11-01T13:00:00Z', ['zapallo', 'carne', 'batata']),
      meal('2026-11-06T13:00:00Z', ['huevo']),
    ];
    const { suggestions, allergenHold } = suggestNext(meals, summarizeFoods(meals), {
      ageMonths: 6,
      now: NOW,
    });
    expect(suggestions.some((s) => s.tag === 'alergeno')).toBe(false);
    expect(allergenHold).toMatch(/esperá/i);
  });

  it('después de una reacción, frena los alérgenos y manda a la pediatra', () => {
    const meals = [
      meal('2026-11-01T13:00:00Z', ['zapallo', 'carne', 'batata']),
      meal('2026-11-05T13:00:00Z', [{ key: 'durazno', reaction: 'mild' }]),
    ];
    const { suggestions, allergenHold } = suggestNext(meals, summarizeFoods(meals), {
      ageMonths: 6,
      now: NOW,
    });
    expect(suggestions.some((s) => s.tag === 'alergeno')).toBe(false);
    expect(allergenHold).toMatch(/pediatra/);
  });
});

describe('días y hierro', () => {
  it('cuenta días calendario de Argentina, no de UTC', () => {
    // 23:00 del 6/11 y 01:00 del 7/11 en Argentina.
    expect(daysBetween('2026-11-07T02:00:00Z', '2026-11-07T04:00:00Z')).toBe(1);
    expect(daysBetween('2026-11-07T04:00:00Z', '2026-11-07T20:00:00Z')).toBe(0);
  });

  it('las comidas de hoy, el día de arranque y el hierro', () => {
    const meals = [
      meal('2026-11-06T13:00:00Z', ['zapallo']),
      meal('2026-11-07T13:00:00Z', ['carne', 'zapallo']),
    ];
    const today = mealsOnDay(meals, NOW);
    expect(today).toHaveLength(1);
    expect(ironFoods(today)).toEqual(['Carne vacuna']);
    expect(dayNumber(meals, NOW)).toBe(2);
    expect(dayNumber([], NOW)).toBeNull();
  });

  it('comidas por día según la edad', () => {
    expect(mealsPerDayGuide(6)).toMatch(/1 comida/);
    expect(mealsPerDayGuide(8)).toMatch(/2 o 3/);
    expect(mealsPerDayGuide(10)).toMatch(/colaciones/);
  });
});
