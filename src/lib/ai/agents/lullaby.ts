import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { AIValidationError } from '@/lib/ai/errors';
import { modelProfileFor } from '@/lib/ai/models';
import type { AgentResult } from '@/lib/ai/types';
import {
  type LullabyInput,
  type LullabyOutput,
  lullabyInputSchema,
  lullabyOutputSchema,
} from './lullaby-schema';

export { lullabyInputSchema, lullabyOutputSchema };
export type { LullabyInput, LullabyOutput };

const AGENT_NAME = 'lullaby';
const PROMPT_VERSION = 'lullaby-v2';

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'src/lib/ai/prompts/lullaby.md'), 'utf8');

/**
 * Genera una canción de cuna personalizada para Salustiano.
 *
 * Mismo pipeline que story-generator: validación Zod del input y el resto
 * (llamada, parseo tolerante, validación del output, guardrails y log sin
 * contenido) en `runStructuredAgent`.
 */
export async function generateLullaby(
  input: LullabyInput,
  context: AgentLogContext = {},
): Promise<AgentResult<LullabyOutput>> {
  const parsedInput = lullabyInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para lullaby: ${z.prettifyError(parsedInput.error)}`,
    );
  }

  const { output, meta } = await runStructuredAgent({
    agent: AGENT_NAME,
    promptVersion: PROMPT_VERSION,
    profile: modelProfileFor(AGENT_NAME),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(parsedInput.data) },
    ],
    outputSchema: lullabyOutputSchema,
    parseErrorMessage: 'No pudimos armar la canción.',
    context,
  });

  return {
    output,
    meta: {
      model: meta.model,
      tokens: meta.totalTokens,
      latencyMs: meta.latencyMs,
      promptVersion: meta.promptVersion,
    },
  };
}
