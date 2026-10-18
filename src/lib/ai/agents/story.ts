import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { AIValidationError } from '@/lib/ai/errors';
import { modelProfileFor } from '@/lib/ai/models';
import type { AgentResult } from '@/lib/ai/types';
import {
  type StoryInput,
  type StoryOutput,
  storyInputSchema,
  storyOutputSchema,
} from './story-schema';

export { storyInputSchema, storyOutputSchema };
export type { StoryInput, StoryOutput };

const AGENT_NAME = 'story-generator';
const PROMPT_VERSION = 'story-v1';

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'src/lib/ai/prompts/story.md'), 'utf8');

/**
 * Genera un cuento personalizado para Salustiano.
 *
 * Valida el input con Zod (AIValidationError si falla, sin llamar al
 * modelo ni loguear) y delega el resto en `runStructuredAgent`: llamada,
 * parseo tolerante, validación del output, guardrails y log sin contenido.
 */
export async function generateStory(
  input: StoryInput,
  context: AgentLogContext = {},
): Promise<AgentResult<StoryOutput>> {
  const parsedInput = storyInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para story-generator: ${z.prettifyError(parsedInput.error)}`,
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
    outputSchema: storyOutputSchema,
    parseErrorMessage: 'No pudimos armar el cuento.',
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
