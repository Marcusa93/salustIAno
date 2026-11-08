import { describe, expect, it } from 'vitest';

import {
  type DiaperRow,
  type MilkRow,
  diaperSignal,
  milkBalance,
  textureProgress,
} from './insights';
import type { FoodFormat, Meal } from './types';

let seq = 0;

function meal(at: string, formats: Array<FoodFormat | null>, foodKey = 'zapallo'): Meal {
  seq += 1;
  const id = `m${seq}`;
  return {
    id,
    occurredAt: at,
    notes: null,
    reaction: 'none',
    tastings: formats.map((format, i) => ({
      id: `${id}-${i}`,
      mealId: id,
      occurredAt: at,
      foodKey: `${foodKey}${i || ''}`,
      foodName: `${foodKey}${i || ''}`,
      format,
      acceptance: null,
      amount: null,
      gagged: false,
      reaction: 'none',
      reactionSigns: [],
    })),
  };
}

/** Mediodía en Argentina (15:00 UTC) de un día de noviembre 2026. */
const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}T15:00:00.000Z`;

describe('textureProgress', () => {
  it('sin formatos no dice nada', () => {
    const r = textureProgress([meal(day(7), [null])], { ageMonths: 6, now: new Date(day(7)) });
    expect(r.stage).toBeNull();
    expect(r.insight).toBeNull();
  });

  it('recién empezado con papilla: sin empujones', () => {
    const r = textureProgress([meal(day(7), ['puree'])], { ageMonths: 6, now: new Date(day(8)) });
    expect(r.stage).toBe(1);
    expect(r.insight).toBeNull();
    expect(r.weeks).toHaveLength(1);
  });

  it('a los 8 meses solo con papilla, avisa', () => {
    const meals = [meal(day(1), ['puree']), meal(day(5), ['puree', 'puree'])];
    const r = textureProgress(meals, { ageMonths: 8, now: new Date(day(6)) });
    expect(r.stage).toBe(1);
    expect(r.insight?.tone).toBe('warn');
  });

  it('dos semanas de papilla sugiere pisar', () => {
    const meals = [meal(day(1), ['puree']), meal(day(15), ['puree'])];
    const r = textureProgress(meals, { ageMonths: 6, now: new Date(day(16)) });
    expect(r.insight?.tone).toBe('info');
    expect(r.weeks.map((w) => w.index)).toEqual([0, 1, 2]);
    expect(r.weeks[1]?.total).toBe(0);
  });

  it('con trozos seguido, ya está en la etapa 3', () => {
    const meals = [meal(day(10), ['finger', 'finger', 'puree'])];
    const r = textureProgress(meals, { ageMonths: 7, now: new Date(day(11)) });
    expect(r.stage).toBe(3);
    expect(r.insight?.tone).toBe('ok');
  });
});

describe('diaperSignal', () => {
  const now = new Date(day(20));
  const meals = [meal(day(10), ['puree'])];
  const diapers = (entries: Array<[number, DiaperRow['type']]>): DiaperRow[] =>
    entries.map(([d, type]) => ({ occurred_at: day(d), type }));

  it('sin comidas no aplica', () => {
    expect(diaperSignal([], [], now)).toBeNull();
  });

  it('3 días sin caca con pañales anotados avisa', () => {
    const r = diaperSignal(
      diapers([
        [16, 'dirty'],
        [19, 'wet'],
        [20, 'wet'],
      ]),
      meals,
      now,
    );
    expect(r?.daysWithoutPoop).toBe(4);
    expect(r?.insight?.tone).toBe('warn');
  });

  it('si no se anotan pañales, no inventa un "sin caca"', () => {
    const r = diaperSignal(diapers([[12, 'dirty']]), meals, now);
    expect(r?.insight).toBeNull();
  });

  it('compara cacas por día antes y después de empezar', () => {
    const before: Array<[number, DiaperRow['type']]> = [3, 4, 5, 6, 7, 8, 9].flatMap(
      (d) =>
        [
          [d, 'dirty'],
          [d, 'both'],
        ] as Array<[number, DiaperRow['type']]>,
    );
    const after: Array<[number, DiaperRow['type']]> = [
      [13, 'dirty'],
      [14, 'wet'],
      [15, 'wet'],
      [16, 'wet'],
      [17, 'dirty'],
      [18, 'wet'],
      [19, 'dirty'],
      [20, 'wet'],
    ];
    const r = diaperSignal(diapers([...before, ...after]), meals, now);
    expect(r?.beforePerDay).toBe(2);
    expect(r?.recentPerDay).toBe(0.4);
    expect(r?.insight?.title).toBe('Hace menos caca que antes');
  });

  it('lista los alimentos nuevos de las últimas 72 horas', () => {
    const r = diaperSignal([], [meal(day(10), ['puree']), meal(day(19), ['puree'], 'pera')], now);
    expect(r?.newFoods).toEqual(['pera']);
  });
});

describe('milkBalance', () => {
  const meals = [meal(day(10), ['puree'])];
  const bottles = (days: number[], ml: number): MilkRow[] =>
    days.flatMap((d) =>
      [0, 1, 2, 3].map(() => ({ occurred_at: day(d), type: 'bottle' as const, amount_ml: ml })),
    );

  it('sin días suficientes después de empezar, no compara', () => {
    const r = milkBalance(bottles([3, 4, 5, 6, 7, 8, 9, 10], 150), meals, new Date(day(11)));
    expect(r?.change).toBeNull();
    expect(r?.insight).toBeNull();
  });

  it('avisa cuando la mamadera baja más de un 25%', () => {
    const milk = [
      ...bottles([3, 4, 5, 6, 7, 8, 9], 150),
      ...bottles([14, 15, 16, 17, 18, 19], 100),
    ];
    const r = milkBalance(milk, meals, new Date(day(20)));
    expect(r?.before?.bottleMl).toBe(600);
    expect(r?.recent?.bottleMl).toBe(400);
    expect(r?.insight?.tone).toBe('warn');
    expect(r?.insight?.text).toContain('33%');
  });

  it('si se mantiene, lo dice', () => {
    const milk = [
      ...bottles([3, 4, 5, 6, 7, 8, 9], 150),
      ...bottles([14, 15, 16, 17, 18, 19], 140),
    ];
    const r = milkBalance(milk, meals, new Date(day(20)));
    expect(r?.insight?.tone).toBe('ok');
  });

  it('ignora las comidas sólidas al contar leche', () => {
    const milk: MilkRow[] = [
      ...bottles([3, 4, 5, 6, 7, 8, 9], 150),
      ...bottles([17, 18, 19], 150),
      { occurred_at: day(18), type: 'solid', amount_ml: null },
    ];
    const r = milkBalance(milk, meals, new Date(day(20)));
    expect(r?.recent?.bottles).toBe(4);
  });
});
