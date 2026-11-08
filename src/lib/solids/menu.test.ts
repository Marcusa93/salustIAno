import { describe, expect, it } from 'vitest';

import { type SolidsMenuOutput, solidsMenuOutputSchema } from '@/lib/ai/agents/solids-menu/schema';
import { FOODS, FOOD_BY_KEY } from './catalog';
import {
  type MenuHistory,
  avoidReason,
  buildMenuInput,
  menuWeekDays,
  prepAddsForbidden,
  resolveMenuFood,
  usualMethod,
  validateMenu,
  weekRangeLabel,
} from './menu';
import type { FoodAcceptance, FoodFormat, FoodReaction, Meal, Tasting } from './types';

let seq = 0;

interface T {
  key: string;
  acceptance?: FoodAcceptance;
  format?: FoodFormat;
  reaction?: FoodReaction;
}

function meal(at: string, foods: Array<string | T>): Meal {
  seq += 1;
  const id = `m${seq}`;
  const tastings: Tasting[] = foods.map((f, i) => {
    const t: T = typeof f === 'string' ? { key: f, acceptance: 'liked' } : f;
    return {
      id: `${id}-${i}`,
      mealId: id,
      occurredAt: at,
      foodKey: t.key,
      foodName: FOOD_BY_KEY.get(t.key)?.name ?? t.key,
      format: t.format ?? null,
      acceptance: t.acceptance ?? null,
      amount: null,
      gagged: false,
      reaction: t.reaction ?? 'none',
      reactionSigns: [],
    };
  });
  return { id, occurredAt: at, notes: null, reaction: 'none', tastings };
}

// Sábado 7 de noviembre de 2026, 15:00 en Argentina.
const NOW = new Date('2026-11-07T18:00:00Z');
const TODAY = '2026-11-07';

/** Una semana de sólidos sin alérgenos: zapallo, carne, batata y banana. */
const BASE_MEALS: Meal[] = [
  meal('2026-11-01T15:00:00Z', ['zapallo']),
  meal('2026-11-02T15:00:00Z', ['zapallo', 'carne']),
  meal('2026-11-03T15:00:00Z', ['batata', 'carne']),
  meal('2026-11-04T15:00:00Z', ['banana']),
];

function historyOf(meals: readonly Meal[], ageMonths = 6): MenuHistory {
  return buildMenuInput(meals, { ageMonths, now: NOW }).history;
}

type RawFood = string | { key?: string | null; name: string };

interface RawMealSpec {
  foods: RawFood[];
  prep?: string;
  name?: string;
  tags?: string[];
}

/** Un día "neutro": carne y zapallo, ya probados, con hierro. */
const FILLER: RawMealSpec = { foods: ['Carne', 'Zapallo'] };

