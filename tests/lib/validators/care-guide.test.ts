import {
  CARE_GUIDE_CATEGORY_LABELS,
  careGuideCategoryEnum,
  careGuideCreateSchema,
} from '@/lib/validators/care-guide';
import { describe, expect, it } from 'vitest';

describe('careGuideCategoryEnum', () => {
  it('expone las 6 categorías esperadas', () => {
    expect(careGuideCategoryEnum.options).toEqual([
      'dormir',
      'higiene',
      'alimentacion',
      'control',
      'emergencia',
      'otros',
    ]);
  });

  it('CARE_GUIDE_CATEGORY_LABELS cubre todas las categorías', () => {
    for (const cat of careGuideCategoryEnum.options) {
      expect(CARE_GUIDE_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

describe('careGuideCreateSchema', () => {
  const valid = {
    title: 'Sueño seguro',
    category: 'dormir' as const,
    content: 'Boca arriba, en su Moisés. Colchón duro, sin nada alrededor.',
    source: 'Pediatra Dra. Romero',
  };

  it('acepta input válido', () => {
    expect(careGuideCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('source vacío string también es aceptado (lo tratamos como NULL en server)', () => {
    expect(careGuideCreateSchema.safeParse({ ...valid, source: '' }).success).toBe(true);
  });

  it('source ausente es aceptado', () => {
    const { source: _, ...rest } = valid;
    expect(careGuideCreateSchema.safeParse(rest).success).toBe(true);
  });

  it('rechaza title vacío', () => {
    expect(careGuideCreateSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rechaza title > 200 chars', () => {
    expect(careGuideCreateSchema.safeParse({ ...valid, title: 'x'.repeat(201) }).success).toBe(
      false,
    );
  });

  it('rechaza content vacío', () => {
    expect(careGuideCreateSchema.safeParse({ ...valid, content: '' }).success).toBe(false);
  });

  it('rechaza content > 10.000 chars', () => {
    expect(careGuideCreateSchema.safeParse({ ...valid, content: 'x'.repeat(10_001) }).success).toBe(
      false,
    );
  });

  it('rechaza categoría inválida', () => {
    expect(
      careGuideCreateSchema.safeParse({ ...valid, category: 'inventada' as never }).success,
    ).toBe(false);
  });
});
