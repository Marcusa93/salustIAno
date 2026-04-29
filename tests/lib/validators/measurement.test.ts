import { measurementSchema } from '@/lib/validators/measurement';
import { describe, expect, it } from 'vitest';

describe('measurementSchema', () => {
  const baseAt = '2026-05-01T10:00';

  it('acepta solo peso', () => {
    expect(measurementSchema.safeParse({ measured_at: baseAt, weight_grams: 3500 }).success).toBe(
      true,
    );
  });

  it('acepta solo talla', () => {
    expect(measurementSchema.safeParse({ measured_at: baseAt, height_cm: 52 }).success).toBe(true);
  });

  it('acepta solo perímetro cefálico', () => {
    expect(
      measurementSchema.safeParse({
        measured_at: baseAt,
        head_circumference_cm: 36,
      }).success,
    ).toBe(true);
  });

  it('rechaza si los tres están vacíos', () => {
    expect(measurementSchema.safeParse({ measured_at: baseAt }).success).toBe(false);
  });

  it('rechaza measured_at vacío', () => {
    expect(measurementSchema.safeParse({ measured_at: '', weight_grams: 3500 }).success).toBe(
      false,
    );
  });

  it('rechaza peso fuera de 500-50000', () => {
    expect(measurementSchema.safeParse({ measured_at: baseAt, weight_grams: 100 }).success).toBe(
      false,
    );
    expect(measurementSchema.safeParse({ measured_at: baseAt, weight_grams: 60000 }).success).toBe(
      false,
    );
  });

  it('rechaza talla fuera de 30-200', () => {
    expect(measurementSchema.safeParse({ measured_at: baseAt, height_cm: 10 }).success).toBe(false);
    expect(measurementSchema.safeParse({ measured_at: baseAt, height_cm: 250 }).success).toBe(
      false,
    );
  });

  it('rechaza perímetro cefálico fuera de 25-65', () => {
    expect(
      measurementSchema.safeParse({
        measured_at: baseAt,
        head_circumference_cm: 10,
      }).success,
    ).toBe(false);
    expect(
      measurementSchema.safeParse({
        measured_at: baseAt,
        head_circumference_cm: 80,
      }).success,
    ).toBe(false);
  });

  it('NaN en numéricos se transforma a undefined (campos vacíos)', () => {
    const r = measurementSchema.safeParse({
      measured_at: baseAt,
      weight_grams: 3500,
      height_cm: Number.NaN,
      head_circumference_cm: Number.NaN,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.height_cm).toBeUndefined();
      expect(r.data.head_circumference_cm).toBeUndefined();
    }
  });

  it('acepta los tres valores juntos', () => {
    expect(
      measurementSchema.safeParse({
        measured_at: baseAt,
        weight_grams: 3500,
        height_cm: 52,
        head_circumference_cm: 36,
        notes: 'Primer control. Todo bien.',
      }).success,
    ).toBe(true);
  });
});