function rawMenu(
  days: Array<RawMealSpec[] | undefined>,
  extra: Partial<Pick<SolidsMenuOutput, 'shoppingList' | 'tips'>> = {},
): SolidsMenuOutput {
  return solidsMenuOutputSchema.parse({
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-11-${String(7 + i).padStart(2, '0')}`,
      label: `Día ${i + 1}`,
      meals: (days[i] ?? [FILLER]).map((m) => ({
        name: m.name ?? 'Almuerzo',
        foods: m.foods.map((f) => (typeof f === 'string' ? { name: f } : f)),
        prep: m.prep ?? 'Pisado con un chorrito de aceite de oliva.',
        tags: m.tags ?? [],
      })),
    })),
    shoppingList: extra.shoppingList ?? [],
    tips: extra.tips ?? ['Ofrecé agua en vasito abierto con cada comida.'],
  });
}

const keysOf = (menu: ReturnType<typeof validateMenu>['menu'], day: number) =>
  menu.days[day]?.meals.flatMap((m) => m.foods.map((f) => f.key)) ?? [];

describe('fechas del menú', () => {
  it('arma 7 días seguidos desde hoy con etiquetas en castellano', () => {
    const days = menuWeekDays(TODAY);
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]);
    expect(days[0]?.label).toBe('Sábado 7');
    expect(days[1]?.label).toBe('Domingo 8');
  });

  it('nombra el rango de la semana, también cuando cambia el mes', () => {
    expect(weekRangeLabel('2026-11-07', '2026-11-13')).toBe('Del 7 al 13 de noviembre');
    expect(weekRangeLabel('2026-11-28', '2026-12-04')).toBe(
      'Del 28 de noviembre al 4 de diciembre',
    );
  });
});

describe('usualMethod', () => {
  it('elige el método más usado en las últimas comidas', () => {
    const meals = [
      meal('2026-11-01T15:00:00Z', [{ key: 'zapallo', format: 'puree' }]),
      meal('2026-11-02T15:00:00Z', [{ key: 'batata', format: 'finger' }]),
      meal('2026-11-03T15:00:00Z', [{ key: 'carne', format: 'finger' }]),
    ];
    expect(usualMethod(meals)).toBe('blw');
    expect(usualMethod([])).toBeNull();
  });
});

describe('buildMenuInput', () => {
  it('separa lo probado por cómo le fue y deja afuera lo que dio reacción', () => {
    const meals = [
      ...BASE_MEALS,
      meal('2026-11-05T15:00:00Z', [
        { key: 'brocoli', acceptance: 'refused' },
        { key: 'palta', acceptance: 'loved' },
      ]),
      meal('2026-10-10T15:00:00Z', [{ key: 'pera', acceptance: 'liked', reaction: 'mild' }]),
    ];
    const { input, history } = buildMenuInput(meals, { ageMonths: 6, now: NOW });

    expect(input.today).toBe(TODAY);
    expect(input.weekDays).toHaveLength(7);
    expect(input.foodsTried.favorites.map((f) => f.key)).toContain('palta');
    expect(input.foodsTried.refused.map((f) => f.key)).toEqual(['brocoli']);
    expect(input.reoffer.map((f) => f.key)).toEqual(['brocoli']);
    expect(input.forbidden.map((f) => f.key)).toEqual(['pera']);
    expect(input.catalog.some((f) => f.key === 'pera')).toBe(false);
    // Lo que va recién al año no aparece en el catálogo de un bebé de 6 meses.
    expect(input.catalog.some((f) => f.key === 'espinaca')).toBe(false);
    expect(history.reactionFoods.has('pera')).toBe(true);
    expect(history.triedKeys.has('zapallo')).toBe(true);
  });

  it('frena los alérgenos si hubo una reacción reciente', () => {
    const meals = [
      ...BASE_MEALS,
      meal('2026-11-05T15:00:00Z', [{ key: 'durazno', reaction: 'mild' }]),
    ];
    const { input, history } = buildMenuInput(meals, { ageMonths: 6, now: NOW });
    expect(history.allergenHold).toMatch(/reacción/);
    expect(input.earliestNewAllergenDate).toBeNull();
  });

  it('si sumó un alérgeno hace poco, no suma otro en la semana (allergenHold)', () => {
    const meals = [...BASE_MEALS, meal('2026-11-06T15:00:00Z', ['huevo', 'zapallo'])];
    const { input, history } = buildMenuInput(meals, { ageMonths: 6, now: NOW });
    expect(history.introducedAllergens.has('huevo')).toBe(true);
    expect(history.lastNewAllergenDate).toBe('2026-11-06');
    expect(history.allergenHold).toMatch(/Hace poco sumó un alérgeno/);
    expect(input.earliestNewAllergenDate).toBeNull();
  });

  it('en los primeros días calcula desde cuándo podría ir un alérgeno nuevo', () => {
    // Con menos de 3 alimentos `suggestNext` no frena: manda el espaciado.
    const meals = [meal('2026-11-06T15:00:00Z', ['huevo', 'zapallo'])];
    const { input, history } = buildMenuInput(meals, { ageMonths: 6, now: NOW });
    expect(history.allergenHold).toBeNull();
    expect(input.earliestNewAllergenDate).toBe('2026-11-09');
  });
});

describe('avoidReason y prepAddsForbidden', () => {
  it('reconoce lo que no va antes del año', () => {
    expect(avoidReason('Miel')).toMatch(/botulismo/);
    expect(avoidReason('Jugo de naranja')).toMatch(/fruta entera/);
    expect(avoidReason('Uvas enteras')).not.toBeNull();
    expect(avoidReason('Té de manzanilla')).not.toBeNull();
    expect(avoidReason('Huevo poco cocido')).not.toBeNull();
    expect(avoidReason('Zapallo')).toBeNull();
    expect(avoidReason('Uvas en cuartos')).toBeNull();
  });

  it('no confunde ningún alimento del catálogo con algo prohibido', () => {
    for (const food of FOODS) {
      for (const name of [food.name, ...(food.aliases ?? [])]) {
        expect(avoidReason(name), name).toBeNull();
      }
    }
  });

  it('detecta sal, azúcar o miel en la preparación, salvo cuando dice "sin"', () => {
    expect(prepAddsForbidden('Pisado, sin sal ni azúcar.')).toBe(false);
    expect(prepAddsForbidden('No le pongas sal.')).toBe(false);
    expect(prepAddsForbidden('Con una pizca de sal.')).toBe(true);
    expect(prepAddsForbidden('Bañado en miel.')).toBe(true);
  });
});

describe('resolveMenuFood', () => {
  it('lleva nombres y claves al catálogo', () => {
    expect(resolveMenuFood({ name: 'Calabaza' })?.key).toBe('zapallo');
    expect(resolveMenuFood({ key: 'chicken', name: 'Pollo' })?.key).toBe('pollo');
    expect(resolveMenuFood({ key: 'lentejas', name: 'Lentejitas rojas' })?.key).toBe('lentejas');
    // Si la clave y el nombre no coinciden, gana el nombre exacto.
    expect(resolveMenuFood({ key: 'manzana', name: 'Pera' })?.key).toBe('pera');
    expect(resolveMenuFood({ name: 'Leche materna' })).toBeNull();
  });
});

describe('validateMenu', () => {
  it('resuelve al catálogo y conserva lo que no está, sin etiquetas', () => {
    const { menu } = validateMenu(
      rawMenu([[{ foods: [{ key: 'pumpkin', name: 'Calabaza' }, 'Carne', 'Leche materna'] }]]),
      historyOf(BASE_MEALS),
    );
    const foods = menu.days[0]?.meals[0]?.foods ?? [];
    expect(foods.map((f) => f.key)).toEqual(['zapallo', 'carne', null]);
    expect(foods[0]).toMatchObject({ name: 'Zapallo', emoji: '🎃' });
    expect(foods[2]).toMatchObject({ name: 'Leche materna', tags: [] });
    expect(menu.days[0]?.label).toBe('Sábado 7');
    expect(menu.rangeLabel).toBe('Del 7 al 13 de noviembre');
  });

  it('saca reacciones, lo que es para más grandes y lo de AVOID_UNDER_12', () => {
    const history = historyOf([
      ...BASE_MEALS,
      meal('2026-10-20T15:00:00Z', [{ key: 'pera', reaction: 'mild' }]),
    ]);
    const { menu, warnings } = validateMenu(
      rawMenu([
        [{ foods: ['Carne', 'Pera'] }],
        [{ foods: ['Carne', 'Espinaca'] }],
        [{ foods: ['Carne', 'Miel', 'Jugo de naranja'] }],
      ]),
      history,
    );
    expect(keysOf(menu, 0)).toEqual(['carne']);
    expect(keysOf(menu, 1)).toEqual(['carne']);
    expect(keysOf(menu, 2)).toEqual(['carne']);
    const messages = warnings.filter((w) => w.code === 'food_removed').map((w) => w.message);
    expect(messages).toHaveLength(4);
    expect(messages.join(' ')).toMatch(/pera \(sábado 7\): anotaron una reacción/);
    expect(messages.join(' ')).toMatch(/espinaca .*12 meses/);
  });

  it('saca también lo que comparte un alérgeno que dio reacción', () => {
    const history = historyOf([
      ...BASE_MEALS,
      meal('2026-10-01T15:00:00Z', [{ key: 'yogur', reaction: 'strong' }]),
    ]);
    const { menu } = validateMenu(rawMenu([[{ foods: ['Carne', 'Ricota'] }]]), history);
    expect(keysOf(menu, 0)).toEqual(['carne']);
  });

  it('deja un solo alérgeno nuevo en la semana y lo repite', () => {
    const { menu, warnings } = validateMenu(
      rawMenu(
        [
          [{ foods: ['Huevo', 'Zapallo'] }],
          undefined,
          [{ foods: ['Huevo', 'Batata'] }],
          undefined,
          [{ foods: ['Merluza', 'Zapallo'] }],
        ],
        {
          shoppingList: [
            {
              group: 'huevo_lacteos',
              items: [{ item: 'Huevos', quantity: '6' }],
            },
            { group: 'carnes', items: [{ item: 'Merluza', quantity: '1 filet' }] },
          ],
        },
      ),
      historyOf(BASE_MEALS),
    );

    const intro = menu.days[0]?.meals[0];
    expect(intro?.newAllergen).toEqual({ key: 'huevo', label: 'Huevo' });
    expect(intro?.tags).toEqual(['nuevo', 'alergeno', 'hierro']);
    const repeat = menu.days[2]?.meals[0];
    expect(repeat?.newAllergen).toBeNull();
    expect(repeat?.foods[0]?.tags).toEqual(['alergeno', 'hierro']);
    expect(keysOf(menu, 4)).toEqual(['zapallo']);
    expect(warnings.some((w) => w.code === 'allergen_removed' && /merluza/.test(w.message))).toBe(
      true,
    );

    const shoppingIds = menu.shoppingList.flatMap((g) => g.items.map((i) => i.id));
    expect(shoppingIds).toContain('huevo');
    expect(shoppingIds).not.toContain('merluza');
  });

  it('no suma alérgenos si están en pausa por una reacción reciente', () => {
    const history = historyOf([
      ...BASE_MEALS,
      meal('2026-11-05T15:00:00Z', [{ key: 'durazno', reaction: 'mild' }]),
    ]);
    const { menu, warnings } = validateMenu(rawMenu([[{ foods: ['Huevo', 'Carne'] }]]), history);
    expect(keysOf(menu, 0)).toEqual(['carne']);
    expect(warnings[0]?.code).toBe('allergen_removed');
  });

  it('espera 3 días desde el último alérgeno nuevo', () => {
    const history = historyOf([meal('2026-11-06T15:00:00Z', ['huevo', 'zapallo'])]);
    const { menu, warnings } = validateMenu(
      rawMenu([
        [{ foods: ['Batata', 'Zapallo'] }],
        [{ foods: ['Yogur', 'Zapallo'] }],
        [{ foods: ['Yogur', 'Zapallo'] }],
      ]),
      history,
    );
    expect(keysOf(menu, 1)).toEqual(['zapallo']);
    expect(warnings.find((w) => w.code === 'allergen_removed')?.message).toMatch(
      /yogur natural \(domingo 8\): .*al menos 3 días/,
    );
    expect(keysOf(menu, 2)).toEqual(['yogur', 'zapallo']);
    expect(menu.days[2]?.meals[0]?.newAllergen?.key).toBe('leche');
  });

  it('con un alérgeno en pausa no suma ninguno en toda la semana', () => {
    const history = historyOf([...BASE_MEALS, meal('2026-11-06T15:00:00Z', ['huevo'])]);
    const { menu } = validateMenu(
      rawMenu([undefined, undefined, undefined, undefined, [{ foods: ['Yogur', 'Banana'] }]]),
      history,
    );
    expect(keysOf(menu, 4)).toEqual(['banana']);
  });

  it('antes del primer alérgeno espera a que conozca algunos alimentos', () => {
    const history = historyOf([meal('2026-11-06T15:00:00Z', ['zapallo'])]);
    const { menu } = validateMenu(
      rawMenu([
        [{ foods: ['Zapallo', 'Huevo'] }],
        [{ foods: ['Zapallo', 'Batata'] }],
        [{ foods: ['Batata', 'Carne'] }],
        [{ foods: ['Huevo', 'Zapallo'] }],
      ]),
      history,
    );
    expect(keysOf(menu, 0)).toEqual(['zapallo']);
    expect(keysOf(menu, 3)).toEqual(['huevo', 'zapallo']);
  });

  it('recalcula las etiquetas en vez de creerle a la IA', () => {
    const { menu } = validateMenu(
      rawMenu([
        [{ foods: ['Carne', 'Zapallo'], tags: ['nuevo', 'alergeno'] }],
        [{ foods: ['Lentejas', 'Zapallo'], tags: [] }],
        [{ foods: ['Lentejas', 'Banana'], tags: ['nuevo'] }],
      ]),
      historyOf(BASE_MEALS),
    );
    expect(menu.days[0]?.meals[0]?.tags).toEqual(['hierro']);
    expect(menu.days[1]?.meals[0]?.tags).toEqual(['nuevo', 'hierro']);
    // La segunda vez en la semana ya no es nuevo.
    expect(menu.days[2]?.meals[0]?.tags).toEqual(['hierro']);
  });

  it('nunca deja dos alimentos nuevos en la misma comida', () => {
    const { menu, warnings } = validateMenu(
      rawMenu([[{ foods: ['Palta', 'Pollo', 'Zapallo'] }]]),
      historyOf(BASE_MEALS),
    );
    expect(keysOf(menu, 0)).toEqual(['palta', 'zapallo']);
    expect(warnings.map((w) => w.code)).toContain('extra_new_food');
  });

  it('marca los días sin hierro y sugiere qué sumar', () => {
    const { menu, warnings } = validateMenu(
      rawMenu([[{ foods: ['Banana'] }], [{ foods: ['Zapallo', 'Batata'] }]]),
      historyOf(BASE_MEALS),
    );
    expect(menu.days[0]?.hasIron).toBe(false);
    expect(menu.days[1]?.hasIron).toBe(false);
    expect(menu.days[2]?.hasIron).toBe(true);
    const iron = warnings.find((w) => w.code === 'missing_iron');
    expect(iron?.message).toMatch(/^Sábado 7 y domingo 8 no tienen nada con hierro/);
    expect(iron?.message).toMatch(/Sumale carne/);
  });

  it('cambia la preparación si agrega sal, azúcar o miel, o si nombra algo que sacamos', () => {
    const { menu, warnings } = validateMenu(
      rawMenu([
        [{ foods: ['Zapallo', 'Carne'], prep: 'Pisado con una pizca de sal.' }],
        [{ foods: ['Carne', 'Espinaca'], prep: 'Carne picada con espinaca salteada.' }],
      ]),
      historyOf(BASE_MEALS),
    );
    const prep0 = menu.days[0]?.meals[0]?.prep ?? '';
    expect(prep0).not.toMatch(/sal\b/);
    expect(prep0).toMatch(/^Zapallo: /);
    expect(warnings.map((w) => w.code)).toContain('prep_replaced');
    expect(menu.days[1]?.meals[0]?.prep).toMatch(/^Carne vacuna: /);
  });

  it('saca la comida que se quedó sin alimentos', () => {
    const { menu } = validateMenu(
      rawMenu([[{ foods: ['Carne', 'Zapallo'] }, { name: 'Cena', foods: ['Miel'] }]]),
      historyOf(BASE_MEALS),
    );
    expect(menu.days[0]?.meals).toHaveLength(1);
    expect(menu.days[0]?.meals[0]?.name).toBe('Almuerzo');
  });

  it('reagrupa la lista de compras por grupo del catálogo y suma lo que falta', () => {
    const { menu } = validateMenu(
      rawMenu(
        [
          [{ foods: ['Carne', 'Zapallo'] }],
          [{ foods: ['Lentejas', 'Banana'] }],
          [{ foods: ['Carne', 'Espinaca'] }],
        ],
        {
          shoppingList: [
            {
              group: 'varios',
              items: [
                { item: 'Zapallo anco', quantity: '1 chico' },
                { item: 'Carne picada magra', quantity: '250 g' },
                { item: 'Espinaca', quantity: '1 atado' },
                { item: 'Miel', quantity: '1 frasco' },
                { item: 'Aceite de oliva', quantity: '1 botella chica' },
                { item: 'Pañuelitos', quantity: '1 paquete' },
              ],
            },
          ],
          tips: ['Uno', 'Dos', 'Tres', 'Cuatro'],
        },
      ),
      historyOf(BASE_MEALS),
    );
    expect(menu.shoppingList.map((g) => g.group)).toEqual([
      'verduras',
      'frutas',
      'carnes',
      'legumbres',
      'grasas',
      'otros',
    ]);
    const items = Object.fromEntries(
      menu.shoppingList.flatMap((g) => g.items.map((i) => [i.id, i])),
    );
    expect(items.zapallo).toMatchObject({ name: 'Zapallo anco', quantity: '1 chico' });
    expect(items.carne?.quantity).toBe('250 g');
    // Lo que el menú usa y la IA no anotó, se suma sin cantidad.
    expect(items.lentejas).toMatchObject({ name: 'Lentejas', quantity: '' });
    expect(items.banana).toBeDefined();
    expect(items.espinaca).toBeUndefined();
    expect(Object.values(items).some((i) => /miel/i.test(i.name))).toBe(false);
    expect(menu.tips).toHaveLength(3);
  });
});
