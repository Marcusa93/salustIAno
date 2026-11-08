import { describe, expect, it } from 'vitest';

import { buildSolidsReport, joinEs, solidsReportForPrep } from './report';
import type { Meal, Tasting } from './types';

// 7 de noviembre, 15:00 en Argentina.
const NOW = new Date('2026-11-07T18:00:00Z');
// Con esta fecha de nacimiento, hoy tiene 8 meses.
const BIRTH = '2026-03-01';

type TastingInput = Partial<Omit<Tasting, 'id' | 'mealId' | 'occurredAt'>>;

function meal(
  id: string,
  at: string,
  tastings: TastingInput[],
  extra: Partial<Pick<Meal, 'notes' | 'reaction'>> = {},
): Meal {
  return {
    id,
    occurredAt: at,
    notes: extra.notes ?? null,
    reaction: extra.reaction ?? 'none',
    tastings: tastings.map((t, i) => ({
      id: `${id}-${i}`,
      mealId: id,
      occurredAt: at,
      foodKey: t.foodKey ?? 'zapallo',
      foodName: t.foodName ?? 'Zapallo',
      format: t.format ?? null,
      acceptance: t.acceptance ?? null,
      amount: t.amount ?? null,
      gagged: t.gagged ?? false,
      reaction: t.reaction ?? 'none',
      reactionSigns: t.reactionSigns ?? [],
    })),
  };
}

/** Una comida por día, `days` días antes de NOW, al mediodía de Argentina. */
function daysAgo(days: number): string {
  return new Date(Date.parse('2026-11-07T15:00:00Z') - days * 86_400_000).toISOString();
}

describe('buildSolidsReport sin comidas', () => {
  it('arma un informe vacío sin romperse', () => {
    const r = buildSolidsReport({ meals: [], ageMonths: 4, birthDate: null, now: NOW });
    expect(r.hasMeals).toBe(false);
    expect(r.start).toBeNull();
    expect(r.totals).toEqual({ meals: 0, foods: 0, tastings: 0 });
    expect(r.groups).toHaveLength(7);
    expect(r.groups.every((g) => g.count === 0)).toBe(true);
    expect(r.allergens).toHaveLength(9);
    expect(r.allergens.every((a) => a.state === 'pending' && a.reaction === 'none')).toBe(true);
    expect(r.reactions).toEqual([]);
    expect(r.textures.byMonth).toEqual([]);
    expect(r.textures.noLumpsRecently).toBe(false);
    expect(r.gagging.episodes).toEqual([]);
    expect(r.iron).toEqual({
      windowDays: 0,
      daysWithIron: 0,
      daysWithMeals: 0,
      foods: [],
      days: [],
    });
    expect(r.questions).toEqual([]);
  });

  it('a los 6 meses sin comidas pregunta cuándo arrancar', () => {
    const r = buildSolidsReport({ meals: [], ageMonths: 6, birthDate: null, now: NOW });
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]?.topic).toBe('start');
    expect(r.questions[0]?.text).toMatch(/Todavía no empezó con sólidos y tiene 6 meses/);
  });
});

