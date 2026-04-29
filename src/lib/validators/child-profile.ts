import { z } from 'zod';

export const bloodTypeEnum = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
export type BloodType = z.infer<typeof bloodTypeEnum>;

const isoDateString = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida');

const isoTimeString = z
  .string()
  .min(1)
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato esperado: HH:MM');

/**
 * Schema de creación/edición del child_profile.
 *
 * Casi todos los campos son opcionales: la familia carga lo que sabe HOY
 * (a veces solo el nombre y la fecha esperada) y completa el resto cuando
 * el bebé nace y vuelven del control.
 *
 * Los rangos de validación replican los `CHECK` de la migración 001 para
 * que el formulario rechace antes de pegarle a la base.
 */
export const childProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
  birth_date: isoDateString.optional().or(z.literal('')),
  birth_time: isoTimeString.optional().or(z.literal('')),
  birth_place: z.string().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
  birth_weight_grams: z
    .number({ message: 'Tiene que ser un número' })
    .int('Sin decimales')
    .min(200, 'Mínimo 200 g')
    .max(8000, 'Máximo 8000 g')
    .optional()
    .or(z.nan().transform(() => undefined)),
  birth_height_cm: z
    .number({ message: 'Tiene que ser un número' })
    .min(20, 'Mínimo 20 cm')
    .max(70, 'Máximo 70 cm')
    .optional()
    .or(z.nan().transform(() => undefined)),
  gestational_weeks_at_birth: z
    .number({ message: 'Tiene que ser un número entero' })
    .int('Sin decimales')
    .min(22, 'Mínimo 22 semanas')
    .max(45, 'Máximo 45 semanas')
    .optional()
    .or(z.nan().transform(() => undefined)),
  pediatrician_name: z.string().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
  pediatrician_phone: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  health_insurance: z.string().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
  blood_type: bloodTypeEnum.optional().or(z.literal('')),
  notes: z.string().max(5000, 'Máximo 5000 caracteres').optional().or(z.literal('')),
});

export type ChildProfileInput = z.infer<typeof childProfileSchema>;

/**
 * Calcula la edad gestacional corregida (en días) a partir de la cronológica.
 * Si no hay birth_date o no hay gestational_weeks_at_birth o el bebé fue de
 * término (>=37 semanas), devuelve null porque no aplica corrección.
 */
export function correctedAgeDays(
  birthDate: string | null,
  gestationalWeeks: number | null,
  now: Date = new Date(),
): number | null {
  if (!birthDate || gestationalWeeks === null || gestationalWeeks >= 37) return null;
  const birthMs = new Date(birthDate).getTime();
  const chronological = Math.floor((now.getTime() - birthMs) / (1000 * 60 * 60 * 24));
  return chronological - (40 - gestationalWeeks) * 7;
}

export function chronologicalAgeDays(
  birthDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  return Math.floor((now.getTime() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24));
}
