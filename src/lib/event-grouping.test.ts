import { describe, expect, it } from 'vitest';
import { classifyEvent, groupEventsByTime } from './event-grouping';

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
