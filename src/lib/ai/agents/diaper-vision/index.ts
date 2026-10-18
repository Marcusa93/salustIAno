import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { modelProfileFor } from '@/lib/ai/models';
import type { ChatMessage, ContentPart } from '@/lib/ai/types';
import { type DiaperAnalysis, diaperAnalysisSchema } from './schema';

export { diaperAnalysisSchema, KNOWN_COLORS, KNOWN_CONSISTENCIES } from './schema';
export type { DiaperAnalysis } from './schema';

const AGENT_NAME = 'diaper-vision';
const PROMPT_VERSION = 'diaper-vision-v2';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/diaper-vision/prompt.md'),
  'utf8',
);

export interface DiaperVisionInput {
  /**
   * Imagen a analizar. Aceptamos data URL (`data:image/jpeg;base64,…`) o
   * URL pública. El caller elige según si persistió la foto o la procesa
   * solo en memoria.
   */
  imageDataUrl: string;
  /**
   * Texto opcional que la familia agrega para dar contexto: "es la
   * primera caca después de empezar con avena", "tiene 3 días de vida",
   * etc. Se pasa tal cual al modelo.
   */
  contextNotes?: string;
}

export interface DiaperVisionOutput {
  analysis: DiaperAnalysis;
  meta: {
    model: string;
    promptVersion: string;
    totalTokens: number;
    latencyMs: number;
  };
}

/**
 * Analiza una foto de pañal y devuelve un objeto estructurado con color,
 * consistencia, observaciones y señales de alerta.
 *
 * Pipeline:
 *   1. Construye el mensaje multimodal (texto + imagen).
 *   2. Llama al LLM con `responseFormat: 'json_object'`.
 *   3. Parsea + valida con Zod (AIParseError si falla) y aplica guardrails.
 *   4. Loguea metadata en ai_logs (sin la imagen ni el texto).
 *
 * Si el pipeline falla, igual loguea el error y re-tira para que el caller
 * lo mapee a un error visible.
 */
export async function analyzeDiaperPhoto(
  input: DiaperVisionInput,
  context: AgentLogContext = {},
): Promise<DiaperVisionOutput> {
  const userParts: ContentPart[] = [
    {
      type: 'text',
      text: input.contextNotes
        ? `Contexto que da la familia: ${input.contextNotes.slice(0, 500)}\n\nAnalizá esta foto.`
        : 'Analizá esta foto.',
    },
    {
      type: 'image_url',
      // No necesitamos detalle máximo para estimar color/consistencia y
      // así bajamos latencia + tokens en cada análisis.
      image_url: { url: input.imageDataUrl, detail: 'low' },
    },
  ];

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts },
  ];

  const { output, meta } = await runStructuredAgent({
    agent: AGENT_NAME,
    promptVersion: PROMPT_VERSION,
    profile: modelProfileFor(AGENT_NAME),
    messages,
    outputSchema: diaperAnalysisSchema,
    parseErrorMessage: 'No pudimos interpretar la respuesta del análisis.',
    context,
  });

  return { analysis: output, meta };
}
