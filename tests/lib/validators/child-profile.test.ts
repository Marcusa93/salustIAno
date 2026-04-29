import {
  childProfileSchema,
  chronologicalAgeDays,
  correctedAgeDays,
} from '@/lib/validators/child-profile';
import { describe, expect, it } from 'vitest';

describe('childProfileSchema', () => {
  it('acepta solo nombre (mínimo viable, antes del nacimiento)', () => {
    const result = childProfileSchema.safeParse({ name: 'Salustiano' });
    expect(result.success).toBe(true);
  });

  it('acepta perfil completo', () => {
    const result = childProfileSchema.safeParse({
      name: 'Salustiano',
      birth_date: '2026-05-01',
      birth_time: '14:30',
      birth_place: 'Sanatorio del Norte, Tucumán',
      birth_weight_grams: 3200,
      birth_height_cm: 50,
      gestational_weeks_at_birth: 40,
      pediatrician_name: 'Dra. Romero',
      pediatrician_phone: '+54 9 381 555 1234',
      health_insurance: 'OSDE',
      blood_type: 'O+',
      notes: 'Sin alergias conocidas.',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    expect(childProfileSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rechaza peso fuera de rango', () => {
    expect(childProfileSchema.safeParse({ name: 'X', birth_weight_grams: 100 }).success).toBe(
      false,
    );
    expect(childProfileSchema.safeParse({ name: 'X', birth_weight_grams: 9000 }).success).toBe(
      false,
    );
  });

  it('rechaza talla fuera de rango', () => {
    expect(childProfileSchema.safeParse({ name: 'X', birth_height_cm: 5 }).success).toBe(false);
    expect(childProfileSchema.safeParse({ name: 'X', birth_height_cm: 100 }).success).toBe(false);
  });

  it('rechaza semanas gestacionales fuera de 22-45', () => {
    expect(
      childProfileSchema.safeParse({ name: 'X', gestational_weeks_at_birth: 20 }).success,
    ).toBe(false);
    expect(
      childProfileSchema.safeParse({ name: 'X', gestational_weeks_at_birth: 50 }).success,
    ).toBe(false);
  });

  it('NaN en numéricos se transforma a undefined (campos vacíos)', () => {
    const result = childProfileSchema.safeParse({
      name: 'X',
      birth_weight_grams: Number.NaN,
      birth_height_cm: Number.NaN,
      gestational_weeks_at_birth: Number.NaN,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.birth_weight_grams).toBeUndefined();
      expect(result.data.birth_height_cm).toBeUndefined();
      expect(result.data.gestational_weeks_at_birth).toBeUndefined();
    }
  });

  it('rechaza tipo de sangre inválido pero acepta vacío (queda como NULL)', () => {
    expect(childProfileSchema.safeParse({ name: 'X', blood_type: 'Z+' as never }).success).toBe(
      false,
    );
    expect(childProfileSchema.safeParse({ name: 'X', blood_type: '' }).success).toBe(true);
  });
});

describe('chronologicalAgeDays', () => {
  it('null si no hay birth_date', () => {
    expect(chronologicalAgeDays(null)).toBeNull();
  });

  it('calcula días desde el nacimiento', () => {
    const now = new Date('2026-05-15T12:00:00.000Z');
    expect(chronologicalAgeDays('2026-05-01', now)).toBe(14);
  });
});

describe('correctedAgeDays', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('null si no hay birth_date', () => {
    expect(correctedAgeDays(null, 35, now)).toBeNull();
  });

  it('null si fue de término (>=37 semanas)', () => {
    expect(correctedAgeDays('2026-05-01', 40, now)).toBeNull();
    expect(correctedAgeDays('2026-05-01', 37, now)).toBeNull();
  });

  it('resta semanas que faltaron para 40 si fue prematuro', () => {
    // 2026-05-01 al 2026-06-01 = 31 días cronológicos
    // Prematuro a 35 semanas: faltaron 5 semanas = 35 días
    // Edad corregida: 31 - 35 = -4 (todavía no llegaría a término)
    expect(correctedAgeDays('2026-05-01', 35, now)).toBe(-4);
  });

  it('null si gestational_weeks no está', () => {
    expect(correctedAgeDays('2026-05-01', null, now)).toBeNull();
  });
});
