import { describe, expect, it } from 'vitest';
import {
  arDayKeyFor,
  bucketByDayLast7,
  classifyEvent,
  groupEventsByDay,
  groupEventsByTime,
} from './event-grouping';

describe('classifyEvent', () => {
  // Ahora referencia: 2026-05-08 18:00 UTC (15:00 AR del viernes 8).
  const now = new Date('2026-05-08T18:00:00Z');

  it('recent — hace 30 min', () => {
    expect(classifyEvent('2026-05-08T17:30:00Z', now)).toBe('recent');
  });

  it('today — hace 4 horas, mismo día AR', () => {
    expect(classifyEvent('2026-05-08T14:00:00Z', now)).toBe('today');
  });

  it('today — anoche temprano (21 AR del 8 = 00 UTC del 9 — pero todavía hoy AR)', () => {
    // 2026-05-08 23:30 UTC = 20:30 AR del 8 → todavía hoy AR.
    // Pero estamos comparando con el "now" de las 15:00 AR. El evento es
    // futuro respecto al now → no entra en recent (sólo eventos pasados),
    // pero classifyEvent no filtra futuros estrictamente: cae en 'today'.
    expect(classifyEvent('2026-05-08T23:30:00Z', now)).toBe('today');
  });

  it('yesterday — 7 AR de ayer', () => {
    // 7 AR del 7 mayo = 10 UTC del 7 mayo.
    expect(classifyEvent('2026-05-07T10:00:00Z', now)).toBe('yesterday');
  });

  it('yesterday — borde: 22 AR de ayer = 01 UTC de hoy', () => {
    // 2026-05-07 22:00 AR == 2026-05-08 01:00 UTC, en AR-day-key es "2026-05-07".
    expect(classifyEvent('2026-05-08T01:00:00Z', now)).toBe('yesterday');
  });

  it('older — hace 3 días', () => {
    expect(classifyEvent('2026-05-05T10:00:00Z', now)).toBe('older');
  });

  it('recent gana sobre today aunque sea en mismo día', () => {
    expect(classifyEvent('2026-05-08T17:50:00Z', now)).toBe('recent');
  });
});

describe('groupEventsByTime', () => {
  const now = new Date('2026-05-08T18:00:00Z');

  it('agrupa preservando orden y omite buckets vacíos', () => {
    const events = [
      { occurred_at: '2026-05-08T17:50:00Z', id: 'a' },
      { occurred_at: '2026-05-08T14:00:00Z', id: 'b' },
      { occurred_at: '2026-05-08T10:00:00Z', id: 'c' },
      { occurred_at: '2026-05-07T20:00:00Z', id: 'd' },
      { occurred_at: '2026-05-04T20:00:00Z', id: 'e' },
    ];
    const groups = groupEventsByTime(events, now);
    expect(groups.map((g) => g.key)).toEqual(['recent', 'today', 'yesterday', 'older']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['a']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['b', 'c']);
    expect(groups[2]?.items.map((i) => i.id)).toEqual(['d']);
    expect(groups[3]?.items.map((i) => i.id)).toEqual(['e']);
  });

  it('lista vacía devuelve []', () => {
    expect(groupEventsByTime([], now)).toEqual([]);
  });

  it('si todo cae en un solo bucket, solo devuelve ese', () => {
    const events = [
      { occurred_at: '2026-05-08T17:50:00Z', id: 'a' },
      { occurred_at: '2026-05-08T17:30:00Z', id: 'b' },
    ];
    const groups = groupEventsByTime(events, now);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('recent');
  });
});

describe('arDayKeyFor', () => {
  it('22 AR del 7 (= 01 UTC del 8) cae en el día 7 AR', () => {
    expect(arDayKeyFor('2026-05-08T01:00:00Z')).toBe('2026-05-07');
  });

  it('mediodía UTC normal del 8 cae en el día 8 AR', () => {
    expect(arDayKeyFor('2026-05-08T15:00:00Z')).toBe('2026-05-08');
  });

  it('00:00 UTC del 9 (= 21 AR del 8) cae en el día 8 AR', () => {
    expect(arDayKeyFor('2026-05-09T00:00:00Z')).toBe('2026-05-08');
  });
});

