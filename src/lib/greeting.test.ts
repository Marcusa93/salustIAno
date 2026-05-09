import { describe, expect, it } from 'vitest';
import { dateLabel, getTimeOfDayAr, greetingFor, isLateNightAr } from './greeting';

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

describe('isLateNightAr', () => {
  it('false a las 8 AR (11 UTC)', () => {
    expect(isLateNightAr(new Date('2026-05-08T11:00:00Z'))).toBe(false);
  });

  it('false a las 21 AR (00 UTC del día siguiente)', () => {
    expect(isLateNightAr(new Date('2026-05-09T00:00:00Z'))).toBe(false);
  });

  it('true a las 22 AR (01 UTC del día siguiente)', () => {
    expect(isLateNightAr(new Date('2026-05-09T01:00:00Z'))).toBe(true);
  });

  it('true a las 03 AR (06 UTC)', () => {
    expect(isLateNightAr(new Date('2026-05-08T06:00:00Z'))).toBe(true);
  });

  it('true en el borde 05:59 AR (08:59 UTC)', () => {
    expect(isLateNightAr(new Date('2026-05-08T08:59:00Z'))).toBe(true);
  });

  it('false a las 06 AR exactas (09 UTC)', () => {
    expect(isLateNightAr(new Date('2026-05-08T09:00:00Z'))).toBe(false);
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

describe('getTimeOfDayAr', () => {
  // Convención: UTC = AR + 3h. Tomamos horas sentinela en cada franja
  // y los bordes de cada transición.

  // madrugada: 22-04 inclusive (5h del día siguiente).
  it('madrugada — 23 AR (02 UTC del día sgte)', () => {
    expect(getTimeOfDayAr(new Date('2026-05-09T02:00:00Z'))).toBe('madrugada');
  });
  it('madrugada — 03 AR (06 UTC)', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T06:00:00Z'))).toBe('madrugada');
  });
  it('madrugada — 22 AR (01 UTC del sgte) borde inicio', () => {
    expect(getTimeOfDayAr(new Date('2026-05-09T01:00:00Z'))).toBe('madrugada');
  });
  it('madrugada — 04 AR (07 UTC) borde final', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T07:00:00Z'))).toBe('madrugada');
  });

  // amanecer: 05-07
  it('amanecer — 05 AR (08 UTC) borde inicio', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T08:00:00Z'))).toBe('amanecer');
  });
  it('amanecer — 07 AR (10 UTC) borde final', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T10:00:00Z'))).toBe('amanecer');
  });

  // manana: 08-11
  it('manana — 09 AR (12 UTC)', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T12:00:00Z'))).toBe('manana');
  });
  it('manana — 11 AR (14 UTC) borde final', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T14:00:00Z'))).toBe('manana');
  });

  // mediodia: 12-15
  it('mediodia — 13 AR (16 UTC)', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T16:00:00Z'))).toBe('mediodia');
  });
  it('mediodia — 15 AR (18 UTC) borde final', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T18:00:00Z'))).toBe('mediodia');
  });

  // tarde: 16-19
  it('tarde — 17 AR (20 UTC)', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T20:00:00Z'))).toBe('tarde');
  });
  it('tarde — 19 AR (22 UTC) borde final', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T22:00:00Z'))).toBe('tarde');
  });

  // anochecer: 20-21
  it('anochecer — 20 AR (23 UTC) borde inicio', () => {
    expect(getTimeOfDayAr(new Date('2026-05-08T23:00:00Z'))).toBe('anochecer');
  });
  it('anochecer — 21 AR (00 UTC del sgte)', () => {
    expect(getTimeOfDayAr(new Date('2026-05-09T00:00:00Z'))).toBe('anochecer');
  });

  it('cubre las 24h sin overlapping', () => {
    // Para cada hora 0-23 AR, debe haber exactamente una franja.
    const moods = new Set<string>();
    for (let arHour = 0; arHour < 24; arHour++) {
      // Construimos un Date que en AR es {arHour}:00.
      const utcHour = (arHour + 3) % 24;
      const d = new Date(`2026-05-08T${String(utcHour).padStart(2, '0')}:00:00Z`);
      moods.add(getTimeOfDayAr(d));
    }
    expect(moods.size).toBe(6);
  });
});
