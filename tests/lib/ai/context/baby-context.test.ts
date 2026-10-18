import { describe, expect, it } from 'vitest';

import {
  type TimelineRow,
  describeAge,
  describeAgeFromBirth,
  describeCorrectedAge,
  summarizeRecentCare,
} from '@/lib/ai/context/baby-context';

describe('describeAge', () => {
  it('null o no finito devuelve null', () => {
    expect(describeAge(null)).toBeNull();
    expect(describeAge(Number.NaN)).toBeNull();
  });

  it('antes de nacer', () => {
    expect(describeAge(-1)).toBe('todavía no nació (faltan 1 día)');
    expect(describeAge(-10)).toBe('todavía no nació (faltan 10 días)');
  });

  it('primeras dos semanas en días', () => {
    expect(describeAge(0)).toBe('recién nacido (0 días)');
    expect(describeAge(1)).toBe('1 día');
    expect(describeAge(13)).toBe('13 días');
  });

  it('hasta las 8 semanas en semanas y días', () => {
    expect(describeAge(14)).toBe('2 semanas (14 días)');
    expect(describeAge(40)).toBe('5 semanas y 5 días (40 días)');
    expect(describeAge(43)).toBe('6 semanas y 1 día (43 días)');
  });

  it('hasta los 2 años en meses y días, con el total exacto', () => {
    expect(describeAge(61)).toBe('2 meses y 1 día (61 días)');
    expect(describeAge(154)).toBe('5 meses y 2 días (154 días)');
    expect(describeAge(365)).toBe('12 meses (365 días)');
    expect(describeAge(729)).toBe('23 meses y 29 días (729 días)');
  });

  it('después de los 2 años en años y meses', () => {
    expect(describeAge(800)).toBe('2 años y 2 meses (800 días)');
    expect(describeAge(731)).toBe('2 años (731 días)');
  });
});

describe('describeAgeFromBirth', () => {
  // 16/10/2026 18:00 en Argentina.
  const now = new Date('2026-10-16T21:00:00Z');

  it('cuenta meses de calendario: nació un 4, cumple mes cada 4', () => {
    expect(describeAgeFromBirth('2026-05-04', now)).toBe('5 meses y 12 días (165 días)');
    expect(describeAgeFromBirth('2026-05-16', now)).toBe('5 meses (153 días)');
  });

  it('usa la fecha de Argentina aunque en UTC ya sea el día siguiente', () => {
    // 16/10 22:30 AR = 17/10 01:30 UTC.
    const lateNight = new Date('2026-10-17T01:30:00Z');
    expect(describeAgeFromBirth('2026-05-04', lateNight)).toBe('5 meses y 12 días (165 días)');
  });

  it('si nació un 31, el cumplemes de un mes corto es el último día', () => {
    expect(describeAgeFromBirth('2025-12-31', new Date('2026-03-01T15:00:00Z'))).toBe(
      '2 meses y 1 día (60 días)',
    );
  });

  it('menos de 8 semanas o más de 2 años: mismo formato que describeAge', () => {
    expect(describeAgeFromBirth('2026-10-01', now)).toBe(describeAge(15));
    expect(describeAgeFromBirth('2024-08-16', now)).toBe(describeAge(791));
  });

  it('sin fecha o con fecha inválida devuelve null', () => {
    expect(describeAgeFromBirth(null, now)).toBeNull();
    expect(describeAgeFromBirth('no-es-fecha', now)).toBeNull();
    expect(describeAgeFromBirth('2026-05-04', new Date('invalid'))).toBeNull();
  });
});

describe('describeCorrectedAge', () => {
  it('no aplica a bebés de término o sin datos', () => {
    expect(describeCorrectedAge(100, null)).toBeNull();
    expect(describeCorrectedAge(100, 38)).toBeNull();
    expect(describeCorrectedAge(null, 32)).toBeNull();
  });

  it('resta las semanas que faltaban hasta las 40', () => {
    // 34 semanas → 6 semanas (42 días) de corrección.
    expect(describeCorrectedAge(154, 34)).toBe(describeAge(112));
  });
});

