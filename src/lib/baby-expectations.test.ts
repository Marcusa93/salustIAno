import { describe, expect, it } from 'vitest';
import {
  type ExpectationRange,
  compareToRange,
  expectationsFor,
  progressPercent,
} from './baby-expectations';

describe('expectationsFor', () => {
  it('null si no hay edad', () => {
    expect(expectationsFor(null)).toBeNull();
  });

  it('null si edad negativa (todavía no nació)', () => {
    expect(expectationsFor(-3)).toBeNull();
  });

  it('null si supera 2 años', () => {
    expect(expectationsFor(800)).toBeNull();
  });

  it('día 0 cae en "Primera semana"', () => {
    expect(expectationsFor(0)?.ageLabel).toBe('Primera semana');
  });

  it('día 6 cae en "Primera semana"', () => {
    expect(expectationsFor(6)?.ageLabel).toBe('Primera semana');
  });

  it('día 7 cruza al bracket "1–4 semanas"', () => {
    expect(expectationsFor(7)?.ageLabel).toBe('1–4 semanas');
  });

  it('día 30 entra en "1–3 meses"', () => {
    expect(expectationsFor(30)?.ageLabel).toBe('1–3 meses');
  });

  it('día 90 (~3m) entra en "3–6 meses"', () => {
    expect(expectationsFor(90)?.ageLabel).toBe('3–6 meses');
  });

  it('día 180 (~6m) entra en "6–12 meses"', () => {
    expect(expectationsFor(180)?.ageLabel).toBe('6–12 meses');
  });

  it('día 365 (~1 año) entra en "1–2 años"', () => {
    expect(expectationsFor(365)?.ageLabel).toBe('1–2 años');
  });

  it('los rangos son razonables (min < max, números enteros sensatos)', () => {
    for (const days of [0, 14, 60, 120, 240, 500]) {
      const e = expectationsFor(days);
      if (!e) continue;
      expect(e.feedings.min).toBeLessThan(e.feedings.max);
      expect(e.diapers.min).toBeLessThan(e.diapers.max);
      expect(e.sleepHours.min).toBeLessThan(e.sleepHours.max);
      // Nadie debería estar más de 24h durmiendo.
      expect(e.sleepHours.max).toBeLessThanOrEqual(20);
      // Tomas: no más de 14 razonable, no menos de 3.
      expect(e.feedings.min).toBeGreaterThanOrEqual(3);
      expect(e.feedings.max).toBeLessThanOrEqual(14);
    }
  });
});

describe('compareToRange', () => {
  const range: ExpectationRange = { min: 5, max: 7 };

  it('low cuando actual < min', () => {
    expect(compareToRange(3, range)).toBe('low');
  });

  it('in_range en el borde inferior', () => {
    expect(compareToRange(5, range)).toBe('in_range');
  });

  it('in_range entre min y max', () => {
    expect(compareToRange(6, range)).toBe('in_range');
  });

  it('in_range en el borde superior', () => {
    expect(compareToRange(7, range)).toBe('in_range');
  });

  it('high cuando actual > max', () => {
    expect(compareToRange(9, range)).toBe('high');
  });

  it('low en cero', () => {
    expect(compareToRange(0, range)).toBe('low');
  });
});

describe('progressPercent', () => {
  const range: ExpectationRange = { min: 5, max: 8 };

  it('0% cuando actual=0', () => {
    expect(progressPercent(0, range)).toBe(0);
  });

  it('50% cuando actual es la mitad del max', () => {
    expect(progressPercent(4, range)).toBe(50);
  });

  it('100% cuando actual === max', () => {
    expect(progressPercent(8, range)).toBe(100);
  });

  it('clamp a 100% cuando supera el max', () => {
    expect(progressPercent(20, range)).toBe(100);
  });

  it('clamp a 0% para valores negativos', () => {
    expect(progressPercent(-5, range)).toBe(0);
  });

  it('0% si max es 0 (defensa contra divide-by-zero)', () => {
    expect(progressPercent(3, { min: 0, max: 0 })).toBe(0);
  });
});
