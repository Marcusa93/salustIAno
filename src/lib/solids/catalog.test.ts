import { describe, expect, it } from 'vitest';
import {
  ALLERGEN_FIRST_FOOD,
  ALLERGEN_LABELS,
  AVOID_UNDER_12,
  FOODS,
  FOOD_BY_KEY,
  FOOD_GROUP_LABELS,
  matchFood,
  normalizeFoodName,
} from './catalog';
import type { AllergenKey, FoodColor, FoodGroup } from './types';

const GROUPS = Object.keys(FOOD_GROUP_LABELS) as FoodGroup[];
const ALLERGENS = Object.keys(ALLERGEN_LABELS) as AllergenKey[];
const COLORS: readonly FoodColor[] = [
  'rojo',
  'naranja',
  'amarillo',
  'verde',
  'violeta',
  'blanco',
  'marron',
];
const ALLOWED_MONTHS = new Set([6, 8, 9, 12]);

function termsOf(food: (typeof FOODS)[number]): string[] {
  return [food.name, ...(food.aliases ?? [])];
}

describe('catálogo: integridad', () => {
  it('tiene alrededor de 80-90 alimentos', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(80);
    expect(FOODS.length).toBeLessThanOrEqual(95);
  });

  it('las keys son únicas y en snake_case', () => {
    const keys = FOODS.map((food) => food.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9_]+$/);
  });

  it('FOOD_BY_KEY indexa todo el catálogo', () => {
    expect(FOOD_BY_KEY.size).toBe(FOODS.length);
    for (const food of FOODS) expect(FOOD_BY_KEY.get(food.key)).toBe(food);
  });

  it('ningún nombre o alias normalizado se repite (ni entre alimentos ni dentro de uno)', () => {
    const owner = new Map<string, string>();
    for (const food of FOODS) {
      for (const term of termsOf(food)) {
        const normalized = normalizeFoodName(term);
        expect(normalized, `${food.key}: alias vacío`).not.toBe('');
        expect(owner.get(normalized), `"${term}" repetido en ${food.key}`).toBeUndefined();
        owner.set(normalized, food.key);
      }
    }
  });

  it('grupos, alérgenos, colores y hierro son válidos', () => {
    for (const food of FOODS) {
      expect(GROUPS).toContain(food.group);
      expect(COLORS).toContain(food.color);
      if (food.iron !== undefined) expect(['high', 'medium']).toContain(food.iron);
      const allergens = food.allergens ?? [];
      expect(new Set(allergens).size, `${food.key}: alérgeno repetido`).toBe(allergens.length);
      for (const allergen of allergens) expect(ALLERGENS).toContain(allergen);
    }
  });

  it('fromMonths es 6, 8, 9 o 12', () => {
    for (const food of FOODS) {
      expect(ALLOWED_MONTHS.has(food.fromMonths), `${food.key}: ${food.fromMonths}`).toBe(true);
    }
  });

  it('textos no vacíos y dentro del largo máximo', () => {
    for (const food of FOODS) {
      expect(food.name.trim(), food.key).not.toBe('');
      expect(food.emoji.trim(), food.key).not.toBe('');
      expect(food.puree.trim(), food.key).not.toBe('');
      expect(food.blw.trim(), food.key).not.toBe('');
      expect(food.puree.length, `${food.key}.puree`).toBeLessThanOrEqual(220);
      expect(food.blw.length, `${food.key}.blw`).toBeLessThanOrEqual(260);
      if (food.caution !== undefined) {
        expect(food.caution.trim(), food.key).not.toBe('');
        expect(food.caution.length, `${food.key}.caution`).toBeLessThanOrEqual(200);
      }
    }
  });

  it('hay al menos un alimento por grupo y por alérgeno', () => {
    for (const group of GROUPS) {
      expect(
        FOODS.some((food) => food.group === group),
        group,
      ).toBe(true);
    }
    for (const allergen of ALLERGENS) {
      expect(
        FOODS.some((food) => food.allergens?.includes(allergen)),
        allergen,
      ).toBe(true);
    }
  });

  it('acelga, espinaca y remolacha van desde el año, con aviso de la pediatra', () => {
    for (const key of ['acelga', 'espinaca', 'remolacha']) {
      const food = FOOD_BY_KEY.get(key);
      expect(food?.fromMonths, key).toBe(12);
      expect(food?.caution, key).toMatch(/pediatra/);
    }
  });
});

