import { describe, expect, it } from 'vitest';

import { solidsContextForAI } from './ai-context';
import type { Meal } from './types';

const NOW = new Date('2026-11-07T18:00:00Z');

function meal(id: string, at: string, tastings: Partial<Meal['tastings'][number]>[]): Meal {
  return {
    id,
    occurredAt: at,
    notes: null,
    reaction: 'none',
    tastings: tastings.map((t, i) => ({
      id: `${id}-${i}`,
      mealId: id,
      occurredAt: at,
      foodKey: t.foodKey ?? 'zapallo',
      foodName: t.foodName ?? 'Zapallo',
      format: t.format ?? null,
      acceptance: t.acceptance ?? null,
      amount: null,
      gagged: t.gagged ?? false,
      reaction: t.reaction ?? 'none',
      reactionSigns: t.reactionSigns ?? [],
    })),
  };
}

describe('solidsContextForAI', () => {
  it('antes de la edad y sin comidas no agrega nada', () => {
    expect(solidsContextForAI([], { now: NOW, ageMonths: 3 })).toBeNull();
  });

  it('a los 6 meses sin comidas avisa que todavía no hay nada anotado', () => {
    expect(solidsContextForAI([], { now: NOW, ageMonths: 6 })).toMatch(/Todavía no hay comidas/);
  });

  it('resume el día, lo probado, el hierro, las reacciones y los alérgenos', () => {
    const text =
      solidsContextForAI(
        [
          meal('a', '2026-11-06T13:00:00Z', [
            { foodKey: 'banana', foodName: 'Banana', acceptance: 'refused', format: 'finger' },
          ]),
          meal('b', '2026-11-07T13:00:00Z', [
            { foodKey: 'zapallo', foodName: 'Zapallo', acceptance: 'loved', format: 'puree' },
            {
              foodKey: 'carne',
              foodName: 'Carne vacuna',
              acceptance: 'liked',
              format: 'finger',
              gagged: true,
            },
            {
              foodKey: 'frutilla',
              foodName: 'Frutilla',
              reaction: 'mild',
              reactionSigns: ['boca_roja'],
            },
          ]),
        ],
        { now: NOW, ageMonths: 6 },
      ) ?? '';
    expect(text).toMatch(/día 2/);
    expect(text).toMatch(/Método que vienen usando: Mixto/);
    expect(text).toMatch(/Zapallo \(le encantó, papilla\)/);
    expect(text).toMatch(/Carne vacuna \(le gustó, con la mano, arcadas\)/);
    expect(text).toMatch(/Hierro hoy: sí \(carne vacuna\)/);
    expect(text).toMatch(/volver a ofrecer.*Banana \(1 intento\)/);
    expect(text).toMatch(/Reacciones anotadas: Frutilla \(leve: boca o cachetes colorados\)/);
    expect(text).toMatch(/Alérgenos: huevo: sin probar;.*leche de vaca: sin probar/);
  });
});
