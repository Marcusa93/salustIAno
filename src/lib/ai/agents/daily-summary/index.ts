import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { type AgentLogContext, runStructuredAgent } from '@/lib/ai/agents/structured-agent';
import { describeAge } from '@/lib/ai/context/baby-context';
import { modelProfileFor } from '@/lib/ai/models';

const AGENT_NAME = 'daily-summary';
// v2: el input trae `ageLabel` (edad exacta ya calculada).
const PROMPT_VERSION = 'daily-summary-v2';

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

/**
 * Genera una frase corta y cariñosa que cuenta cómo fue el día con el bebé.
 *
 * No diagnostica nada — es una bitácora narrativa. Pensado para mostrar en
 * /home como un card opcional. El caller puede cachear el resultado por
 * (childId, date) para evitar volver a llamarlo si nada cambió.
 */
export async function summarizeDay(
  input: DailySummaryInput,
  context: AgentLogContext = {},
): Promise<DailySummaryOutput> {
  const userPayload = JSON.stringify({ ...input, ageLabel: describeAge(input.ageDays) });

  const { output, meta } = await runStructuredAgent({
    agent: AGENT_NAME,
    promptVersion: PROMPT_VERSION,
    profile: modelProfileFor(AGENT_NAME),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ],
    outputSchema: dailySummarySchema,
    parseErrorMessage: 'No pudimos generar el resumen del día.',
    context,
  });

  return {
    summary: output.summary.trim(),
    highlight: output.highlight.trim(),
    meta,
  };
}
