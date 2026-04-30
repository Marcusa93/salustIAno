import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { callLLM } from '@/lib/ai/client';
import { AIParseError, AIValidationError } from '@/lib/ai/errors';
import { extractJsonObject, truncateForLog } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';
import {
  type PediatricInput,
  type PediatricSummary,
  pediatricInputSchema,
  pediatricSummarySchema,
} from './schema';

export { pediatricInputSchema, pediatricSummarySchema };
export type { PediatricInput, PediatricSummary };

const AGENT_NAME = 'pediatric-prep';
const MODEL = 'anthropic/claude-haiku-4-5';
const PROMPT_VERSION = 'pediatric-prep-v1';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/pediatric-prep/prompt.md'),
  'utf8',
);

interface AgentContext {
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

export interface PediatricPrepOutput {
  summary: PediatricSummary;
  meta: {
    model: string;
    promptVersion: string;
    totalTokens: number;
    latencyMs: number;
  };
}

/**
 * Genera un borrador para el control con la pediatra a partir de un
 * snapshot estructurado del último período.
 *
 * El caller arma el `PediatricInput` (queries a Supabase, agregaciones)
 * y se lo pasa al agente. Acá:
 *   1. Validamos input con Zod (AIValidationError si falla).
 *   2. Llamamos al LLM con response_format=json_object.
 *   3. Parseamos tolerantemente (markdown fences, preludios).
 *   4. Validamos output con Zod (AIParseError + log con snippet si falla).
 *   5. Persistimos metadata en ai_logs (sin contenido del bebé).
 */
export async function generatePediatricPrep(
  input: PediatricInput,
  context: AgentContext = {},
): Promise<PediatricPrepOutput> {
  const parsedInput = pediatricInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para pediatric-prep: ${parsedInput.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  const userPayload = JSON.stringify(parsedInput.data);

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.3,
      maxTokens: 1500,
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
  const parseResult = json ? pediatricSummarySchema.safeParse(json) : null;
  if (!parseResult || !parseResult.success) {
    const reason = parseResult
      ? `schema mismatch: ${parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`
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
    throw new AIParseError('No pudimos armar el resumen.');
  }

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
    summary: parseResult.data,
    meta: {
      model: response.model,
      promptVersion: PROMPT_VERSION,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
  };
}
