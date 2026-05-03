import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { callLLM } from '@/lib/ai/client';
import { AIParseError } from '@/lib/ai/errors';
import { extractJsonObject, truncateForLog } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';

const AGENT_NAME = 'daily-summary';
const MODEL = 'anthropic/claude-haiku-4-5';
const PROMPT_VERSION = 'daily-summary-v1';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/daily-summary/prompt.md'),
  'utf8',
);

export const dailySummarySchema = z.object({
  summary: z.string().min(1).max(400),
  highlight: z.string().max(60).default(''),
});

export type DailySummary = z.infer<typeof dailySummarySchema>;

export interface DailySummaryInput {
  /** Nombre del bebé (para que el modelo lo personalice). */
  childName: string;
  /** Edad para que el modelo no sugiera nada inapropiado (ej. comida sólida). */
  ageDays: number | null;
  /** Fecha del resumen en formato YYYY-MM-DD. */
  date: string;
  /** Conteo de eventos por tipo. */
  counts: {
    feeding: number;
    sleep: number;
    diaper: number;
  };
  /**
   * Detalles compactos para que el modelo arme una frase. Si no hay nada
   * relevante, podés mandar arrays vacíos.
   */
  details: {
    sleeps: Array<{ durationMinutes: number | null; isNap: boolean; quality: string | null }>;
    feedings: Array<{ type: string; durationMinutes: number | null; amountMl: number | null }>;
    diapers: Array<{ type: string }>;
    notes: Array<{ excerpt: string; mood: string | null }>;
  };
}

export interface DailySummaryOutput {
  summary: string;
  highlight: string;
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
 * Genera una frase corta y cariñosa que cuenta cómo fue el día con el bebé.
 *
 * No diagnostica nada — es una bitácora narrativa. Pensado para mostrar en
 * /home como un card opcional. El caller puede cachear el resultado por
 * (childId, date) para evitar volver a llamarlo si nada cambió.
 */
export async function summarizeDay(
  input: DailySummaryInput,
  context: AgentContext = {},
): Promise<DailySummaryOutput> {
  const userPayload = JSON.stringify(input);

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.6,
      maxTokens: 350,
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
  const parseResult = json ? dailySummarySchema.safeParse(json) : null;
  if (!parseResult || !parseResult.success) {
    const reason = parseResult
      ? `schema mismatch: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      : 'no se pudo extraer JSON';
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
    throw new AIParseError('No pudimos generar el resumen del día.');
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
    summary: parsed.summary.trim(),
    highlight: parsed.highlight.trim(),
    meta: {
      model: response.model,
      promptVersion: PROMPT_VERSION,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
  };
}