// 16/10/2026 18:00 en Argentina (UTC-3).
const NOW = new Date('2026-10-16T21:00:00Z');
const at = (hhmm: string, day = '2026-10-16') => new Date(`${day}T${hhmm}:00-03:00`).toISOString();

function row(
  event_type: string,
  occurred_at: string,
  payload: Record<string, unknown>,
): TimelineRow {
  return { event_type, occurred_at, payload };
}

describe('summarizeRecentCare', () => {
  it('sin eventos lo dice explícitamente', () => {
    expect(summarizeRecentCare([], NOW)).toEqual([
      '- Sin tomas, sueños ni pañales cargados en las últimas 24 h.',
    ]);
  });

  it('bebé durmiendo una siesta: estado, última toma, último pañal y totales', () => {
    const rows = [
      row('diaper', at('16:30'), { type: 'both', notes: 'nota privada' }),
      row('sleep', at('17:15'), { started_at: at('17:15'), ended_at: null, is_nap: true }),
      row('feeding', at('16:50'), { type: 'bottle', amount_ml: 120 }),
      row('feeding', at('13:10'), { type: 'bottle', amount_ml: 90 }),
      row('sleep', at('14:00'), { started_at: at('14:00'), ended_at: at('15:30'), is_nap: true }),
      // Ayer: no suma a los totales de hoy.
      row('feeding', at('22:00', '2026-10-15'), { type: 'breastfeeding', side: 'left' }),
    ];

    expect(summarizeRecentCare(rows, NOW)).toEqual([
      '- Ahora: durmiendo desde hace 45 min (siesta, desde las 17:15).',
      '- Última toma: hace 1 h 10 min (16:50), mamadera 120 ml.',
      '- Último pañal: hace 1 h 30 min (16:30), pis y caca.',
      '- Hoy desde las 00:00: 2 tomas (210 ml de mamadera), 2 sueños (2 h 15 min), 1 pañal.',
    ]);
  });

  it('bebé despierto: usa el fin del último sueño cerrado', () => {
    const rows = [
      row('sleep', at('15:00'), { started_at: at('15:00'), ended_at: at('16:20'), is_nap: true }),
      row('feeding', at('16:30'), {
        type: 'breastfeeding',
        side: 'right',
        duration_minutes: 15,
      }),
    ];

    const lines = summarizeRecentCare(rows, NOW);
    expect(lines[0]).toBe('- Ahora: despierto; se despertó hace 1 h 40 min (a las 16:20).');
    expect(lines[1]).toBe('- Última toma: hace 1 h 30 min (16:30), pecho derecho 15 min.');
    expect(lines).toHaveLength(3);
  });

  it('un sueño abierto hace más de 12 h se marca como probable olvido y no infla el total', () => {
    const rows = [
      row('sleep', at('02:00'), { started_at: at('02:00'), ended_at: null, is_nap: false }),
    ];

    const lines = summarizeRecentCare(rows, NOW);
    expect(lines[0]).toContain('probablemente falta cargar el despertar');
    expect(lines.at(-1)).toBe('- Hoy desde las 00:00: 0 tomas, 1 sueño, 0 pañales.');
  });

  it('no incluye notas libres de los eventos', () => {
    const rows = [row('diaper', at('17:00'), { type: 'wet', notes: 'texto que no va al prompt' })];
    expect(summarizeRecentCare(rows, NOW).join('\n')).not.toContain('texto que no va');
  });

  it('tolera payloads incompletos', () => {
    const rows = [row('feeding', at('17:30'), {}), row('diaper', at('17:40'), { type: 42 })];
    const lines = summarizeRecentCare(rows, NOW);
    expect(lines).toContain('- Última toma: hace 30 min (17:30), toma.');
    expect(lines).toContain('- Último pañal: hace 20 min (17:40), pañal.');
  });
});
