import {
  MILESTONE_CATEGORY_LABELS,
  deriveStatus,
  milestoneCategoryEnum,
  milestoneCreateSchema,
} from '@/lib/validators/milestone';
import { describe, expect, it } from 'vitest';

describe('milestoneCategoryEnum', () => {
  it('expone las 5 categorías esperadas', () => {
    expect(milestoneCategoryEnum.options).toEqual([
      'control_pediatrico',
      'pesquisa',
      'estudio',
      'vacuna',
      'otro',
    ]);
  });

  it('MILESTONE_CATEGORY_LABELS cubre todas', () => {
    for (const cat of milestoneCategoryEnum.options) {
      expect(MILESTONE_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

describe('milestoneCreateSchema', () => {
  const valid = {
    title: 'Pesquisa neonatal',
    category: 'pesquisa' as const,
    description: 'Le sacan sangre del talón para detectar enfermedades.',
    due_at: '2026-05-05',
    notes: '',
  };

  it('acepta input válido', () => {
    expect(milestoneCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('acepta sin due_at', () => {
    expect(milestoneCreateSchema.safeParse({ ...valid, due_at: '' }).success).toBe(true);
  });

  it('rechaza title vacío', () => {
    expect(milestoneCreateSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rechaza fecha inválida', () => {
    expect(milestoneCreateSchema.safeParse({ ...valid, due_at: 'no-fecha' }).success).toBe(false);
  });

  it('rechaza categoría inválida', () => {
    expect(
      milestoneCreateSchema.safeParse({ ...valid, category: 'inventada' as never }).success,
    ).toBe(false);
  });
});

describe('deriveStatus', () => {
  const past = '2020-01-01T00:00:00.000Z';
  const future = '2099-01-01T00:00:00.000Z';
  const now = new Date('2026-04-28T12:00:00.000Z');

  it('completed cuando hay completed_at', () => {
    expect(deriveStatus(future, past, now)).toBe('completed');
    expect(deriveStatus(null, past, now)).toBe('completed');
  });

  it('overdue cuando due_at pasó y no está completado', () => {
    expect(deriveStatus(past, null, now)).toBe('overdue');
  });

  it('pending cuando due_at futuro o NULL y sin completar', () => {
    expect(deriveStatus(future, null, now)).toBe('pending');
    expect(deriveStatus(null, null, now)).toBe('pending');
  });
});
