import { describe, expect, it } from 'vitest';
import { scheduledLetterAt } from './letter-window';

describe('scheduledLetterAt', () => {
  it('no muestra la carta del Día de la Madre antes del domingo 18 en Argentina', () => {
    // 23:59 AR del sábado 17 = 02:59 UTC del 18.
    expect(scheduledLetterAt(new Date('2026-10-18T02:59:00Z'))).toBeNull();
  });

  it('la muestra desde la medianoche del 18 en Argentina', () => {
    expect(scheduledLetterAt(new Date('2026-10-18T03:00:00Z'))).toBe('mama-2026');
    expect(scheduledLetterAt(new Date('2026-10-25T23:00:00-03:00'))).toBe('mama-2026');
  });

  it('la deja de mostrar una semana después', () => {
    expect(scheduledLetterAt(new Date('2026-10-26T00:00:00-03:00'))).toBeNull();
  });

  it('acepta otras cartas programadas', () => {
    const letters = [
      { slug: 'papa-2027', from: '2027-06-20T00:00:00-03:00', until: '2027-06-21T00:00:00-03:00' },
    ];
    expect(scheduledLetterAt(new Date('2027-06-20T12:00:00-03:00'), letters)).toBe('papa-2027');
    expect(scheduledLetterAt(new Date('2026-10-18T12:00:00-03:00'), letters)).toBeNull();
  });
});
