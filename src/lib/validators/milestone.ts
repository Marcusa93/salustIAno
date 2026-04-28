import { z } from 'zod';

export const milestoneCategoryEnum = z.enum([
  'control_pediatrico',
  'pesquisa',
  'estudio',
  'vacuna',
  'otro',
]);

export type MilestoneCategory = z.infer<typeof milestoneCategoryEnum>;

export const MILESTONE_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  control_pediatrico: 'Control pediátrico',
  pesquisa: 'Pesquisa',
  estudio: 'Estudio',
  vacuna: 'Vacuna',
  otro: 'Otro',
};

const isoDateString = z
  .string()
  .min(1, 'La fecha es obligatoria')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida');

export const milestoneCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es obligatorio')
    .max(200, 'El título no puede superar los 200 caracteres'),
  category: milestoneCategoryEnum,
  description: z
    .string()
    .max(2000, 'La descripción no puede superar los 2000 caracteres')
    .optional()
    .or(z.literal('')),
  due_at: isoDateString.optional().or(z.literal('')),
  notes: z
    .string()
    .max(5000, 'Las notas no pueden superar los 5000 caracteres')
    .optional()
    .or(z.literal('')),
});

export type MilestoneCreateInput = z.infer<typeof milestoneCreateSchema>;

export const milestoneUpdateSchema = milestoneCreateSchema;
export type MilestoneUpdateInput = z.infer<typeof milestoneUpdateSchema>;

/**
 * Estado derivado del milestone.
 *
 *   completed   → tiene completed_at != null.
 *   overdue     → pendiente y due_at en el pasado.
 *   pending     → pendiente y due_at futuro o sin fecha.
 */
export type MilestoneStatus = 'pending' | 'overdue' | 'completed';

export function deriveStatus(
  due_at: string | null,
  completed_at: string | null,
  now: Date = new Date(),
): MilestoneStatus {
  if (completed_at) return 'completed';
  if (due_at && new Date(due_at).getTime() < now.getTime()) return 'overdue';
  return 'pending';
}
