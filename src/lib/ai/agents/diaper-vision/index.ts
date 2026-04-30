import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { callLLM } from '@/lib/ai/client';
import { AIParseError } from '@/lib/ai/errors';
import { extractJsonObject, truncateForLog } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';
import type { ChatMessage, ContentPart } from '@/lib/ai/types';
import { type DiaperAnalysis, diaperAnalysisSchema } from './schema';

export { diaperAnalysisSchema, KNOWN_COLORS, KNOWN_CONSISTENCIES } from './schema';
export type { DiaperAnalysis } from './schema';

const AGENT_NAME = 'diaper-vision';
const MODEL = 'anthropic/claude-haiku-4-5';
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

interface AgentContext {
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

/**
 * Analiza una foto de pañal y devuelve un objeto estructurado con color,
 * consistencia, observaciones y señales de alerta.
 *
 * Pipeline:
 *   1. Construye el mensaje multimodal (texto + imagen).
 *   2. Llama al LLM con `responseFormat: 'json_object'`.
 *   3. Parsea + valida con Zod (AIParseError si falla).
 *   4. Loguea metadata en ai_logs (sin la imagen ni el texto).
 *
 * Si el pipeline falla, igual loguea el error y re-tira para que el caller
 * lo mapee a un error visible.
 */
export async function analyzeDiaperPhoto(
  input: DiaperVisionInput,
  context: AgentContext = {},
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
      image_url: { url: input.imageDataUrl, detail: 'high' },
    },
  ];

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts },
  ];

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages,
      temperature: 0.2,
      maxTokens: 600,
      responseFormat: 'json_object',
    });
  } catch (err) {
    await logStore.record({
      agent: AGENT_NAME,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      error: err instanceof Error ? err.message : 'unknown',
      familyGroupId: context.familyGroupId ?? null,
      childId: context.childId ?? null,
      actorUserId: context.actorUserId ?? null,
    });
    throw err;
  }

  const json = extractJsonObject(response.content ?? '');
  const parseResult = json ? diaperAnalysisSchema.safeParse(json) : null;
  if (!parseResult || !parseResult.success) {
    const reason = parseResult
      ? `schema mismatch: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      : 'no se pudo extraer JSON del content';
    const snippet = truncateForLog(response.content ?? '');
    await logStore.record({
      agent: AGENT_NAME,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      latencyMs: response.latencyMs,
      error: `parse failed (${reason}). raw: ${snippet}`,
      familyGroupId: context.familyGroupId ?? null,
      childId: context.childId ?? null,
      actorUserId: context.actorUserId ?? null,
    });
    throw new AIParseError('No pudimos interpretar la respuesta del análisis.');
  }
  const parsed = parseResult.data;

  await logStore.record({
    agent: AGENT_NAME,
    model: response.model,
    promptVersion: PROMPT_VERSION,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
    latencyMs: response.latencyMs,
    familyGroupId: context.familyGroupId ?? null,
    childId: context.childId ?? null,
    actorUserId: context.actorUserId ?? null,
  });

  return {
    analysis: parsed,
    meta: {
      model: response.model,
      promptVersion: PROMPT_VERSION,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
  };
}
