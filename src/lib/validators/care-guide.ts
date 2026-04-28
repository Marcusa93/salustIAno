import { z } from 'zod';

export const careGuideCategoryEnum = z.enum([
  'dormir',
  'higiene',
  'alimentacion',
  'control',
  'emergencia',
  'otros',
]);

export type CareGuideCategory = z.infer<typeof careGuideCategoryEnum>;

export const CARE_GUIDE_CATEGORY_LABELS: Record<CareGuideCategory, string> = {
  dormir: 'Dormir',
  higiene: 'Higiene',
  alimentacion: 'Alimentación',
  control: 'Control',
  emergencia: 'Emergencia',
  otros: 'Otros',
};

export const careGuideCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es obligatorio')
    .max(200, 'El título no puede superar los 200 caracteres'),
  category: careGuideCategoryEnum,
  content: z
    .string()
    .min(1, 'Escribí algo en el contenido')
    .max(10000, 'El contenido es muy largo (máximo 10.000 caracteres)'),
  source: z
    .string()
    .max(200, 'La fuente no puede superar los 200 caracteres')
    .optional()
    .or(z.literal('')),
});

export type CareGuideCreateInput = z.infer<typeof careGuideCreateSchema>;

export const careGuideUpdateSchema = careGuideCreateSchema;
export type CareGuideUpdateInput = z.infer<typeof careGuideUpdateSchema>;
