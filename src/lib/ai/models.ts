/**
 * Modelo y perfil de inferencia de cada agente.
 *
 * Un solo lugar para decidir qué modelo usa cada agente, cuánto razona y
 * cuántos tokens puede gastar. Los agentes no hardcodean slugs: piden su
 * perfil con `modelProfileFor('<agente>')`.
 *
 * Criterio (octubre 2026, familia Claude 5.5 vía OpenRouter):
 *   - Haiku 5.5 para tareas cortas o muy frecuentes (etiquetar fotos,
 *     resumen del día, el chat por voz de Alexa que tiene timeout corto).
 *   - Sonnet 5.5 para lo que necesita razonar sobre datos del bebé o
 *     escribir bien (chat, coach de sueño, patrones, control pediátrico,
 *     cuentos, canciones) y para leer fotos de pañales, donde una señal de
 *     alarma mal vista importa más que el costo.
 *
 * Los modelos 5.5 razonan por defecto y ese razonamiento consume el mismo
 * `max_tokens` que la respuesta: por eso los topes son holgados (se paga
 * lo que se usa, no el tope). Sonnet 5.5 no permite apagar el
 * razonamiento; Haiku 5.5 sí ('none').
 *
 * Slugs verificados contra GET https://openrouter.ai/api/v1/models.
 *
 * Sin `import 'server-only'`: es configuración pura, se usa en tests.
 */

import type { ReasoningEffort } from './types';

export const CLAUDE_MODELS = {
  haiku: 'anthropic/claude-haiku-5.5',
  sonnet: 'anthropic/claude-sonnet-5.5',
} as const;

/** Modelos donde OpenRouter rechaza `reasoning.effort: 'none'`. */
const MANDATORY_REASONING_MODELS: ReadonlySet<string> = new Set([CLAUDE_MODELS.sonnet]);

export interface ModelProfile {
  model: string;
  effort: ReasoningEffort;
  /** Tope de salida por llamada, razonamiento incluido. */
  maxTokens: number;
}

export const AGENT_MODEL_PROFILES = {
  'photo-tagger': { model: CLAUDE_MODELS.haiku, effort: 'none', maxTokens: 800 },
  'daily-summary': { model: CLAUDE_MODELS.haiku, effort: 'low', maxTokens: 2_000 },
  'diaper-vision': { model: CLAUDE_MODELS.sonnet, effort: 'low', maxTokens: 4_000 },
  'pediatric-sleep-coach': { model: CLAUDE_MODELS.sonnet, effort: 'low', maxTokens: 4_000 },
  'pattern-finder': { model: CLAUDE_MODELS.sonnet, effort: 'medium', maxTokens: 6_000 },
  'pediatric-prep': { model: CLAUDE_MODELS.sonnet, effort: 'medium', maxTokens: 8_000 },
  'story-generator': { model: CLAUDE_MODELS.sonnet, effort: 'low', maxTokens: 8_000 },
  lullaby: { model: CLAUDE_MODELS.sonnet, effort: 'low', maxTokens: 6_000 },
  // Por iteración del loop con tools.
  salustia: { model: CLAUDE_MODELS.sonnet, effort: 'low', maxTokens: 4_000 },
  // Canales con timeout corto (Alexa corta a los ~8 s): sin razonamiento.
  'salustia-fast': { model: CLAUDE_MODELS.haiku, effort: 'none', maxTokens: 2_000 },
} as const satisfies Record<string, ModelProfile>;

export type ProfiledAgent = keyof typeof AGENT_MODEL_PROFILES;

export function modelProfileFor(agent: ProfiledAgent): ModelProfile {
  return AGENT_MODEL_PROFILES[agent];
}

/** true si el modelo acepta `reasoning.effort: 'none'`. */
export function canDisableReasoning(model: string): boolean {
  return !MANDATORY_REASONING_MODELS.has(model);
}

/**
 * Claude Opus 4.7/4.8 y toda la familia 5.x devuelven 400 ante valores no
 * default de temperature/top_p/top_k. El cliente usa esto para no
 * mandarlos aunque algún agente los pase.
 */
const NO_SAMPLING_PARAMS =
  /^anthropic\/claude-(?:(?:opus|sonnet|haiku|fable|mythos)-5|opus-4[.-][78])/;

export function acceptsTemperature(model: string): boolean {
  return !NO_SAMPLING_PARAMS.test(model);
}
