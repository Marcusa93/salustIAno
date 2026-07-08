import { z } from 'zod';

const isoDateTimeString = z
  .string()
  .min(1, 'La fecha es obligatoria')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida');

export const medicationDoseSchema = z.object({
  medication_name: z
    .string()
    .min(1, 'El nombre del medicamento es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
  dose_amount: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  given_at: isoDateTimeString,
  interval_hours: z
    .number({ message: 'Tiene que ser un número' })
    .min(1, 'Mínimo 1 hora')
    .max(72, 'Máximo 72 horas')
    .optional()
    .or(z.nan().transform(() => undefined)),
  notes: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
});

export type MedicationDoseInput = z.infer<typeof medicationDoseSchema>;
