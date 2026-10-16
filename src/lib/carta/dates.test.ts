import { describe, expect, it } from 'vitest';
import { ageLabelAt, daysSinceBirth, polaroidDateLabel, secondsSinceBirth } from './dates';

const BIRTH = '2026-05-04T18:30:00-03:00';

describe('ageLabelAt', () => {
  it('antes de nacer cuenta los días que faltaban', () => {
    expect(ageLabelAt(BIRTH, '2026-04-24T20:39:43-03:00')).toBe('Faltaban 10 días');
    expect(ageLabelAt(BIRTH, '2026-05-03T23:00:00-03:00')).toBe('Faltaba 1 día');
  });

  it('el mismo día calendario es el día que nació, aunque sea antes de la hora', () => {
    expect(ageLabelAt(BIRTH, '2026-05-04T12:59:14-03:00')).toBe('El día que nací');
    expect(ageLabelAt(BIRTH, '2026-05-04T23:59:00-03:00')).toBe('El día que nací');
  });

  it('usa el día de Argentina aunque el instante UTC ya sea el día siguiente', () => {
    // 22:30 AR del 4/5 = 01:30 UTC del 5/5.
    expect(ageLabelAt(BIRTH, '2026-05-05T01:30:00Z')).toBe('El día que nací');
  });

  it('cuenta días las dos primeras semanas', () => {
    expect(ageLabelAt(BIRTH, '2026-05-05T09:30:00-03:00')).toBe('1 día');
    expect(ageLabelAt(BIRTH, '2026-05-12T16:37:11-03:00')).toBe('8 días');
  });

  it('cuenta semanas hasta cumplir el primer mes calendario', () => {
    expect(ageLabelAt(BIRTH, '2026-05-24T16:47:01-03:00')).toBe('2 semanas');
    expect(ageLabelAt(BIRTH, '2026-06-03T10:00:00-03:00')).toBe('4 semanas');
  });

  it('cuenta meses calendario cumplidos', () => {
    expect(ageLabelAt(BIRTH, '2026-06-04T10:00:00-03:00')).toBe('1 mes');
    expect(ageLabelAt(BIRTH, '2026-07-03T10:00:00-03:00')).toBe('1 mes');
    expect(ageLabelAt(BIRTH, '2026-07-04T10:00:00-03:00')).toBe('2 meses');
    expect(ageLabelAt(BIRTH, '2026-10-06T17:27:42-03:00')).toBe('5 meses');
  });
});

describe('polaroidDateLabel', () => {
  it('da día y mes corto en Argentina, sin punto', () => {
    expect(polaroidDateLabel('2026-05-24T16:47:01-03:00')).toBe('24 may');
    expect(polaroidDateLabel('2026-10-03T23:30:00-03:00')).toBe('3 oct');
  });
});

describe('daysSinceBirth / secondsSinceBirth', () => {
  it('cuenta días calendario en Argentina', () => {
    expect(daysSinceBirth(BIRTH, new Date('2026-10-18T10:00:00-03:00'))).toBe(167);
    expect(daysSinceBirth(BIRTH, new Date('2026-05-04T20:00:00-03:00'))).toBe(0);
  });

  it('cuenta segundos desde el nacimiento y nunca da negativo', () => {
    expect(secondsSinceBirth(BIRTH, new Date('2026-05-04T18:31:00-03:00'))).toBe(60);
    expect(secondsSinceBirth(BIRTH, new Date('2026-05-01T00:00:00-03:00'))).toBe(0);
  });
});