describe('buildSolidsReport resumen', () => {
  const meals = [
    meal('a', '2026-09-05T15:00:00Z', [
      { foodKey: 'zapallo', foodName: 'Zapallo' },
      { foodKey: 'banana', foodName: 'Banana' },
    ]),
    meal('b', '2026-09-06T15:00:00Z', [
      { foodKey: 'zapallo', foodName: 'Zapallo' },
      { foodKey: 'carne', foodName: 'Carne' },
      { foodKey: 'otro:guiso_de_la_abuela', foodName: 'Guiso de la abuela' },
    ]),
  ];

  it('cuenta inicio, comidas, alimentos y grupos', () => {
    const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });
    expect(r.start).toEqual({ at: '2026-09-05T15:00:00Z', daysSince: 63, ageMonths: 6 });
    expect(r.totals).toEqual({ meals: 2, foods: 4, tastings: 5 });
    const byGroup = Object.fromEntries(r.groups.map((g) => [g.group, g.count]));
    expect(byGroup).toMatchObject({ verduras: 1, frutas: 1, carnes: 1, legumbres: 0 });
    expect(r.groups.find((g) => g.group === 'verduras')?.foods).toEqual(['Zapallo']);
    expect(r.otherFoods).toEqual(['Guiso de la abuela']);
  });

  it('sin fecha de nacimiento no inventa la edad de inicio', () => {
    const r = buildSolidsReport({ meals, ageMonths: 6, birthDate: null, now: NOW });
    expect(r.start?.ageMonths).toBeNull();
  });

  it('ordena las comidas aunque lleguen desordenadas', () => {
    const r = buildSolidsReport({
      meals: [...meals].reverse(),
      ageMonths: 8,
      birthDate: BIRTH,
      now: NOW,
    });
    expect(r.start?.at).toBe('2026-09-05T15:00:00Z');
  });
});

describe('buildSolidsReport alérgenos y reacciones', () => {
  const meals = [
    meal('a', '2026-10-20T13:00:00Z', [{ foodKey: 'huevo', foodName: 'Huevo' }]),
    meal('b', '2026-10-25T13:00:00Z', [
      { foodKey: 'huevo', foodName: 'Huevo', reaction: 'strong', reactionSigns: ['ronchas'] },
      { foodKey: 'zapallo', foodName: 'Zapallo' },
    ]),
    meal('c', '2026-11-03T13:00:00Z', [
      {
        foodKey: 'frutilla',
        foodName: 'Frutilla',
        reaction: 'mild',
        reactionSigns: ['boca_roja', 'hinchazon'],
      },
    ]),
    meal(
      'd',
      '2026-11-05T13:00:00Z',
      [{ foodKey: 'yogur', foodName: 'Yogur' }, { foodKey: 'pera' }],
      { notes: '  le salió un granito  ', reaction: 'mild' },
    ),
  ];
  const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });

  it('sigue cada alérgeno con fechas, veces y reacción', () => {
    const huevo = r.allergens.find((a) => a.allergen === 'huevo');
    expect(huevo).toMatchObject({
      state: 'reaction',
      firstAt: '2026-10-20T13:00:00Z',
      lastAt: '2026-10-25T13:00:00Z',
      exposures: 2,
      reaction: 'strong',
    });
    const leche = r.allergens.find((a) => a.allergen === 'leche');
    expect(leche).toMatchObject({ state: 'introducing', exposures: 1, reaction: 'none' });
    expect(r.allergens.find((a) => a.allergen === 'mani')?.state).toBe('pending');
  });

  it('lista las reacciones, de la más nueva a la más vieja, con signos y alarmas', () => {
    expect(r.reactions.map((x) => x.mealId)).toEqual(['d', 'c', 'b']);
    const [d, c, b] = r.reactions;
    expect(b).toMatchObject({
      severity: 'strong',
      foods: ['Huevo', 'Zapallo'],
      suspects: ['Huevo'],
      emergency: false,
    });
    expect(b?.signs).toEqual([{ sign: 'ronchas', label: 'Ronchas', emergency: false }]);
    expect(c?.emergency).toBe(true);
    expect(c?.signs.find((s) => s.sign === 'hinchazon')?.emergency).toBe(true);
    // Reacción marcada solo en la comida: se sospecha de todo lo que comió.
    expect(d?.suspects).toEqual(['Yogur natural', 'Pera']);
    expect(d?.notes).toBe('le salió un granito');
  });

  it('hace una pregunta por reacción, primero las urgentes', () => {
    const qs = r.questions.filter((q) => q.topic === 'reaction');
    expect(qs).toHaveLength(3);
    expect(qs.map((q) => q.urgent)).toEqual([true, true, false]);
    // Urgentes: la que tuvo hinchazón (más nueva) y la fuerte.
    expect(qs[0]?.text).toMatch(
      /^El 3 de noviembre tuvo una reacción leve después de comer frutilla/,
    );
    expect(qs[0]?.text).toMatch(/hinchazón de labios o cara/);
    expect(qs[1]?.text).toMatch(
      /^El 25 de octubre tuvo una reacción fuerte después de comer huevo \(ronchas\)/,
    );
    expect(qs[1]?.text).toMatch(/¿Puede ser alergia\?/);
    expect(qs[2]?.text).toMatch(/comer yogur natural y pera\./);
  });

  it('pregunta por los alérgenos pendientes desde los 8 meses (sin mariscos antes del año)', () => {
    const q = r.questions.find((x) => x.topic === 'allergens');
    expect(q?.text).toMatch(
      /^Todavía no probó maní, trigo \(gluten\), pescado, sésamo, frutos secos y soja, y ya tiene 8 meses/,
    );
    expect(q?.text).not.toMatch(/mariscos/);
    const younger = buildSolidsReport({ meals, ageMonths: 7, birthDate: BIRTH, now: NOW });
    expect(younger.questions.some((x) => x.topic === 'allergens')).toBe(false);
  });
});

