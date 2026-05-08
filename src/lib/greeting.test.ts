import { describe, expect, it } from 'vitest';
import { dateLabel, greetingFor } from './greeting';

describe('greetingFor', () => {
  // Convención: 'YYYY-MM-DDTHH:00:00Z' → AR = HH-3.
  it('Buen día a las 8 AR (11 UTC)', () => {
    expect(greetingFor(new Date('2026-05-08T11:00:00Z'))).toBe('Buen día');
  });

  it('Buen día borde a las 5 AR (08 UTC)', () => {
    expect(greetingFor(new Date('2026-05-08T08:00:00Z'))).toBe('Buen día');
  });

  it('Buenas tardes a las 13 AR (16 UTC)', () => {
    expect(greetingFor(new Date('2026-05-08T16:00:00Z'))).toBe('Buenas tardes');
  });

  it('Buenas tardes borde a las 12 AR (15 UTC)', () => {
    expect(greetingFor(new Date('2026-05-08T15:00:00Z'))).toBe('Buenas tardes');
  });

  it('Buenas noches a las 21 AR (00 UTC del día siguiente)', () => {
    expect(greetingFor(new Date('2026-05-09T00:00:00Z'))).toBe('Buenas noches');
  });

  it('Buenas noches borde a las 19 AR (22 UTC)', () => {
    expect(greetingFor(new Date('2026-05-08T22:00:00Z'))).toBe('Buenas noches');
  });

  it('Buenas noches en la madrugada — 3 AR (06 UTC)', () => {
    expect(greetingFor(new Date('2026-05-08T06:00:00Z'))).toBe('Buenas noches');
  });
});

describe('dateLabel', () => {
  it('formatea una fecha conocida con weekday + día + mes', () => {
    // 2026-05-08 12:00 UTC → 09:00 AR jueves.
    const label = dateLabel(new Date('2026-05-08T12:00:00Z'));
    expect(label).toMatch(/Viernes/);
    expect(label).toMatch(/8/);
    expect(label).toMatch(/mayo/);
  });

  it('capitaliza la primera letra', () => {
    const label = dateLabel(new Date('2026-05-08T12:00:00Z'));
    expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
  });
});
