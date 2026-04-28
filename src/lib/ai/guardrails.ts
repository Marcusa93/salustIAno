import 'server-only';

import { AIGuardrailError } from './errors';
import type { AgentContext } from './types';

/**
 * Patrones que rechazamos en agentes que tocan temas médicos.
 *
 * Detectan dosis numéricas, prescripción de medicación específica,
 * diagnósticos asertivos. Lista incremental: cuando aparezca un caso real
 * que pase por acá sin ser detectado, se suma un patrón.
 */
const DANGEROUS_PATTERNS_MEDICAL: RegExp[] = [
  /tom[áa]\s+\d+\s*(mg|miligramos|ml|mililitros)/i,
  /(dale|dele|d[aá])\s+(paracetamol|ibuprofeno|amoxicilina|aspirina)/i,
  /(diagn[oó]stico|diagn[oó]sticar)\s+(es|de|como):/i,
  /(seguro|definitivamente|sin duda)\s+(tiene|es)\s+(\w+itis|enfermedad)/i,
];

/**
 * Patrones generales aplicados a TODOS los agentes. Vacío por ahora —
 * slot abierto para reglas transversales (ej. detección de PII, lenguaje
 * inapropiado para contexto familiar, etc.).
 */
const DANGEROUS_PATTERNS_GENERAL: RegExp[] = [];

const MEDICAL_AGENT_REGEX = /medical|pediatric|salud|sintoma/i;

/**
 * Devuelve true si el agente es de dominio médico y debe pasar por los
 * patterns reforzados. La detección es por substring del nombre — en el MVP
 * los nombres siguen una convención.
 */
export function isMedicalAgent(agentName: string): boolean {
  return MEDICAL_AGENT_REGEX.test(agentName);
}

/**
 * Aplica guardrails determinísticos al output de un agente.
 *
 * Si el output es string, se evalúa directo; si es objeto, se stringifica
 * con JSON.stringify para detectar patrones en cualquier campo.
 *
 * - Agentes médicos (matchean MEDICAL_AGENT_REGEX): aplican
 *   DANGEROUS_PATTERNS_MEDICAL + DANGEROUS_PATTERNS_GENERAL.
 * - Agentes no médicos: solo DANGEROUS_PATTERNS_GENERAL.
 *
 * @throws {AIGuardrailError} si match. NUNCA se modifica el output ni se
 *   incluye su contenido en la excepción — sólo el patrón que disparó.
 */
export function applyGuardrails<T>(output: T, ctx: AgentContext): T {
  const haystack = typeof output === 'string' ? output : JSON.stringify(output);

  const patterns: RegExp[] = isMedicalAgent(ctx.agent)
    ? [...DANGEROUS_PATTERNS_MEDICAL, ...DANGEROUS_PATTERNS_GENERAL]
    : [...DANGEROUS_PATTERNS_GENERAL];

  for (const pattern of patterns) {
    if (pattern.test(haystack)) {
      throw new AIGuardrailError(pattern.source);
    }
  }

  return output;
}
