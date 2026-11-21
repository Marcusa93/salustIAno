import { describe, expect, it } from 'vitest';

import {
  type DailyDoseRow,
  addDaysToKey,
  buildDailyCourses,
  dayKeyAr,
  escapeLike,
  isDailyInterval,
} from './daily';

let seq = 0;
function dose(givenAt: string, overrides: Partial<DailyDoseRow> = {}): DailyDoseRow {
  seq++;
  return {
    id: `d${seq}`,
    medication_name: 'Hierro',
    dose_amount: '1 ml',
    given_at: givenAt,
    interval_hours: 24,
    created_by: 'u1',
    ...overrides,
  };
}

// 16/11/2026 a las 10:00 en Argentina.
const NOW = new Date('2026-11-16T10:00:00-03:00');

describe('dayKeyAr', () => {
  it('usa el día de Argentina, no el de UTC', () => {
    // 22:30 del 15 en Argentina ya es 16 en UTC.
    expect(dayKeyAr('2026-11-16T01:30:00Z')).toBe('2026-11-15');
    expect(dayKeyAr('2026-11-16T03:00:00Z')).toBe('2026-11-16');
  });

  it('suma días cruzando meses', () => {
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToKey('2026-12-01', -1)).toBe('2026-11-30');
  });
});

describe('isDailyInterval', () => {
  it('acepta ~24 h y rechaza el resto', () => {
    expect(isDailyInterval(24)).toBe(true);
    expect(isDailyInterval(23.5)).toBe(true);
    expect(isDailyInterval(8)).toBe(false);
    expect(isDailyInterval(48)).toBe(false);
    expect(isDailyInterval(null)).toBe(false);
  });
});

describe('buildDailyCourses', () => {
  it('ayer dado y hoy pendiente', () => {
    const [course] = buildDailyCourses([dose('2026-11-15T09:10:00-03:00')], NOW);
    expect(course?.name).toBe('Hierro');
    expect(course?.startKey).toBe('2026-11-15');
    expect(course?.dayNumber).toBe(2);
    expect(course?.today).toHaveLength(0);
    expect(course?.daysGiven).toBe(1);
    expect(course?.daysDue).toBe(1);
    expect(course?.days.map((d) => d.status)).toEqual(['given', 'pending']);
  });

  it('hoy ya dado', () => {
    const [course] = buildDailyCourses(
      [dose('2026-11-15T09:10:00-03:00'), dose('2026-11-16T08:40:00-03:00')],
      NOW,
    );
    expect(course?.today).toHaveLength(1);
    expect(course?.daysDue).toBe(2);
    expect(course?.daysGiven).toBe(2);
    expect(course?.days.map((d) => d.status)).toEqual(['given', 'given']);
  });

  it('marca días salteados y dobles', () => {
    const [course] = buildDailyCourses(
      [
        dose('2026-11-12T09:00:00-03:00'),
        // 13: salteado
        dose('2026-11-14T09:00:00-03:00'),
        dose('2026-11-14T20:00:00-03:00'),
        dose('2026-11-15T09:00:00-03:00'),
      ],
      NOW,
    );
    expect(course?.days.map((d) => d.status)).toEqual([
      'given',
      'missed',
      'double',
      'given',
      'pending',
    ]);
    expect(course?.daysGiven).toBe(3);
    expect(course?.daysDue).toBe(4);
  });

  it('una dosis a las 23 h cuenta para ese día, no para el siguiente', () => {
    const [course] = buildDailyCourses([dose('2026-11-15T23:30:00-03:00')], NOW);
    expect(course?.days.map((d) => d.key)).toEqual(['2026-11-15', '2026-11-16']);
    expect(course?.today).toHaveLength(0);
  });

  it('agrupa sin importar mayúsculas y usa la última dosis como molde', () => {
    const courses = buildDailyCourses(
      [
        dose('2026-11-15T09:00:00-03:00', { medication_name: 'hierro ' }),
        dose('2026-11-16T09:00:00-03:00', { id: 'ultima', dose_amount: '1,2 ml' }),
      ],
      NOW,
    );
    expect(courses).toHaveLength(1);
    expect(courses[0]?.latestDoseId).toBe('ultima');
    expect(courses[0]?.doseAmount).toBe('1,2 ml');
  });

  it('ignora remedios que no son diarios', () => {
    const courses = buildDailyCourses(
      [dose('2026-11-16T06:00:00-03:00', { medication_name: 'Ibuprofeno', interval_hours: 8 })],
      NOW,
    );
    expect(courses).toHaveLength(0);
  });

  it('da por terminado un tratamiento que no se da hace días', () => {
    const courses = buildDailyCourses([dose('2026-11-05T09:00:00-03:00')], NOW);
    expect(courses).toHaveLength(0);
  });

  it('un corte largo empieza un tratamiento nuevo', () => {
    const [course] = buildDailyCourses(
      [dose('2026-10-01T09:00:00-03:00'), dose('2026-11-15T09:00:00-03:00')],
      NOW,
    );
    expect(course?.startKey).toBe('2026-11-15');
    expect(course?.dayNumber).toBe(2);
  });

  it('muestra como mucho los últimos días pedidos', () => {
    const doses = Array.from({ length: 20 }, (_, i) =>
      dose(new Date(Date.parse('2026-10-28T12:00:00Z') + i * 86_400_000).toISOString()),
    );
    const [course] = buildDailyCourses(doses, NOW, 14);
    expect(course?.days).toHaveLength(14);
    expect(course?.days.at(-1)?.key).toBe('2026-11-16');
    expect(course?.dayNumber).toBe(20);
  });

  it('pone primero los que faltan hoy', () => {
    const courses = buildDailyCourses(
      [
        dose('2026-11-16T08:00:00-03:00', { medication_name: 'Vitamina D' }),
        dose('2026-11-15T09:00:00-03:00'),
      ],
      NOW,
    );
    expect(courses.map((c) => c.name)).toEqual(['Hierro', 'Vitamina D']);
  });
});

describe('escapeLike', () => {
  it('escapa comodines', () => {
    expect(escapeLike('Hierro 5%_x')).toBe('Hierro 5\\%\\_x');
  });
});