describe('buildSolidsReport aceptación', () => {
  const brocoli = Array.from({ length: 6 }, (_, i) =>
    meal(`br${i}`, daysAgo(20 - i), [
      { foodKey: 'brocoli', foodName: 'Brócoli', acceptance: i === 2 ? 'neutral' : 'refused' },
    ]),
  );
  const meals = [
    ...brocoli,
    meal('z', daysAgo(3), [
      { foodKey: 'zapallo', foodName: 'Zapallo', acceptance: 'loved' },
      { foodKey: 'pera', foodName: 'Pera', acceptance: 'disliked' },
    ]),
  ];
  const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });

  it('separa favoritos, lo que todavía no le gusta y lo que hay que volver a ofrecer', () => {
    expect(r.acceptance.favorites.map((f) => f.name)).toEqual(['Zapallo']);
    expect(r.acceptance.notYet.map((f) => [f.name, f.refusals, f.exposures])).toEqual([
      ['Brócoli', 5, 6],
      ['Pera', 1, 1],
    ]);
    // Primero lo que hace más que no ve.
    expect(r.acceptance.reoffer.map((f) => f.name)).toEqual(['Brócoli', 'Pera']);
  });

  it('pregunta por los alimentos que rechaza muchas veces', () => {
    const q = r.questions.find((x) => x.topic === 'refusals');
    expect(q?.text).toBe(
      'Rechaza seguido brócoli (5 veces): ¿lo seguimos ofreciendo igual o probamos de otra forma?',
    );
  });
});

