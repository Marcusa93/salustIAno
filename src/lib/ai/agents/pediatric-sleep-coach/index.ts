import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { callLLM } from '@/lib/ai/client';
import { AIParseError } from '@/lib/ai/errors';
import { applyGuardrails } from '@/lib/ai/guardrails';
import { extractJsonObject, truncateForLog } from '@/lib/ai/json';
import { logStore } from '@/lib/ai/logger';

const AGENT_NAME = 'pediatric-sleep-coach';
const MODEL = 'anthropic/claude-haiku-4-5';
const PROMPT_VERSION = 'pediatric-sleep-coach-v1';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/pediatric-sleep-coach/prompt.md'),
  'utf8',
);

export const sleepCoachOutputSchema = z.object({
  diagnosis: z.enum(['hunger', 'sleep_cycle', 'discomfort', 'overtired', 'undertired', 'unclear']),
  confidence: z.enum(['low', 'medium', 'high']),
  headline: z.string().min(1).max(90),
  suggestion: z.string().min(1).max(280),
  science: z.string().min(1).max(280),
  alarm: z.string().max(280).nullable(),
});

export type SleepCoachOutput = z.infer<typeof sleepCoachOutputSchema>;

export interface SleepCoachInput {
  /** Edad en días. null si todavía no hay fecha de nacimiento (RN sin perfil). */
  ageDays: number | null;
  /** Hora actual en formato ISO local AR ("YYYY-MM-DDTHH:mm"). */
  nowAr: string;
  /** Minutos desde la última toma. null si no hay registro. */
  lastFeedingMinutesAgo: number | null;
  /** Minutos desde el último pañal. null si no hay registro. */
  lastDiaperMinutesAgo: number | null;
  /**
   * Sueño abierto ahora mismo (en curso, sin ended_at). null si el bebé
   * está despierto.
   */
  activeSleep: { startedMinutesAgo: number; isNap: boolean } | null;
  /** Minutos desde el último sueño cerrado (despertar más reciente). null si no hay. */
  lastClosedSleepMinutesAgo: number | null;
  /** Promedios de los últimos 3 días para que el coach tenga referencia. */
  recentSleepStats: {
    avgNightSessionMinutes: number | null;
    avgWakeWindowMinutes: number | null;
  };
}

export interface SleepCoachResult {
  output: SleepCoachOutput;
  meta: {
    model: string;
    promptVersion: string;
    totalTokens: number;
    latencyMs: number;
  };
}

interface AgentContextInput {
  familyGroupId?: string;
  childId?: string;
  actorUserId?: string;
}

/**
 * Lee la situación del bebé a la madrugada y devuelve un diagnóstico
 * breve + sugerencia accionable.
 *
 * El nombre `pediatric-sleep-coach` matchea el regex de guardrails de
 * dominio médico (`pediatric|medical|salud|sintoma`), así que el output
 * pasa por los filtros que rechazan dosis y prescripción explícita
 * antes de llegar a la UI.
 *
 * NO persiste nada — el caller cachea client-side por (childId, ventana
 * de 30 min) para evitar quemar tokens si la familia abre la app varias
 * veces seguidas.
 */
export async function coachNight(
  input: SleepCoachInput,
  context: AgentContextInput = {},
): Promise<SleepCoachResult> {
  const userPayload = JSON.stringify(input);

  let response: Awaited<ReturnType<typeof callLLM>>;
  try {
    response = await callLLM({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.4,
      maxTokens: 500,
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
  const parseResult = json ? sleepCoachOutputSchema.safeParse(json) : null;
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
    throw new AIParseError('No pudimos leer la situación del sueño.');
  }

  // Guardrails determinísticos sobre el output: por más que el prompt
  // pida "no recomendar medicación", el modelo puede equivocarse. Si
  // aparece una dosis o nombre de medicamento, rompemos antes de mostrar.
  const safeOutput = applyGuardrails(parseResult.data, {
    agent: AGENT_NAME,
    ...(context.familyGroupId ? { familyGroupId: context.familyGroupId } : {}),
    ...(context.childId ? { childId: context.childId } : {}),
    ...(context.actorUserId ? { actorUserId: context.actorUserId } : {}),
  });

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
    output: safeOutput,
    meta: {
      model: response.model,
      promptVersion: PROMPT_VERSION,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    },
  };
}
