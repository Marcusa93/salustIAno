import { z } from 'zod';

const isoDateTimeString = z
  .string()
  .min(1, 'La fecha es obligatoria')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida');

const optionalNumber = z
  .number({ message: 'Tiene que ser un número' })
  .optional()
  .or(z.nan().transform(() => undefined));

/**
 * Schema de child_measurements alineado con los CHECK de la migración 001:
 *   - weight_grams entre 500 y 50000
 *   - height_cm entre 30 y 200
 *   - head_circumference_cm entre 25 y 65
 *   - al menos uno de los tres no null (CHECK child_measurements_at_least_one)
 *
 * Implementamos el CHECK del "al menos uno" con un .superRefine() para que
 * el feedback al user sea claro antes de pegarle a la base.
 */
export const measurementSchema = z
  .object({
    measured_at: isoDateTimeString,
    weight_grams: optionalNumber.refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 500 && v <= 50000),
      'Entre 500 y 50.000 g',
    ),
    height_cm: optionalNumber.refine(
      (v) => v === undefined || (v >= 30 && v <= 200),
      'Entre 30 y 200 cm',
    ),
    head_circumference_cm: optionalNumber.refine(
      (v) => v === undefined || (v >= 25 && v <= 65),
      'Entre 25 y 65 cm',
    ),
    notes: z.string().max(2000).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (
      data.weight_grams === undefined &&
      data.height_cm === undefined &&
      data.head_circumference_cm === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['weight_grams'],
        message: 'Cargá al menos uno: peso, talla o perímetro cefálico',
      });
    }
  });

export type MeasurementInput = z.infer<typeof measurementSchema>;