describe('buildSolidsReport texturas', () => {
  it('cuenta formatos y los agrupa por edad, sin saltear meses vacíos', () => {
    const r = buildSolidsReport({
      meals: [
        meal('a', '2026-09-05T15:00:00Z', [{ format: 'puree' }, { format: 'puree' }]),
        meal('b', '2026-10-30T15:00:00Z', [{ format: 'mashed' }, { format: 'finger' }, {}]),
      ],
      ageMonths: 8,
      birthDate: BIRTH,
      now: NOW,
    });
    expect(r.textures.totals).toEqual({ puree: 2, mashed: 1, preloaded: 0, finger: 1 });
    expect(r.textures.total).toBe(4);
    expect(r.textures.unknown).toBe(1);
    expect(r.textures.byAge).toBe(true);
    expect(r.textures.byMonth.map((m) => [m.label, m.total])).toEqual([
      ['6 meses', 2],
      ['7 meses', 0],
      ['8 meses', 2],
    ]);
    expect(r.textures.noLumpsRecently).toBe(false);
  });

  it('sin fecha de nacimiento cuenta los meses desde que empezó', () => {
    const r = buildSolidsReport({
      meals: [
        meal('a', '2026-09-05T15:00:00Z', [{ format: 'puree' }]),
        meal('b', '2026-10-10T15:00:00Z', [{ format: 'mashed' }]),
      ],
      ageMonths: 6,
      birthDate: null,
      now: NOW,
    });
    expect(r.textures.byAge).toBe(false);
    expect(r.textures.byMonth.map((m) => m.label)).toEqual(['Mes 1', 'Mes 2']);
  });

  it('a los 8 meses con todo en papilla lisa pregunta cómo pasar a grumos', () => {
    const meals = [
      meal('old', daysAgo(60), [{ format: 'finger' }]),
      meal('a', daysAgo(10), [{ format: 'puree' }]),
      meal('b', daysAgo(2), [{ format: 'preloaded' }]),
    ];
    const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });
    expect(r.textures.noLumpsRecently).toBe(true);
    expect(r.questions.find((q) => q.topic === 'texture')?.text).toMatch(
      /^Ya tiene 8 meses y en el último mes comió todo en papilla lisa/,
    );
    const at7 = buildSolidsReport({ meals, ageMonths: 7, birthDate: BIRTH, now: NOW });
    expect(at7.questions.some((q) => q.topic === 'texture')).toBe(false);
  });
});

describe('buildSolidsReport arcadas', () => {
  it('lista los episodios y pregunta si son frecuentes', () => {
    const meals = [
      meal('old', daysAgo(30), [{ foodKey: 'pan', foodName: 'Pan', gagged: true }]),
      meal('a', daysAgo(6), [{ foodKey: 'pollo', foodName: 'Pollo', gagged: true }]),
      meal('b', daysAgo(4), [{ foodKey: 'zapallo' }]),
      meal('c', daysAgo(3), [
        { foodKey: 'pollo', foodName: 'Pollo', gagged: true },
        { foodKey: 'manzana', foodName: 'Manzana', gagged: true },
      ]),
      meal('d', daysAgo(1), [{ foodKey: 'banana', foodName: 'Banana', gagged: true }]),
    ];
    const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });
    expect(r.gagging.meals).toBe(4);
    expect(r.gagging.recent).toBe(3);
    expect(r.gagging.recentMeals).toBe(4);
    expect(r.gagging.episodes.map((e) => e.mealId)).toEqual(['d', 'c', 'a', 'old']);
    expect(r.gagging.episodes[1]?.foods).toEqual(['Pollo', 'Manzana']);
    expect(r.questions.find((q) => q.topic === 'gagging')?.text).toBe(
      'Tuvo arcadas en 3 de 4 comidas de las últimas 2 semanas (con pollo, manzana y banana): ¿es lo esperable mientras aprende o conviene cambiar la textura o la forma de ofrecer?',
    );
  });

  it('un par de arcadas no generan pregunta', () => {
    const meals = [meal('a', daysAgo(2), [{ gagged: true }]), meal('b', daysAgo(1), [{}])];
    const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });
    expect(r.gagging.recent).toBe(1);
    expect(r.questions.some((q) => q.topic === 'gagging')).toBe(false);
  });
});

