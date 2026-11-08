import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { callLLM } from '@/lib/ai/client';
import { AIParseError, AIValidationError } from '@/lib/ai/errors';
import { applyGuardrails } from '@/lib/ai/guardrails';
import { extractJsonObject, truncateForLog } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';
import type { AgentResult } from '@/lib/ai/types';
import {
  type SolidsMenuInput,
  type SolidsMenuOutput,
  solidsMenuInputSchema,
  solidsMenuOutputSchema,
} from './schema';

export { solidsMenuInputSchema, solidsMenuOutputSchema };
export type { SolidsMenuInput, SolidsMenuOutput };

/** Nombre con el que se loguea en `ai_logs` (también lo usa el límite de uso). */
export const SOLIDS_MENU_AGENT = 'solids-menu';
const MODEL = 'anthropic/claude-haiku-4-5';
const PROMPT_VERSION = 'solids-menu-v1';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/solids-menu/prompt.md'),
  'utf8',
);

interface AgentContextInput {
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

/**
 * Arma un menú de 7 días para la alimentación complementaria, con lista de
 * compras y consejos.
 *
 * El output sale de acá validado contra el schema pero SIN limpiar: el caller
 * lo tiene que pasar por `validateMenu` (src/lib/solids/menu.ts), que es
 * quien hace cumplir las reglas de seguridad (alérgenos, edad, reacciones) y
 * recalcula las etiquetas con el catálogo.
 *
 * No persiste nada: la familia guarda el último menú en el celu.
 */
export async function generateSolidsMenu(
  input: SolidsMenuInput,
  context: AgentContextInput = {},
): Promise<AgentResult<SolidsMenuOutput>> {
  const parsedInput = solidsMenuInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AIValidationError(
      `Input inválido para ${SOLIDS_MENU_AGENT}: ${parsedInput.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  const logContext = {
    familyGroupId: context.familyGroupId ?? null,
    childId: context.childId ?? null,
    actorUserId: context.actorUserId ?? null,
  };

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(parsedInput.data) },
      ],
      temperature: 0.5,
      maxTokens: 4000,
      responseFormat: 'json_object',
    });
  } catch (err) {
    await logStore.record({
      agent: SOLIDS_MENU_AGENT,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      error: err instanceof Error ? err.message : 'unknown',
      ...logContext,
    });
    throw err;
  }

  const json = extractJsonObject(response.content ?? '');
  const parseResult = json ? solidsMenuOutputSchema.safeParse(json) : null;
  if (!parseResult || !parseResult.success) {
    const reason = parseResult
      ? `schema mismatch: ${parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`
      : `no se pudo extraer JSON (finish: ${response.finishReason ?? '?'})`;
    await logStore.record({
      agent: SOLIDS_MENU_AGENT,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      latencyMs: response.latencyMs,
      error: `parse failed (${reason}). raw: ${truncateForLog(response.content ?? '')}`,
      ...logContext,
    });
    throw new AIParseError('No pudimos armar el menú.');
  }

  // Guardrails transversales (hoy no es agente médico: solo aplica los
  // patrones generales). Igual pasa por acá para heredar reglas futuras.
  const safeOutput = applyGuardrails(parseResult.data, {
    agent: SOLIDS_MENU_AGENT,
    ...(context.familyGroupId ? { familyGroupId: context.familyGroupId } : {}),
    ...(context.childId ? { childId: context.childId } : {}),
    ...(context.actorUserId ? { actorUserId: context.actorUserId } : {}),
  });

  await logStore.record({
    agent: SOLIDS_MENU_AGENT,
    model: response.model,
    promptVersion: PROMPT_VERSION,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
    latencyMs: response.latencyMs,
    ...logContext,
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
}
