import { z } from 'zod';

/**
 * Schema del output del agente pediatric-prep. El LLM devuelve un objeto
 * con esta forma exacta y lo validamos antes de mostrar al usuario.
 *
 * Strings con max generosos para no rebotar respuestas razonables; arrays
 * limitados para que el output quepa en una pantalla y no se transforme
 * en una novela.
 */
export const pediatricSummarySchema = z.object({
  period_label: z.string().min(1).max(80),
  headline: z.string().min(1).max(300),
  metrics: z.object({
    feeding: z.string().min(1).max(300),
    sleep: z.string().min(1).max(300),
    diaper: z.string().min(1).max(300),
    measurement: z.string().min(1).max(300),
  }),
  observations: z.array(z.string().min(1).max(400)).max(8),
  questions_for_pediatrician: z.array(z.string().min(1).max(300)).max(8),
  pending_milestones: z.array(z.string().min(1).max(200)).max(20),
});

export type PediatricSummary = z.infer<typeof pediatricSummarySchema>;

/**
 * Input que el server action arma para pasarle al agente. No es lo que
 * recibe el LLM textualmente — el agente lo transforma a un mensaje user
 * en JSON. Pero esta forma le da estructura al pipeline y facilita tests.
 */
export const pediatricInputSchema = z.object({
  daysBack: z.number().int().min(1).max(60),
  child: z.object({
    name: z.string(),
    birth_date: z.string().nullable(),
    is_preterm: z.boolean().nullable(),
  }),
  period: z.object({
    fromIso: z.string(),
    toIso: z.string(),
  }),
  feeding: z.object({
    total: z.number().int().min(0),
    by_type: z.record(z.string(), z.number().int().min(0)),
    total_amount_ml: z.number().min(0).nullable(),
    sample: z.array(
      z.object({
        occurred_at: z.string(),
        type: z.string(),
        amount_ml: z.number().nullable(),
        duration_minutes: z.number().nullable(),
        side: z.string().nullable(),
      }),
    ),
  }),
  sleep: z.object({
    total: z.number().int().min(0),
    total_minutes_estimated: z.number().int().min(0),
    sample: z.array(
      z.object({
        started_at: z.string(),
        ended_at: z.string().nullable(),
        is_nap: z.boolean(),
        quality: z.string().nullable(),
      }),
    ),
  }),
  diaper: z.object({
    total: z.number().int().min(0),
    by_type: z.record(z.string(), z.number().int().min(0)),
    notes_with_content: z.array(z.string()).max(20),
  }),
  measurements: z.array(
    z.object({
      measured_at: z.string(),
      weight_grams: z.number().nullable(),
      height_cm: z.number().nullable(),
      head_circumference_cm: z.number().nullable(),
    }),
  ),
  pending_milestones: z.array(
    z.object({
      title: z.string(),
      due_at: z.string().nullable(),
      category: z.string().nullable(),
    }),
  ),
});

export type PediatricInput = z.infer<typeof pediatricInputSchema>;
