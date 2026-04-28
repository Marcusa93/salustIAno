import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { callLLM } from '../client';
import { AIParseError, AIValidationError } from '../errors';
import { applyGuardrails } from '../guardrails';
import { logStore } from '../logger';
import type { AgentContext, AgentResult } from '../types';
import {
  type StoryInput,
  type StoryOutput,
  storyInputSchema,
  storyOutputSchema,
} from './story-schema';

export { storyInputSchema, storyOutputSchema };
export type { StoryInput, StoryOutput };

const AGENT_NAME = 'story-generator';
const MODEL = 'anthropic/claude-opus-4-7';
const PROMPT_VERSION = 'story-v1';

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'src/lib/ai/prompts/story.md'), 'utf8');

/**
 * Genera un cuento personalizado para Salustiano.
 *
 * Pipeline:
 *   1. Validar input con Zod (AIValidationError si falla).
 *   2. Llamar al LLM con el system prompt versionado.
 *   3. Parsear el JSON de respuesta (AIParseError si falla).
 *   4. Validar la forma del output con Zod (AIParseError si falla).
 *   5. Aplicar guardrails (AIGuardrailError si match).
 *   6. Persistir metadata en ai_logs (sin contenido).
 *   7. Devolver el AgentResult.
 *
 * Si el pipeline falla por un motivo distinto a validation/guardrail
 * (network/provider/parse), igual se loguea el error y se re-tira.
 */
export async function generateStory(
  input: StoryInput,
  context: Partial<Omit<AgentContext, 'agent'>> = {},
): Promise<AgentResult<StoryOutput>> {
  const parsedInput = storyInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para story-generator: ${z.prettifyError(parsedInput.error)}`,
    );
  }

  const ctx: AgentContext = { agent: AGENT_NAME, ...context };

  const userPayload = JSON.stringify(parsedInput.data);

  try {
    const response = await callLLM({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.8,
      maxTokens: 2000,
      responseFormat: 'json_object',
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(response.content);
    } catch (err) {
      throw new AIParseError(
        `El LLM no devolvió JSON parseable: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    const parsedOutput = storyOutputSchema.safeParse(parsedJson);
    if (!parsedOutput.success) {
      throw new AIParseError(
        `Output del LLM no cumple el schema: ${z.prettifyError(parsedOutput.error)}`,
      );
    }

    const safeOutput = applyGuardrails(parsedOutput.data, ctx);

    await logStore.record({
      agent: AGENT_NAME,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      latencyMs: response.latencyMs,
      familyGroupId: ctx.familyGroupId ?? null,
      childId: ctx.childId ?? null,
      actorUserId: ctx.actorUserId ?? null,
    });

    return {
      output: safeOutput,
      meta: {
        model: response.model,
        tokens: response.usage.totalTokens,
        latencyMs: response.latencyMs,
        promptVersion: PROMPT_VERSION,
      },
    };
  } catch (err) {
    // Validation y guardrail no se loguean acá: el primero ocurre antes
    // del LLM (no hay nada útil que registrar) y el segundo lo dejamos
    // pasar por la cadena para que el caller lo distinga.
    if (err instanceof AIValidationError) {
      throw err;
    }

    await logStore.record({
      agent: AGENT_NAME,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      error: err instanceof Error ? err.message : 'unknown error',
      familyGroupId: ctx.familyGroupId ?? null,
      childId: ctx.childId ?? null,
      actorUserId: ctx.actorUserId ?? null,
    });
    throw err;
  }
}
