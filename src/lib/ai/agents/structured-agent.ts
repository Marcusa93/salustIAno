import 'server-only';

import type { z } from 'zod';

import { callLLM } from '@/lib/ai/client';
import { AIParseError } from '@/lib/ai/errors';
import { applyGuardrails } from '@/lib/ai/guardrails';
import { extractJsonObject } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';
import type { ModelProfile } from '@/lib/ai/models';
import type { ChatMessage, ChatResponse } from '@/lib/ai/types';

/** Ids que acompañan cada log. Nunca contenido. */
export interface AgentLogContext {
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

export interface StructuredAgentCall<T> {
  /** Nombre del agente: va a `ai_logs.agent` y decide qué guardrails aplican. */
  agent: string;
  promptVersion: string;
  profile: ModelProfile;
  messages: ChatMessage[];
  outputSchema: z.ZodType<T>;
  /** Mensaje para la familia si el modelo no devuelve un JSON válido. */
  parseErrorMessage: string;
  context?: AgentLogContext;
}

export interface StructuredAgentResult<T> {
  output: T;
  meta: {
    model: string;
    promptVersion: string;
    totalTokens: number;
    latencyMs: number;
  };
}

/**
 * Describe por qué falló el parseo sin incluir nada de lo que escribió el
 * modelo: solo rutas y códigos de Zod, cómo terminó la respuesta y su
 * largo. `finish=length` con pocos caracteres indica que el razonamiento
 * se comió el `max_tokens`.
 */
export function describeParseFailure(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; code: string }> | null,
  response: Pick<ChatResponse, 'content' | 'finishReason'>,
): string {
  const reason = issues
    ? `schema mismatch: ${issues.map((i) => `${i.path.map(String).join('.') || '(raíz)'}: ${i.code}`).join('; ')}`
    : 'no se pudo extraer JSON';
  return `parse failed (${reason}) [finish=${response.finishReason ?? 'unknown'}, chars=${response.content.length}]`;
}

/**
 * Pipeline común de los agentes que devuelven un objeto JSON:
 *
 *   1. Llama al modelo con el perfil del agente (modelo, esfuerzo, tope).
 *   2. Extrae el JSON tolerando fences o preludios.
 *   3. Lo valida con Zod: si no parsea, tira AIParseError.
 *   4. Aplica guardrails, siempre.
 *   5. Registra metadata en ai_logs (agente, modelo, tokens, latencia,
 *      error). Nunca prompts ni outputs.
 *
 * Cada falla se loguea una sola vez y se re-tira para que el caller la
 * mapee por `AIError.type`.
 */
export async function runStructuredAgent<T>(
  call: StructuredAgentCall<T>,
): Promise<StructuredAgentResult<T>> {
  const { agent, promptVersion, profile, context = {} } = call;
  const logBase = {
    agent,
    promptVersion,
    familyGroupId: context.familyGroupId ?? null,
    childId: context.childId ?? null,
    actorUserId: context.actorUserId ?? null,
  };

  let response: ChatResponse;
  try {
    response = await callLLM({
      model: profile.model,
      messages: call.messages,
      maxTokens: profile.maxTokens,
      reasoning: { effort: profile.effort, exclude: true },
      responseFormat: 'json_object',
    });
  } catch (err) {
    await logStore.record({
      ...logBase,
      model: profile.model,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }

  const usage = {
    model: response.model,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
    latencyMs: response.latencyMs,
  };

  const json = extractJsonObject(response.content);
  const parsed = json === null ? null : call.outputSchema.safeParse(json);
  if (!parsed?.success) {
    await logStore.record({
      ...logBase,
      ...usage,
      error: describeParseFailure(parsed ? parsed.error.issues : null, response),
    });
    throw new AIParseError(call.parseErrorMessage);
  }

  let output: T;
  try {
    output = applyGuardrails(parsed.data, { agent, ...context });
  } catch (err) {
    await logStore.record({
      ...logBase,
      ...usage,
      error: err instanceof Error ? err.message : 'guardrail',
    });
    throw err;
  }

  await logStore.record({ ...logBase, ...usage });

  return {
    output,
    meta: {
      model: response.model,
      promptVersion,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
  };
}
