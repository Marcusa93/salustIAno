import { z } from 'zod';

/**
 * Schema del output del agente photo-tagger.
 *
 * Permisivo a propósito: el modelo a veces devuelve tags con tildes, mayúsculas
 * o frases largas. Acá solo validamos forma — el caller (uploadPhotosAction)
 * normaliza/recorta antes de persistir.
 */
export const photoTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(60)).max(8),
  caption: z.string().max(160).default(''),
});

export type PhotoTags = z.infer<typeof photoTagsSchema>;

/**
 * Tags que reservamos como "alarmas suaves" — si el modelo las devuelve,
 * conviene revisar la foto antes de mostrarla en filtros públicos. Por ahora
 * no se usa para bloquear, solo para que el caller pueda decidir.
 */
export const FALLBACK_TAG = 'sin clasificar' as const;
