import {
  NOTE_CATEGORY_DESCRIPTIONS,
  NOTE_CATEGORY_LABELS,
  noteCategoryEnum,
  noteSchema,
} from '@/lib/validators/note';
import { describe, expect, it } from 'vitest';

describe('noteCategoryEnum', () => {
  it('expone las 4 categorías esperadas', () => {
    expect(noteCategoryEnum.options).toEqual(['memory', 'observation', 'milestone', 'other']);
  });

  it('hay label y descripción para cada categoría', () => {
    for (const cat of noteCategoryEnum.options) {
      expect(NOTE_CATEGORY_LABELS[cat]).toBeTruthy();
      expect(NOTE_CATEGORY_DESCRIPTIONS[cat]).toBeTruthy();
    }
  });
});

describe('noteSchema', () => {
  const valid = {
    occurred_at: '2026-05-01T10:00',
    category: 'memory' as const,
    content: 'Hoy se rió por primera vez con la abuela.',
  };

  it('acepta input válido', () => {
    expect(noteSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza content vacío', () => {
    expect(noteSchema.safeParse({ ...valid, content: '' }).success).toBe(false);
  });

  it('rechaza content > 5000 chars', () => {
    expect(noteSchema.safeParse({ ...valid, content: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('rechaza occurred_at vacío', () => {
    expect(noteSchema.safeParse({ ...valid, occurred_at: '' }).success).toBe(false);
  });

  it('rechaza categoría inválida', () => {
    expect(noteSchema.safeParse({ ...valid, category: 'inventada' as never }).success).toBe(false);
  });

  it('default es memory cuando se omite la categoría', () => {
    const { category: _, ...rest } = valid;
    const result = noteSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('memory');
    }
  });

  it('content de 5000 chars exactos pasa (límite inclusivo)', () => {
    expect(noteSchema.safeParse({ ...valid, content: 'x'.repeat(5000) }).success).toBe(true);
  });
});
