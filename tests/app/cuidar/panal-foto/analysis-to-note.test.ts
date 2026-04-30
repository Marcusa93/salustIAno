import { describe, expect, it } from 'vitest';

import { analysisToNoteText } from '@/app/(app)/cuidar/panal-foto/_components/diaper-photo-analyzer';

describe('analysisToNoteText', () => {
  const base = {
    color: 'amarillo mostaza',
    consistency: 'pastosa',
    observations: 'Cantidad regular, sin moco visible.',
    alarm: false,
    alarm_reason: '',
    recommendation: 'Probablemente normal.',
  };

  it('arma "Color, consistencia. Observaciones."', () => {
    expect(analysisToNoteText(base)).toBe(
      'Amarillo mostaza, pastosa. Cantidad regular, sin moco visible.',
    );
  });

  it('capitaliza la primera letra del color', () => {
    expect(analysisToNoteText({ ...base, color: 'verde' }).startsWith('Verde,')).toBe(true);
  });

  it('agrega la alarma entre paréntesis cuando alarm=true', () => {
    const out = analysisToNoteText({
      ...base,
      alarm: true,
      alarm_reason: 'rojo brillante visible',
    });
    expect(out).toContain('(Atención: rojo brillante visible)');
  });

  it('no agrega paréntesis si alarm=true pero alarm_reason vacío', () => {
    const out = analysisToNoteText({ ...base, alarm: true, alarm_reason: '' });
    expect(out).not.toContain('Atención');
  });

  it('soporta color vacío sin romper', () => {
    expect(() => analysisToNoteText({ ...base, color: '' })).not.toThrow();
  });
});
