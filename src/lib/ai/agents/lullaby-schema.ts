/**
 * Schemas Zod del agente lullaby (canciones para Salu).
 *
 * Sin server-only ni dependencias de Node — se importa desde Client
 * Components (form). El agente real (lullaby.ts) carga estos schemas
 * y agrega el resto del pipeline server-side.
 */

import { z } from 'zod';

export const lullabyInputSchema = z.object({
  childName: z.string().min(1).max(100),
  ageDescription: z.string().min(1).max(200),
  moment: z.enum(['dormir', 'despertar', 'baño', 'paseo', 'calmar', 'jugar']),
  mood: z.enum(['dulce', 'jugueton', 'calmo', 'valiente']),
  theme: z.string().max(100).optional(),
  length: z.enum(['corta', 'media', 'larga']),
});

export type LullabyInput = z.infer<typeof lullabyInputSchema>;

export const lullabyOutputSchema = z.object({
  title: z.string().min(1).max(200),
  intro: z.string().min(1).max(400),
  verses: z.array(z.string().min(1).max(800)).min(1).max(4),
  chorus: z.string().max(500),
  closing: z.string().max(300),
  mood: z.enum(['dulce', 'jugueton', 'calmo', 'valiente']),
});

export type LullabyOutput = z.infer<typeof lullabyOutputSchema>;

export const MOMENT_LABELS: Record<LullabyInput['moment'], string> = {
  dormir: 'Para dormir',
  despertar: 'Al despertar',
  baño: 'En el baño',
  paseo: 'De paseo',
  calmar: 'Para calmar',
  jugar: 'Para jugar',
};

export const MOOD_LABELS: Record<LullabyInput['mood'], string> = {
  dulce: 'Dulce',
  jugueton: 'Juguetón',
  calmo: 'Calmo',
  valiente: 'Valiente',
};

export const LENGTH_LABELS: Record<LullabyInput['length'], string> = {
  corta: 'Corta',
  media: 'Media',
  larga: 'Larga',
};
