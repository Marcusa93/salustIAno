import { describe, expect, it } from 'vitest';

import { AIGuardrailError } from '@/lib/ai/errors';
import { applyGuardrails, isMedicalAgent } from '@/lib/ai/guardrails';

describe('isMedicalAgent', () => {
  it('detecta nombres médicos comunes', () => {
    expect(isMedicalAgent('medical-summary')).toBe(true);
    expect(isMedicalAgent('pediatric-prep')).toBe(true);
    expect(isMedicalAgent('agente-de-salud')).toBe(true);
    expect(isMedicalAgent('analizador-sintomas')).toBe(true);
  });

  it('descarta agentes no médicos', () => {
    expect(isMedicalAgent('story-generator')).toBe(false);
    expect(isMedicalAgent('daily-summary')).toBe(false);
    expect(isMedicalAgent('song-generator')).toBe(false);
  });
});

describe('applyGuardrails', () => {
  it('agente médico + output limpio: devuelve output sin cambios', () => {
    const output = { text: 'Salu durmió tranquilo y comió bien.' };
    const result = applyGuardrails(output, { agent: 'medical-summary' });
    expect(result).toBe(output);
  });

  it('agente médico + dosis numérica: tira AIGuardrailError', () => {
    const output = 'tomá 500 mg cada 8 horas';
    expect(() => applyGuardrails(output, { agent: 'medical-summary' })).toThrow(AIGuardrailError);
  });

  it('agente médico + prescripción de medicamento: tira AIGuardrailError', () => {
    const output = { recommendation: 'dale paracetamol si tiene fiebre' };
    expect(() => applyGuardrails(output, { agent: 'pediatric-prep' })).toThrow(AIGuardrailError);
  });

  it('agente médico + diagnóstico asertivo: tira AIGuardrailError', () => {
    const output = 'seguro tiene otitis';
    expect(() => applyGuardrails(output, { agent: 'medical-summary' })).toThrow(AIGuardrailError);
  });

  it('agente no médico + palabras médicas: pasa sin error', () => {
    const output = {
      title: 'El osito y el doctor',
      story: 'El osito tomó 5 vasos de agua y se sintió mejor.',
    };
    expect(() => applyGuardrails(output, { agent: 'story-generator' })).not.toThrow();
  });

  it('AIGuardrailError lleva el patrón pero no el output completo', () => {
    const sensitive = 'tomá 500 mg de un secreto familiar';
    try {
      applyGuardrails(sensitive, { agent: 'medical-summary' });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AIGuardrailError);
      const e = err as AIGuardrailError;
      expect(e.pattern).toBeTruthy();
      expect(e.message).not.toContain('secreto familiar');
    }
  });
});
