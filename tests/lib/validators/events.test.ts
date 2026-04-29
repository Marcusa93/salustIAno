import {
  closeSleepSchema,
  diaperEventSchema,
  feedingEventSchema,
  sleepSessionSchema,
} from '@/lib/validators/events';
import { describe, expect, it } from 'vitest';

describe('sleepSessionSchema', () => {
  it('acepta sleep solo con started_at (todavía está durmiendo)', () => {
    expect(sleepSessionSchema.safeParse({ started_at: '2026-05-01T10:00' }).success).toBe(true);
  });

  it('acepta sleep con start + end', () => {
    expect(
      sleepSessionSchema.safeParse({
        started_at: '2026-05-01T10:00',
        ended_at: '2026-05-01T11:30',
        quality: 'good',
        is_nap: true,
      }).success,
    ).toBe(true);
  });

  it('rechaza ended_at anterior a started_at', () => {
    expect(
      sleepSessionSchema.safeParse({
        started_at: '2026-05-01T11:00',
        ended_at: '2026-05-01T10:00',
      }).success,
    ).toBe(false);
  });

  it('rechaza sleep > 24 horas', () => {
    expect(
      sleepSessionSchema.safeParse({
        started_at: '2026-05-01T10:00',
        ended_at: '2026-05-03T10:00',
      }).success,
    ).toBe(false);
  });

  it('quality default es unknown', () => {
    const r = sleepSessionSchema.safeParse({ started_at: '2026-05-01T10:00' });
    if (r.success) {
      expect(r.data.quality).toBe('unknown');
      expect(r.data.is_nap).toBe(false);
    }
  });
});

describe('closeSleepSchema', () => {
  const base = {
    started_at: '2026-05-01T10:00',
    ended_at: '2026-05-01T11:30',
  };

  it('acepta un cierre con start + end válidos', () => {
    expect(closeSleepSchema.safeParse(base).success).toBe(true);
  });

  it('acepta quality opcional', () => {
    expect(closeSleepSchema.safeParse({ ...base, quality: 'good' }).success).toBe(true);
    expect(closeSleepSchema.safeParse(base).success).toBe(true);
  });

  it('exige ended_at', () => {
    expect(closeSleepSchema.safeParse({ started_at: base.started_at }).success).toBe(false);
  });

  it('rechaza ended_at anterior a started_at', () => {
    expect(
      closeSleepSchema.safeParse({
        started_at: '2026-05-01T11:00',
        ended_at: '2026-05-01T10:00',
      }).success,
    ).toBe(false);
  });

  it('rechaza cierre > 24 horas', () => {
    expect(
      closeSleepSchema.safeParse({
        started_at: '2026-05-01T10:00',
        ended_at: '2026-05-03T10:00',
      }).success,
    ).toBe(false);
  });

  it('rechaza quality inválida', () => {
    expect(
      closeSleepSchema.safeParse({
        ...base,
        quality: 'inventada' as never,
      }).success,
    ).toBe(false);
  });
});

describe('feedingEventSchema', () => {
  const base = { occurred_at: '2026-05-01T10:00' };

  it('breastfeeding con side y duration es válido', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'breastfeeding',
        side: 'left',
        duration_minutes: 15,
      }).success,
    ).toBe(true);
  });

  it('breastfeeding con amount_ml falla (coherencia)', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'breastfeeding',
        amount_ml: 60,
      }).success,
    ).toBe(false);
  });

  it('bottle con amount es válido', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'bottle',
        amount_ml: 90,
      }).success,
    ).toBe(true);
  });

  it('bottle con side falla (coherencia)', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'bottle',
        side: 'left',
        amount_ml: 90,
      }).success,
    ).toBe(false);
  });

  it('solid con foods es válido', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'solid',
        foods: ['banana', 'avena'],
      }).success,
    ).toBe(true);
  });

  it('solid con amount_ml falla', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'solid',
        amount_ml: 100,
      }).success,
    ).toBe(false);
  });

  it('amount_ml fuera de 0-1000 falla', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'bottle',
        amount_ml: 1500,
      }).success,
    ).toBe(false);
  });

  it('duration_minutes fuera de 0-180 falla', () => {
    expect(
      feedingEventSchema.safeParse({
        ...base,
        type: 'breastfeeding',
        duration_minutes: 200,
      }).success,
    ).toBe(false);
  });

  it('reaction default es none', () => {
    const r = feedingEventSchema.safeParse({
      ...base,
      type: 'breastfeeding',
    });
    if (r.success) {
      expect(r.data.reaction).toBe('none');
    }
  });
});

describe('diaperEventSchema', () => {
  it('acepta cualquiera de los 4 tipos', () => {
    for (const t of ['wet', 'dirty', 'both', 'dry'] as const) {
      expect(
        diaperEventSchema.safeParse({
          occurred_at: '2026-05-01T10:00',
          type: t,
        }).success,
      ).toBe(true);
    }
  });

  it('rechaza tipo inválido', () => {
    expect(
      diaperEventSchema.safeParse({
        occurred_at: '2026-05-01T10:00',
        type: 'inventado' as never,
      }).success,
    ).toBe(false);
  });

  it('rechaza occurred_at vacío', () => {
    expect(diaperEventSchema.safeParse({ occurred_at: '', type: 'wet' }).success).toBe(false);
  });
});
