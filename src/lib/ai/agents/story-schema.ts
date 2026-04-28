/**
 * Schemas Zod del agente story-generator.
 *
 * Vive en su propio archivo, sin `import 'server-only'` ni dependencias de
 * Node, para que pueda importarse desde Client Components (form de
 * /crear/cuento). El agente real (story.ts) carga estos schemas y agrega
 * el resto del pipeline server-side.
 */

import { z } from 'zod';

export const storyInputSchema = z.object({
  childName: z.string().min(1).max(100),
  ageDescription: z.string().min(1).max(200),
  moment: z.enum(['dormir', 'jugar', 'calmar', 'estimular', 'recordar']),
  characters: z.array(z.string().min(1).max(50)).min(1).max(8),
  emotion: z.string().min(1).max(100).optional(),
  duration: z.enum(['corto', 'medio', 'largo']),
  style: z.string().max(100).optional(),
  familyValues: z.array(z.string().max(100)).max(5).optional(),
});

export type StoryInput = z.infer<typeof storyInputSchema>;

export const storyOutputSchema = z.object({
  title: z.string().min(1).max(200),
  story: z.string().min(50).max(5000),
  moralOrTheme: z.string().min(1).max(500),
  charactersUsed: z.array(z.string()),
});

export type StoryOutput = z.infer<typeof storyOutputSchema>;
