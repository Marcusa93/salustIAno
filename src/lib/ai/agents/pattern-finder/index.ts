import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { describeAge } from '@/lib/ai/context/baby-context';
import { modelProfileFor } from '@/lib/ai/models';

const AGENT_NAME = 'pattern-finder';
// v3: el input trae `ageLabel` (edad exacta ya calculada).
const PROMPT_VERSION = 'pattern-finder-v3';

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'src/lib/ai/agents/pattern-finder/prompt.md'),
  'utf8',
);

export const patternsSchema = z.object({
  observations: z.array(z.string().min(1).max(200)).min(1).max(6),
  tone: z.string().max(40).default('estable'),
});

export type Patterns = z.infer<typeof patternsSchema>;

export interface WeekSummaryInput {
  feedingCountPerDay: number;
  feedingMlPerDay: number | null;
  sleepHoursPerDay: number;
  diaperCountPerDay: number;
}

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
    sleepMinutesTotal: number | null;
    feedingTotalMl: number | null;
  }>;
  /** Resumen comparativo semana actual vs semana anterior. Presente cuando hay ≥7 días de datos. */
  weekComparison?: {
    current: WeekSummaryInput;
    previous: WeekSummaryInput | null;
  };
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

/**
 * Toma 7-14 días de datos agregados y devuelve 2-4 observaciones descriptivas.
 *
 * NUNCA diagnostica ni recomienda — está en el prompt y en el chequeo.
 * Si el modelo se sale del molde, igualamos: si una observación menciona
 * recomendaciones explícitas las filtramos antes de devolver.
 */
export async function findPatterns(
  input: PatternFinderInput,
  context: AgentLogContext = {},
): Promise<PatternFinderOutput> {
  const userPayload = JSON.stringify({ ...input, ageLabel: describeAge(input.ageDays) });

  const { output: parsed, meta } = await runStructuredAgent({
    agent: AGENT_NAME,
    promptVersion: PROMPT_VERSION,
    profile: modelProfileFor(AGENT_NAME),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ],
    outputSchema: patternsSchema,
    parseErrorMessage: 'No pudimos generar las observaciones.',
    context,
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
    meta,
  };
}
