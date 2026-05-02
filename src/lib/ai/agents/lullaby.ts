import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { callLLM } from '../client';
import { AIParseError, AIValidationError } from '../errors';
import { applyGuardrails } from '../guardrails';
import { extractJsonObject, truncateForLog } from '../json';
import { logStore } from '../logger';
import type { AgentContext, AgentResult } from '../types';
import {
  type LullabyInput,
  type LullabyOutput,
  lullabyInputSchema,
  lullabyOutputSchema,
} from './lullaby-schema';

export { lullabyInputSchema, lullabyOutputSchema };
export type { LullabyInput, LullabyOutput };

const AGENT_NAME = 'lullaby';
const MODEL = 'anthropic/claude-opus-4-7';
const PROMPT_VERSION = 'lullaby-v2';

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'src/lib/ai/prompts/lullaby.md'), 'utf8');

/**
 * Genera una canción de cuna personalizada para Salustiano.
 *
 * Mismo pipeline que story-generator: validación zod del input, llamada
 * al LLM, parseo tolerante (markdown fences, preludios), validación
 * zod del output, guardrails y logging metadata-only.
 */
export async function generateLullaby(
  input: LullabyInput,
  context: Partial<Omit<AgentContext, 'agent'>> = {},
): Promise<AgentResult<LullabyOutput>> {
  const parsedInput = lullabyInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para lullaby: ${z.prettifyError(parsedInput.error)}`,
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
      temperature: 0.85,
      maxTokens: 1500,
      responseFormat: 'json_object',
    });

    const json = extractJsonObject(response.content ?? '');
    const parseResult = json ? lullabyOutputSchema.safeParse(json) : null;
    if (!parseResult || !parseResult.success) {
      const reason = parseResult
        ? `schema mismatch: ${z.prettifyError(parseResult.error)}`
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
        familyGroupId: ctx.familyGroupId ?? null,
        childId: ctx.childId ?? null,
        actorUserId: ctx.actorUserId ?? null,
      });
      throw new AIParseError('No pudimos armar la canción.');
    }

    const safeOutput = applyGuardrails(parseResult.data, ctx);

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
    if (err instanceof AIValidationError) throw err;

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
