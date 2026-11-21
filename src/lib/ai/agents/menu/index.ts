import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { callLLM } from '@/lib/ai/client';
import { AIParseError, AIValidationError } from '@/lib/ai/errors';
import { extractJsonObject } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';
import { type MenuInput, type MenuOutput, menuInputSchema, menuOutputSchema } from './schema';

export { menuInputSchema, menuOutputSchema };
export type { MenuInput, MenuOutput };
export type { RecetaSugerida, IngredienteNoApto } from './schema';

const AGENT_NAME = 'menu-advisor';
const MODEL = 'anthropic/claude-haiku-4-5';
const PROMPT_VERSION = 'menu-advisor-v1';

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'src/lib/ai/agents/menu/prompt.md'), 'utf8');

interface AgentContext {
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

export interface MenuAdvisorOutput {
  result: MenuOutput;
  meta: {
    model: string;
    promptVersion: string;
    totalTokens: number;
    latencyMs: number;
  };
}

export async function generateMenuSuggestions(
  input: MenuInput,
  context: AgentContext = {},
): Promise<MenuAdvisorOutput> {
  const parsedInput = menuInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para menu-advisor: ${parsedInput.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  const { edadMeses, edadDias, nombreBebe, ingredientes } = parsedInput.data;

  const userPayload = JSON.stringify({
    bebe: { nombre: nombreBebe, edadMeses, edadDias },
    ingredientesDisponibles: ingredientes,
  });

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.4,
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
  const parseResult = json ? menuOutputSchema.safeParse(json) : null;

  if (!parseResult?.success) {
    const reason = parseResult
      ? parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      : 'no se pudo extraer JSON del content';
    await logStore.record({
      agent: AGENT_NAME,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      latencyMs: response.latencyMs,
      error: `parse failed: ${reason}`,
      familyGroupId: context.familyGroupId ?? null,
      childId: context.childId ?? null,
      actorUserId: context.actorUserId ?? null,
    });
    throw new AIParseError('No pudimos armar las sugerencias. Intentá de nuevo.');
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
    result: parseResult.data,
    meta: {
      model: response.model,
      promptVersion: PROMPT_VERSION,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
  };
}
