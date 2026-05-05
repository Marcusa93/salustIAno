import { describe, expect, it } from 'vitest';

import { detectMedicalIntent } from '@/lib/ai/agents/salustia/medical-intent';

describe('detectMedicalIntent', () => {
  it('deja pasar mensajes neutrales de uso normal', () => {
    expect(detectMedicalIntent('¿Cómo va el día?').matched).toBe(false);
    expect(detectMedicalIntent('Anotá una toma de pecho hace una hora').matched).toBe(false);
    expect(detectMedicalIntent('Mostrame las últimas tomas').matched).toBe(false);
    expect(detectMedicalIntent('Le di 60ml de mamadera').matched).toBe(false);
  });

  it('rebota síntomas con o sin tildes', () => {
    expect(detectMedicalIntent('tiene fiebre').matched).toBe(true);
    expect(detectMedicalIntent('FIEBRE alta').matched).toBe(true);
    expect(detectMedicalIntent('vomitó dos veces').matched).toBe(true);
    expect(detectMedicalIntent('tiene diarrea').matched).toBe(true);
    expect(detectMedicalIntent('vi sangre en el pañal').matched).toBe(true);
    expect(detectMedicalIntent('le agarró una convulsión').matched).toBe(true);
  });

  it('rebota dosis y medicación', () => {
    expect(detectMedicalIntent('cuánto le doy de paracetamol').matched).toBe(true);
    expect(detectMedicalIntent('le doy 5 ml de jarabe').matched).toBe(true);
    expect(detectMedicalIntent('necesita un antibiótico?').matched).toBe(true);
    expect(detectMedicalIntent('ibuprofeno para la fiebre').matched).toBe(true);
  });

  it('rebota pedidos de juicio clínico', () => {
    expect(detectMedicalIntent('¿es grave?').matched).toBe(true);
    expect(detectMedicalIntent('debería llamar al pediatra').matched).toBe(true);
    expect(detectMedicalIntent('qué hago si no para de llorar').matched).toBe(true);
  });

  it('rebota palabras de urgencia', () => {
    expect(detectMedicalIntent('vamos a la guardia?').matched).toBe(true);
    expect(detectMedicalIntent('es una emergencia').matched).toBe(true);
    expect(detectMedicalIntent('llamá al 107').matched).toBe(true);
  });

  it('cuando rebota incluye el patrón que matcheó (auditoría)', () => {
    const result = detectMedicalIntent('tiene fiebre');
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.pattern).toContain('fiebre');
      expect(result.reply).toMatch(/pediatra|guardia|107/i);
    }
  });

  it('soporta inputs vacíos o no-string sin romper', () => {
    expect(detectMedicalIntent('').matched).toBe(false);
    expect(detectMedicalIntent('   ').matched).toBe(false);
    expect(detectMedicalIntent(null as unknown as string).matched).toBe(false);
  });
});