describe('buildSolidsReport hierro', () => {
  it('cuenta los días con hierro de las últimas 2 semanas', () => {
    const meals = [
      meal('start', daysAgo(40), [{ foodKey: 'zapallo' }]),
      meal('x', daysAgo(14), [{ foodKey: 'carne', foodName: 'Carne' }]), // fuera de la ventana
      meal('a', daysAgo(13), [{ foodKey: 'carne', foodName: 'Carne' }]),
      meal('b', daysAgo(5), [{ foodKey: 'lentejas', foodName: 'Lentejas' }]),
      meal('b2', daysAgo(5), [{ foodKey: 'carne', foodName: 'Carne' }]),
      meal('c', daysAgo(2), [{ foodKey: 'zapallo' }]),
      meal('d', daysAgo(0), [{ foodKey: 'banana' }]),
    ];
    const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });
    expect(r.iron.windowDays).toBe(14);
    expect(r.iron.daysWithIron).toBe(2);
    expect(r.iron.daysWithMeals).toBe(4);
    expect(r.iron.foods.sort()).toEqual(['Carne vacuna', 'Lentejas'].sort());
    expect(r.questions.find((q) => q.topic === 'iron')?.text).toBe(
      'En las últimas 2 semanas comió algo con hierro 2 de 14 días: ¿le alcanza o conviene reforzarlo?',
    );
  });

  it('si empezó hace poco, la ventana son los días que van y no pregunta antes de una semana', () => {
    const meals = [
      meal('a', daysAgo(3), [{ foodKey: 'zapallo' }]),
      meal('b', daysAgo(1), [{ foodKey: 'carne' }]),
    ];
    const r = buildSolidsReport({ meals, ageMonths: 6, birthDate: null, now: NOW });
    expect(r.iron.windowDays).toBe(4);
    expect(r.iron.daysWithIron).toBe(1);
    expect(r.iron.days).toEqual([
      { date: '2026-11-04', meals: true, iron: false },
      { date: '2026-11-05', meals: false, iron: false },
      { date: '2026-11-06', meals: true, iron: true },
      { date: '2026-11-07', meals: false, iron: false },
    ]);
    expect(r.questions.some((q) => q.topic === 'iron')).toBe(false);
  });
});

describe('solidsReportForPrep', () => {
  it('antes de los 5 meses y sin comidas no agrega nada', () => {
    const r = buildSolidsReport({ meals: [], ageMonths: 4, birthDate: null, now: NOW });
    expect(solidsReportForPrep(r)).toBeNull();
  });

  it('a los 6 meses sin comidas lo dice', () => {
    const r = buildSolidsReport({ meals: [], ageMonths: 6, birthDate: null, now: NOW });
    expect(solidsReportForPrep(r)).toMatch(/Todavía no hay comidas sólidas/);
  });

  it('resume inicio, alérgenos, reacciones, texturas, hierro y preguntas', () => {
    const meals = [
      meal('a', '2026-09-05T15:00:00Z', [
        { foodKey: 'zapallo', foodName: 'Zapallo', acceptance: 'loved', format: 'puree' },
      ]),
      meal('b', daysAgo(2), [
        {
          foodKey: 'huevo',
          foodName: 'Huevo',
          format: 'finger',
          reaction: 'strong',
          reactionSigns: ['ronchas'],
          gagged: true,
        },
      ]),
    ];
    const r = buildSolidsReport({ meals, ageMonths: 8, birthDate: BIRTH, now: NOW });
    const text = solidsReportForPrep(r) ?? '';
    expect(text).toMatch(/Empezó con sólidos el 5 de septiembre de 2026, a los 6 meses/);
    expect(text).toMatch(/2 comidas, 2 alimentos distintos/);
    expect(text).toMatch(/huevo hubo reacción, 1×/);
    expect(text).toMatch(/Reacciones: 5 de noviembre, fuerte, huevo \(ronchas\)/);
    expect(text).toMatch(/Le encantan: zapallo/);
    expect(text).toMatch(/Texturas: papilla 1, con la mano 1/);
    expect(text).toMatch(/Arcadas en 1 comida \(1 en las últimas 2 semanas\)/);
    expect(text).toMatch(/Hierro: comió algo con hierro 1 de los últimos 14 días/);
    expect(text).toMatch(/Preguntas que sugiere la app: El 5 de noviembre/);
    expect(text.split('\n').every((l) => l.startsWith('- '))).toBe(true);
  });
});

describe('joinEs', () => {
  it('une como en castellano', () => {
    expect(joinEs([])).toBe('');
    expect(joinEs(['a'])).toBe('a');
    expect(joinEs(['a', 'b'])).toBe('a y b');
    expect(joinEs(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
