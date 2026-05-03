import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { callLLM } from '@/lib/ai/client';
import { AIParseError } from '@/lib/ai/errors';
import { extractJsonObject, truncateForLog } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';

const AGENT_NAME = 'pattern-finder';
const MODEL = 'anthropic/claude-haiku-4-5';
const PROMPT_VERSION = 'pattern-finder-v1';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/pattern-finder/prompt.md'),
  'utf8',
);

export const patternsSchema = z.object({
  observations: z.array(z.string().min(1).max(200)).min(1).max(6),
  tone: z.string().max(40).default('estable'),
});

export type Patterns = z.infer<typeof patternsSchema>;

export interface PatternFinderInput {
  childName: string;
  ageDays: number | null;
  /**
   * Por día: { date: 'YYYY-MM-DD', counts, durations } — el caller agrega.
   * El modelo solo ve datos agregados, nunca eventos individuales.
   */
  days: Array<{
    date: string;
    feedingCount: number;
    sleepCount: number;
    diaperCount: number;
    sleepMinutesAvg: number | null;
    sleepMinutesMax: number | null;
    feedingTotalMl: number | null;
  }>;
}

export interface PatternFinderOutput {
  observations: string[];
  tone: string;
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
 * Toma 7-14 días de datos agregados y devuelve 2-4 observaciones descriptivas.
 *
 * NUNCA diagnostica ni recomienda — está en el prompt y en el chequeo.
 * Si el modelo se sale del molde, igualamos: si una observación menciona
 * recomendaciones explícitas las filtramos antes de devolver.
 */
export async function findPatterns(
  input: PatternFinderInput,
  context: AgentContext = {},
): Promise<PatternFinderOutput> {
  const userPayload = JSON.stringify(input);

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.5,
      maxTokens: 600,
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
  const parseResult = json ? patternsSchema.safeParse(json) : null;
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
    throw new AIParseError('No pudimos generar las observaciones.');
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

  // Filtro defensivo: si alguna observación parece recomendación médica,
  // la dropeamos (mantiene una respuesta sin riesgo aunque el modelo se
  // descarrile).
  const RISKY_RE =
    /\b(habría que|deberían?|conviene (?:darle|cambiar|reducir|aumentar)|recomendamos|sugiero|recomendación)\b/i;
  const safeObservations = parsed.observations.filter((o) => !RISKY_RE.test(o));
  const observations =
    safeObservations.length > 0
      ? safeObservations.slice(0, 4)
      : ['Todavía hay pocos días registrados como para sacar tendencias.'];

  return {
    observations,
    tone: parsed.tone,
    meta: {
      model: response.model,
      promptVersion: PROMPT_VERSION,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
  };
}
