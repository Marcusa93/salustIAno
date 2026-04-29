import { z } from 'zod';

export const noteCategoryEnum = z.enum(['memory', 'observation', 'milestone', 'other']);
export type NoteCategory = z.infer<typeof noteCategoryEnum>;

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  memory: 'Recuerdo',
  observation: 'Observación',
  milestone: 'Hito',
  other: 'Otro',
};

export const NOTE_CATEGORY_DESCRIPTIONS: Record<NoteCategory, string> = {
  memory: 'Algo lindo que querés guardar.',
  observation: 'Algo que notaste y vale la pena registrar.',
  milestone: 'Una primera vez: sonrisa, palabra, paso.',
  other: 'Lo que no entra en las otras.',
};

const isoDateTimeString = z
  .string()
  .min(1, 'La fecha es obligatoria')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida');

export const noteSchema = z.object({
  occurred_at: isoDateTimeString,
  category: noteCategoryEnum.default('memory'),
  content: z.string().min(1, 'Escribí algo').max(5000, 'Máximo 5000 caracteres'),
});

export type NoteInput = z.infer<typeof noteSchema>;