describe('ALLERGEN_FIRST_FOOD', () => {
  it('cubre todos los alérgenos', () => {
    expect(Object.keys(ALLERGEN_FIRST_FOOD).sort()).toEqual([...ALLERGENS].sort());
  });

  it.each(ALLERGENS)('%s apunta a un alimento del catálogo que lo contiene', (allergen) => {
    const food = FOOD_BY_KEY.get(ALLERGEN_FIRST_FOOD[allergen]);
    expect(food).toBeDefined();
    expect(food?.allergens ?? []).toContain(allergen);
  });
});

describe('AVOID_UNDER_12', () => {
  it('tiene textos cortos y no vacíos', () => {
    expect(AVOID_UNDER_12.length).toBeGreaterThan(0);
    for (const item of AVOID_UNDER_12) {
      expect(item.name.trim()).not.toBe('');
      expect(item.why.trim()).not.toBe('');
      expect(item.why.length, item.name).toBeLessThanOrEqual(140);
    }
  });

  it('incluye la miel y no la ofrece como alimento del catálogo', () => {
    expect(AVOID_UNDER_12.some((item) => item.name === 'Miel')).toBe(true);
    expect(matchFood('miel')).toBeNull();
    expect(matchFood('sal')).toBeNull();
    expect(matchFood('azúcar')).toBeNull();
  });
});

describe('normalizeFoodName', () => {
  it('pasa a minúsculas, saca tildes y colapsa espacios', () => {
    expect(normalizeFoodName('  Zapallo   ANCO ')).toBe('zapallo anco');
    expect(normalizeFoodName('Brócoli')).toBe('brocoli');
    expect(normalizeFoodName('Piña\tdulce')).toBe('pina dulce');
    expect(normalizeFoodName('Pingüino')).toBe('pinguino');
  });
});

describe('matchFood', () => {
  const keyOf = (input: string) => matchFood(input)?.key ?? null;

  it('encuentra por nombre exacto, sin importar mayúsculas ni tildes', () => {
    expect(keyOf('Zapallo')).toBe('zapallo');
    expect(keyOf('ZAPALLO')).toBe('zapallo');
    expect(keyOf('brocoli')).toBe('brocoli');
    expect(keyOf('Brócoli')).toBe('brocoli');
    expect(keyOf('melon')).toBe('melon');
    expect(keyOf('  palta ')).toBe('palta');
  });

  it('encuentra por alias', () => {
    expect(keyOf('calabaza')).toBe('zapallo');
    expect(keyOf('anco')).toBe('zapallo');
    expect(keyOf('zucchini')).toBe('zapallito');
    expect(keyOf('aguacate')).toBe('palta');
    expect(keyOf('camote')).toBe('batata');
    expect(keyOf('frijoles')).toBe('porotos');
    expect(keyOf('carne picada')).toBe('carne');
    expect(keyOf('harina de maíz')).toBe('polenta');
    expect(keyOf('pescado blanco')).toBe('merluza');
  });

  it('tolera plurales y singulares', () => {
    expect(keyOf('Zapallos')).toBe('zapallo');
    expect(keyOf('bananas')).toBe('banana');
    expect(keyOf('melones')).toBe('melon');
    expect(keyOf('tomates')).toBe('tomate');
    expect(keyOf('arándano')).toBe('arandanos');
    expect(keyOf('nuez')).toBe('nueces');
    expect(keyOf('lenteja')).toBe('lentejas');
    expect(keyOf('arveja partida')).toBe('arvejas_partidas');
  });

  it('encuentra el alimento dentro de una frase', () => {
    expect(keyOf('papilla de zapallo')).toBe('zapallo');
    expect(keyOf('puré de papas')).toBe('papa');
    expect(keyOf('bastones de batata al horno')).toBe('batata');
    expect(keyOf('porotos negros')).toBe('porotos');
  });

  it('prefiere el nombre más largo que coincide', () => {
    expect(keyOf('pasta de maní')).toBe('pasta_mani');
    expect(keyOf('maní')).toBe('mani_molido');
    expect(keyOf('tostada con pasta de mani')).toBe('pasta_mani');
    expect(keyOf('arvejas partidas')).toBe('arvejas_partidas');
    expect(keyOf('arvejas')).toBe('arvejas');
    expect(keyOf('zapallito')).toBe('zapallito');
    expect(keyOf('carne de cerdo')).toBe('cerdo');
    expect(keyOf('sémola de maíz')).toBe('polenta');
  });

  it('solo matchea palabras completas', () => {
    expect(keyOf('pochoclo')).toBeNull();
    expect(keyOf('té de manzanilla')).toBeNull();
  });

  it('devuelve null si no reconoce nada', () => {
    expect(keyOf('')).toBeNull();
    expect(keyOf('   ')).toBeNull();
    expect(keyOf('?!')).toBeNull();
    expect(keyOf('asdfgh')).toBeNull();
  });
});
