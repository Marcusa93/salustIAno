import { describe, expect, it } from 'vitest';

import { lullabyInputSchema, lullabyOutputSchema } from '@/lib/ai/agents/lullaby-schema';

describe('lullabyInputSchema', () => {
  const validInput = {
    childName: 'Salustiano',
    ageDescription: '3 meses',
    moment: 'dormir',
    mood: 'dulce',
    length: 'corta',
  };

  it('acepta input mínimo bien formado', () => {
    expect(lullabyInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('acepta theme opcional', () => {
    expect(lullabyInputSchema.safeParse({ ...validInput, theme: 'el mar' }).success).toBe(true);
  });

  it('rechaza moment inválido', () => {
    expect(lullabyInputSchema.safeParse({ ...validInput, moment: 'inventado' }).success).toBe(
      false,
    );
  });

  it('rechaza mood inválido', () => {
    expect(lullabyInputSchema.safeParse({ ...validInput, mood: 'salvaje' }).success).toBe(false);
  });

  it('rechaza length inválido', () => {
    expect(lullabyInputSchema.safeParse({ ...validInput, length: 'inmensa' }).success).toBe(false);
  });

  it('rechaza childName vacío', () => {
    expect(lullabyInputSchema.safeParse({ ...validInput, childName: '' }).success).toBe(false);
  });
});

describe('lullabyOutputSchema', () => {
  const validOutput = {
    title: 'Luna que viene',
    intro: 'Para tararear bajito mientras lo mecen.',
    verses: ['Luna que viene\nluna que va\nSalu en mi pecho\nse va a dormir ya'],
    chorus: 'Duerme, mi luz\nduerme, mi sol',
    closing: 'La noche se queda con vos',
    mood: 'dulce' as const,
  };

  it('acepta output mínimo válido', () => {
    expect(lullabyOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it('acepta chorus y closing vacíos', () => {
    expect(lullabyOutputSchema.safeParse({ ...validOutput, chorus: '', closing: '' }).success).toBe(
      true,
    );
  });

  it('exige al menos una estrofa', () => {
    expect(lullabyOutputSchema.safeParse({ ...validOutput, verses: [] }).success).toBe(false);
  });

  it('rechaza más de 4 estrofas', () => {
    expect(
      lullabyOutputSchema.safeParse({
        ...validOutput,
        verses: ['v1', 'v2', 'v3', 'v4', 'v5'],
      }).success,
    ).toBe(false);
  });

  it('rechaza title vacío', () => {
    expect(lullabyOutputSchema.safeParse({ ...validOutput, title: '' }).success).toBe(false);
  });

  it('rechaza mood fuera del enum', () => {
    expect(lullabyOutputSchema.safeParse({ ...validOutput, mood: 'enojado' }).success).toBe(false);
  });
});
