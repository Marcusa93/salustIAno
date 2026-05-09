import { describe, expect, it } from 'vitest';
import {
  averagePerDay,
  formatPredictionTime,
  predictNextDiaper,
  predictNextEvent,
  predictNextFeeding,
} from './predictions';

describe('predictNextEvent', () => {
  it('null si no hay suficiente historia (< 3 samples válidos)', () => {
    expect(predictNextEvent([], '2026-05-08T12:00:00Z')).toBeNull();
    expect(predictNextEvent(['2026-05-08T10:00:00Z'], '2026-05-08T12:00:00Z')).toBeNull();
  });

  it('predice con 3 intervalos parejos (mediana = intervalo)', () => {
    // 4 timestamps → 3 intervalos de 3h cada uno
    const history = [
      '2026-05-08T08:00:00Z',
      '2026-05-08T11:00:00Z',
      '2026-05-08T14:00:00Z',
      '2026-05-08T17:00:00Z',
    ];
    const result = predictNextEvent(history, '2026-05-08T17:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.medianIntervalMinutes).toBe(180);
    expect(result?.samples).toBe(3);
    expect(result?.expectedAt.toISOString()).toBe('2026-05-08T20:00:00.000Z');
  });

  it('mediana es robusta a outliers', () => {
    // intervalos: 3h, 3h, 3h, 8h, 3h → sin filtro, mediana 180min
    const history = [
      '2026-05-08T00:00:00Z',
      '2026-05-08T03:00:00Z',
      '2026-05-08T06:00:00Z',
      '2026-05-08T09:00:00Z',
      '2026-05-08T17:00:00Z', // outlier 8h
      '2026-05-08T20:00:00Z',
    ];
    const result = predictNextEvent(history, '2026-05-08T20:00:00Z');
    expect(result?.medianIntervalMinutes).toBe(180);
  });

  it('respeta minIntervalMinutes (descarta re-cargas)', () => {
    // 5 min entre los dos primeros → descartado por filtro
    const history = [
      '2026-05-08T08:00:00Z',
      '2026-05-08T08:05:00Z', // re-carga, ignorada
      '2026-05-08T11:00:00Z',
      '2026-05-08T14:00:00Z',
      '2026-05-08T17:00:00Z',
    ];
    const result = predictNextEvent(history, '2026-05-08T17:00:00Z', {
      minIntervalMinutes: 30,
    });
    // Quedan 3 intervalos válidos (175, 180, 180), mediana = 180
    expect(result?.samples).toBe(3);
    expect(result?.medianIntervalMinutes).toBe(180);
  });

  it('respeta maxIntervalMinutes (descarta lapsos)', () => {
    const history = [
      '2026-05-08T00:00:00Z',
      '2026-05-08T03:00:00Z',
      '2026-05-08T06:00:00Z',
      '2026-05-08T18:00:00Z', // 12h gap, ignorado
      '2026-05-08T21:00:00Z',
    ];
    const result = predictNextEvent(history, '2026-05-08T21:00:00Z', {
      maxIntervalMinutes: 360,
    });
    expect(result?.samples).toBe(3); // 3h, 3h, 3h
    expect(result?.medianIntervalMinutes).toBe(180);
  });

  it('null cuando todos los intervalos son filtrados', () => {
    const history = ['2026-05-08T00:00:00Z', '2026-05-08T15:00:00Z', '2026-05-09T06:00:00Z'];
    expect(
      predictNextEvent(history, '2026-05-09T06:00:00Z', { maxIntervalMinutes: 60 }),
    ).toBeNull();
  });

  it('null si lastAt es inválido', () => {
    const history = [
      '2026-05-08T00:00:00Z',
      '2026-05-08T03:00:00Z',
      '2026-05-08T06:00:00Z',
      '2026-05-08T09:00:00Z',
    ];
    expect(predictNextEvent(history, 'no-es-fecha')).toBeNull();
  });

  it('mediana con número par de intervalos = promedio de los dos centrales', () => {
    // 4 intervalos: 100, 200, 300, 400 → mediana = (200+300)/2 = 250
    const history = [
      '2026-05-08T00:00:00Z',
      '2026-05-08T01:40:00Z', // +100min
      '2026-05-08T05:00:00Z', // +200min
      '2026-05-08T10:00:00Z', // +300min
      '2026-05-08T16:40:00Z', // +400min
    ];
    const result = predictNextEvent(history, '2026-05-08T16:40:00Z');
    expect(result?.medianIntervalMinutes).toBe(250);
  });
});

describe('predictNextFeeding', () => {
  it('aplica filtros razonables para tomas', () => {
    // Intervalos: 4h, 4h, 4h, 4h con una re-carga de 10min
    const history = [
      '2026-05-08T00:00:00Z',
      '2026-05-08T04:00:00Z',
      '2026-05-08T04:10:00Z', // re-carga: 10min, descartada
      '2026-05-08T08:00:00Z',
      '2026-05-08T12:00:00Z',
      '2026-05-08T16:00:00Z',
    ];
    const result = predictNextFeeding(history, '2026-05-08T16:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.expectedAt.toISOString()).toBe('2026-05-08T20:00:00.000Z');
  });
});

describe('predictNextDiaper', () => {
  it('predice próximo pañal con cadencia 2h', () => {
    const history = [
      '2026-05-08T08:00:00Z',
      '2026-05-08T10:00:00Z',
      '2026-05-08T12:00:00Z',
      '2026-05-08T14:00:00Z',
    ];
    const result = predictNextDiaper(history, '2026-05-08T14:00:00Z');
    expect(result?.expectedAt.toISOString()).toBe('2026-05-08T16:00:00.000Z');
  });
});

describe('formatPredictionTime', () => {
  const now = new Date('2026-05-08T18:00:00Z');

  it('hora HH:MM si es el mismo día', () => {
    const d = new Date('2026-05-08T20:30:00Z');
    expect(formatPredictionTime(d, now)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('"mañana HH:MM" si cae al día siguiente', () => {
    const d = new Date('2026-05-09T07:00:00Z');
    expect(formatPredictionTime(d, now)).toMatch(/^mañana \d{2}:\d{2}$/);
  });

  it('weekday + hora si está más adelante', () => {
    const d = new Date('2026-05-12T07:00:00Z');
    expect(formatPredictionTime(d, now)).toMatch(/\d{2}:\d{2}/);
  });
});

describe('averagePerDay', () => {
  it('divide eventos por días', () => {
    expect(averagePerDay(35, 7)).toBe(5);
  });

  it('0 si daysInWindow es 0', () => {
    expect(averagePerDay(10, 0)).toBe(0);
  });

  it('decimales OK', () => {
    expect(averagePerDay(20, 7)).toBeCloseTo(2.857, 2);
  });
});