describe('groupEventsByDay', () => {
  // Ahora referencia: viernes 2026-05-08 18:00 UTC = 15:00 AR.
  const now = new Date('2026-05-08T18:00:00Z');

  it('agrupa por día calendario AR y ordena descendente', () => {
    const events = [
      { occurred_at: '2026-05-08T14:00:00Z', id: 'a' }, // hoy AR
      { occurred_at: '2026-05-08T01:00:00Z', id: 'b' }, // ayer AR (22 AR del 7)
      { occurred_at: '2026-05-06T15:00:00Z', id: 'c' }, // anteayer AR
    ];
    const groups = groupEventsByDay(events, now);
    expect(groups).toHaveLength(3);
    expect(groups[0]?.key).toBe('2026-05-08');
    expect(groups[0]?.label).toBe('Hoy');
    expect(groups[1]?.key).toBe('2026-05-07');
    expect(groups[1]?.label).toBe('Ayer');
    expect(groups[2]?.key).toBe('2026-05-06');
    // "Miércoles 6 de mayo" — \w no matchea acentos sin flag u, por eso uso patrón explícito.
    expect(groups[2]?.label).toMatch(/^\p{L}+ \d+ de \p{L}+/u);
  });

  it('agrupa varios eventos del mismo día en una sección', () => {
    const events = [
      { occurred_at: '2026-05-08T14:00:00Z', id: 'a' },
      { occurred_at: '2026-05-08T10:00:00Z', id: 'b' },
      { occurred_at: '2026-05-08T07:00:00Z', id: 'c' },
    ];
    const groups = groupEventsByDay(events, now);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('lista vacía devuelve []', () => {
    expect(groupEventsByDay([], now)).toEqual([]);
  });

  it('label en español capitalizado', () => {
    const events = [{ occurred_at: '2026-05-04T15:00:00Z', id: 'a' }];
    const groups = groupEventsByDay(events, now);
    // 04 mayo 2026 fue lunes.
    expect(groups[0]?.label).toBe('Lunes 4 de mayo');
  });
});

describe('bucketByDayLast7', () => {
  // Ahora: viernes 2026-05-08 18:00 UTC = 15:00 AR.
  const now = new Date('2026-05-08T18:00:00Z');

  it('devuelve siempre 7 elementos', () => {
    expect(bucketByDayLast7([], now)).toHaveLength(7);
  });

  it('lista vacía devuelve [0,0,0,0,0,0,0]', () => {
    expect(bucketByDayLast7([], now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('hoy va en el índice 6', () => {
    const result = bucketByDayLast7(['2026-05-08T14:00:00Z'], now);
    expect(result[6]).toBe(1);
    expect(result[5]).toBe(0);
  });

  it('ayer va en el índice 5', () => {
    const result = bucketByDayLast7(['2026-05-07T14:00:00Z'], now);
    expect(result[5]).toBe(1);
    expect(result[6]).toBe(0);
  });

  it('hace 6 días va en el índice 0', () => {
    const result = bucketByDayLast7(['2026-05-02T14:00:00Z'], now);
    expect(result[0]).toBe(1);
  });

  it('eventos antes de la ventana se ignoran', () => {
    const result = bucketByDayLast7(['2026-05-01T14:00:00Z'], now);
    expect(result.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('cuenta múltiples eventos en el mismo día', () => {
    const result = bucketByDayLast7(
      ['2026-05-08T08:00:00Z', '2026-05-08T12:00:00Z', '2026-05-08T16:00:00Z'],
      now,
    );
    expect(result[6]).toBe(3);
  });

  it('respeta hora AR — 22 AR del 7 cae en ayer (índice 5), no en hoy', () => {
    // 2026-05-08T01:00:00Z = 22:00 AR del 7.
    const result = bucketByDayLast7(['2026-05-08T01:00:00Z'], now);
    expect(result[5]).toBe(1);
    expect(result[6]).toBe(0);
  });
});
