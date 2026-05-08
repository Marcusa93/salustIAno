import { describe, expect, it } from 'vitest';
import { suggestNextSleep, wakeWindowFor } from './wake-windows';

describe('wakeWindowFor', () => {
  it('null si no hay edad', () => {
    expect(wakeWindowFor(null)).toBeNull();
  });

  it('null si edad negativa (todavía no nació)', () => {
    expect(wakeWindowFor(-3)).toBeNull();
  });

  it('recién nacido cae en 0–1 mes', () => {
    const w = wakeWindowFor(5);
    expect(w?.ageLabel).toBe('0–1 mes');
    expect(w?.minMinutes).toBe(45);
    expect(w?.maxMinutes).toBe(60);
  });

  it('exacto en el borde inferior del siguiente rango', () => {
    const w = wakeWindowFor(30);
    expect(w?.ageLabel).toBe('1–2 meses');
  });

  it('borde superior es exclusivo', () => {
    expect(wakeWindowFor(60)?.ageLabel).toBe('2–3 meses');
  });

  it('3 meses cae en 3–4 meses', () => {
    const w = wakeWindowFor(95);
    expect(w?.ageLabel).toBe('3–4 meses');
    expect(w?.minMinutes).toBe(75);
    expect(w?.maxMinutes).toBe(120);
  });

  it('null para mayor de 24 meses', () => {
    expect(wakeWindowFor(800)).toBeNull();
  });
});

describe('suggestNextSleep', () => {
  const now = new Date('2026-05-07T12:00:00Z');

  it('null si lastWokeUpAt es null', () => {
    expect(suggestNextSleep(95, null, now)).toBeNull();
  });

  it('null si ageDays no aplica', () => {
    expect(suggestNextSleep(null, '2026-05-07T11:00:00Z', now)).toBeNull();
  });

  it('null si lastWokeUpAt es inválido', () => {
    expect(suggestNextSleep(95, 'not-a-date', now)).toBeNull();
  });

  it('rango calculado a partir del último despertar', () => {
    // bebé de 3 meses (ventana 75–120 min). Despertó a las 11:00.
    const r = suggestNextSleep(95, '2026-05-07T11:00:00Z', now);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.rangeStart.toISOString()).toBe('2026-05-07T12:15:00.000Z');
    expect(r.rangeEnd.toISOString()).toBe('2026-05-07T13:00:00.000Z');
    expect(r.window.ageLabel).toBe('3–4 meses');
  });

  it('minutesUntilStart positivo si la ventana todavía no empezó', () => {
    // recién nacido (45–60 min). Despertó a las 11:30.
    const r = suggestNextSleep(5, '2026-05-07T11:30:00Z', now);
    expect(r?.minutesUntilStart).toBe(15); // 11:30 + 45 = 12:15 → faltan 15 min desde 12:00
  });

  it('minutesUntilStart negativo si la ventana ya empezó', () => {
    const r = suggestNextSleep(5, '2026-05-07T10:30:00Z', now);
    // 10:30 + 45 = 11:15 → ya pasaron 45 min
    expect(r?.minutesUntilStart).toBe(-45);
  });
});
