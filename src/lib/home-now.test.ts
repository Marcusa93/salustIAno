import { describe, expect, it } from 'vitest';
import {
  elapsedParts,
  isStale,
  preciseAgeLabel,
  sinceLabel,
  sleepKindAt,
  wakeProgress,
} from './home-now';

const at = (iso: string) => new Date(iso);

describe('elapsedParts', () => {
  it('separa horas y minutos y nunca da negativo', () => {
    expect(elapsedParts('2026-10-16T10:00:00-03:00', at('2026-10-16T12:25:30-03:00'))).toEqual({
      hours: 2,
      minutes: 25,
      totalMinutes: 145,
    });
    expect(
      elapsedParts('2026-10-16T12:00:00-03:00', at('2026-10-16T11:00:00-03:00')).totalMinutes,
    ).toBe(0);
  });
});

describe('sinceLabel', () => {
  const now = at('2026-10-16T12:00:00-03:00');
  it('habla como la familia', () => {
    expect(sinceLabel('2026-10-16T11:59:40-03:00', now)).toBe('recién');
    expect(sinceLabel('2026-10-16T11:48:00-03:00', now)).toBe('hace 12 min');
    expect(sinceLabel('2026-10-16T10:00:00-03:00', now)).toBe('hace 2 h');
    expect(sinceLabel('2026-10-16T09:55:00-03:00', now)).toBe('hace 2 h 5 min');
    expect(sinceLabel('2026-10-15T10:00:00-03:00', now)).toBe('hace 1 día');
    expect(sinceLabel('2026-10-13T10:00:00-03:00', now)).toBe('hace 3 días');
  });

  it('pasada una semana muestra la fecha', () => {
    expect(sinceLabel('2026-07-14T02:30:00-03:00', now)).toBe('el 14 jul');
  });
});

describe('isStale', () => {
  const now = at('2026-10-16T12:00:00-03:00');
  it('marca como viejo lo de hace más de 48 h', () => {
    expect(isStale('2026-10-14T13:00:00-03:00', now)).toBe(false);
    expect(isStale('2026-10-14T11:00:00-03:00', now)).toBe(true);
  });
});

describe('preciseAgeLabel', () => {
  it('cuenta días y semanas el primer mes', () => {
    expect(preciseAgeLabel('2026-05-04', at('2026-05-12T12:00:00-03:00'))).toBe('8 días');
    expect(preciseAgeLabel('2026-05-04', at('2026-05-18T12:00:00-03:00'))).toBe('2 semanas');
    expect(preciseAgeLabel('2026-05-04', at('2026-05-27T12:00:00-03:00'))).toBe(
      '3 semanas y 2 días',
    );
  });

  it('cuenta meses calendario y los días que sobran', () => {
    expect(preciseAgeLabel('2026-05-04', at('2026-10-04T12:00:00-03:00'))).toBe('5 meses');
    expect(preciseAgeLabel('2026-05-04', at('2026-10-16T12:00:00-03:00'))).toBe(
      '5 meses y 12 días',
    );
    expect(preciseAgeLabel('2026-05-04', at('2026-06-03T12:00:00-03:00'))).toBe(
      '4 semanas y 2 días',
    );
    expect(preciseAgeLabel('2026-01-31', at('2026-03-01T12:00:00-03:00'))).toBe('1 mes y 1 día');
  });

  it('usa el día de Argentina aunque en UTC ya sea mañana', () => {
    expect(preciseAgeLabel('2026-05-04', at('2026-10-17T01:30:00Z'))).toBe('5 meses y 12 días');
  });

  it('pasa a años después de los 2', () => {
    expect(preciseAgeLabel('2026-05-04', at('2028-07-10T12:00:00-03:00'))).toBe('2 años y 2 meses');
  });

  it('devuelve null con fechas inválidas o futuras', () => {
    expect(preciseAgeLabel('ayer', at('2026-10-16T12:00:00-03:00'))).toBeNull();
    expect(preciseAgeLabel('2027-01-01', at('2026-10-16T12:00:00-03:00'))).toBeNull();
  });
});

describe('wakeProgress', () => {
  const window = {
    minDays: 150,
    maxDays: 210,
    ageLabel: '5–7 meses',
    minMinutes: 120,
    maxMinutes: 150,
  };
  const woke = '2026-10-16T10:00:00-03:00';

  it('marca temprano, ideal y pasado', () => {
    expect(wakeProgress(woke, window, at('2026-10-16T11:00:00-03:00')).status).toBe('early');
    expect(wakeProgress(woke, window, at('2026-10-16T12:10:00-03:00')).status).toBe('ideal');
    expect(wakeProgress(woke, window, at('2026-10-16T12:45:00-03:00')).status).toBe('late');
  });

  it('expresa el avance contra el final de la ventana ideal', () => {
    const progress = wakeProgress(woke, window, at('2026-10-16T11:15:00-03:00'));
    expect(progress.fraction).toBeCloseTo(0.5);
    expect(progress.idealStart).toBeCloseTo(0.8);
  });
});

describe('sleepKindAt', () => {
  it('de 19 a 7 hs de Argentina es noche; el resto, siesta', () => {
    expect(sleepKindAt(at('2026-10-16T19:00:00-03:00'))).toBe('night');
    expect(sleepKindAt(at('2026-10-16T03:00:00-03:00'))).toBe('night');
    expect(sleepKindAt(at('2026-10-16T07:00:00-03:00'))).toBe('nap');
    expect(sleepKindAt(at('2026-10-16T15:30:00-03:00'))).toBe('nap');
  });
});
