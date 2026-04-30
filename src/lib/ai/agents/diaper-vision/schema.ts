import { z } from 'zod';

/**
 * Schema del output del agente diaper-vision. Valida lo que el LLM devuelve
 * para que el caller siempre reciba un objeto bien formado.
 *
 * No exige enums estrictos en `color` y `consistency` (el modelo a veces se
 * sale del taxonomy fijo) — para no rebotar respuestas razonables. Filtramos
 * en UI con `KNOWN_COLORS` / `KNOWN_CONSISTENCIES` para resaltar lo conocido.
 */
export const diaperAnalysisSchema = z.object({
  color: z.string().min(1).max(40),
  consistency: z.string().min(1).max(40),
  observations: z.string().min(1).max(800),
  alarm: z.boolean(),
  alarm_reason: z.string().max(300),
  recommendation: z.string().min(1).max(300),
});

export type DiaperAnalysis = z.infer<typeof diaperAnalysisSchema>;

export const KNOWN_COLORS = [
  'amarillo claro',
  'amarillo mostaza',
  'verde',
  'marrón claro',
  'marrón oscuro',
  'naranja',
  'rojizo',
  'negro',
  'blanco-pálido',
  'otro',
] as const;

export const KNOWN_CONSISTENCIES = [
  'líquida',
  'pastosa',
  'formada',
  'dura',
  'con grumos',
  'otra',
] as const;
