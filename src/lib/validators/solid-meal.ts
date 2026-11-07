import { z } from 'zod';

import { feedingReactionEnum } from './events';

export const foodFormatEnum = z.enum(['puree', 'mashed', 'preloaded', 'finger']);
export const foodAcceptanceEnum = z.enum(['loved', 'liked', 'neutral', 'disliked', 'refused']);
export const foodAmountEnum = z.enum(['taste', 'some', 'half', 'most', 'all']);
export const reactionSignEnum = z.enum([
  'boca_roja',
  'ronchas',
  'hinchazon',
  'vomitos',
  'diarrea',
  'tos',
  'respirar',
]);

export const tastingInputSchema = z.object({
  food_key: z.string().trim().min(1).max(120),
  food_name: z.string().trim().min(1, 'Falta el alimento').max(100),
  format: foodFormatEnum.nullable().default(null),
  acceptance: foodAcceptanceEnum.nullable().default(null),
  amount: foodAmountEnum.nullable().default(null),
  gagged: z.boolean().default(false),
  reaction: feedingReactionEnum.default('none'),
  reaction_signs: z.array(reactionSignEnum).max(7).default([]),
});

export type TastingInput = z.input<typeof tastingInputSchema>;

export const solidMealSchema = z.object({
  occurred_at: z
    .string()
    .min(1, 'La hora es obligatoria')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida'),
  tastings: z
    .array(tastingInputSchema)
    .min(1, 'Sumá al menos un alimento')
    .max(20, 'Hasta 20 alimentos por comida'),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export type SolidMealInput = z.input<typeof solidMealSchema>;
export type SolidMealData = z.output<typeof solidMealSchema>;
