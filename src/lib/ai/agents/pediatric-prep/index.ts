import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { describeAgeFromBirth } from '@/lib/ai/context/baby-context';
import { AIValidationError } from '@/lib/ai/errors';
import { modelProfileFor } from '@/lib/ai/models';
import {
  type PediatricInput,
  type PediatricSummary,
  pediatricInputSchema,
  pediatricSummarySchema,
} from './schema';

export { pediatricInputSchema, pediatricSummarySchema };
export type { PediatricInput, PediatricSummary };

const AGENT_NAME = 'pediatric-prep';
// v2: `child.age_label` con la edad exacta al cierre del período.
const PROMPT_VERSION = 'pediatric-prep-v2';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/pediatric-prep/prompt.md'),
  'utf8',
);

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
 *   4. Validamos output con Zod (AIParseError si falla) y aplicamos los
 *      guardrails médicos.
 *   5. Persistimos metadata en ai_logs (sin contenido del bebé).
 */
export async function generatePediatricPrep(
  input: PediatricInput,
  context: AgentLogContext = {},
): Promise<PediatricPrepOutput> {
  const parsedInput = pediatricInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para pediatric-prep: ${parsedInput.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  const { child, period } = parsedInput.data;
  const userPayload = JSON.stringify({
    ...parsedInput.data,
    child: { ...child, age_label: describeAgeFromBirth(child.birth_date, new Date(period.toIso)) },
  });

  const { output, meta } = await runStructuredAgent({
    agent: AGENT_NAME,
    promptVersion: PROMPT_VERSION,
    profile: modelProfileFor(AGENT_NAME),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ],
    outputSchema: pediatricSummarySchema,
    parseErrorMessage: 'No pudimos armar el resumen.',
    context,
  });

  return { summary: output, meta };
}
