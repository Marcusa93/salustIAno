import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { describeAge } from '@/lib/ai/context/baby-context';
import { modelProfileFor } from '@/lib/ai/models';

const AGENT_NAME = 'pediatric-sleep-coach';
// v2: el input trae `ageLabel` y las ventanas de vigilia se eligen con esa edad.
const PROMPT_VERSION = 'pediatric-sleep-coach-v2';

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
  context: AgentLogContext = {},
): Promise<SleepCoachResult> {
  const userPayload = JSON.stringify({ ...input, ageLabel: describeAge(input.ageDays) });

  // El runner aplica los guardrails médicos (el nombre matchea
  // `pediatric`): si aparece una dosis o un medicamento, rompe antes de
  // llegar a la UI.
  return runStructuredAgent({
    agent: AGENT_NAME,
    promptVersion: PROMPT_VERSION,
    profile: modelProfileFor(AGENT_NAME),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ],
    outputSchema: sleepCoachOutputSchema,
    parseErrorMessage: 'No pudimos leer la situación del sueño.',
    context,
  });
}
