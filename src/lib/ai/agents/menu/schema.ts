import { z } from 'zod';

export const ingredienteNoAptoSchema = z.object({
  nombre: z.string(),
  motivo: z.string(),
});

export const recetaSchema = z.object({
  nombre: z.string(),
  ingredientes: z.array(z.string()),
  preparacion: z.string(),
  textura: z.string(),
  alertas: z.array(z.string()),
  duracion: z.string(),
});

export const menuOutputSchema = z.object({
  ingredientesAptos: z.array(z.string()),
  ingredientesNoAptos: z.array(ingredienteNoAptoSchema),
  recetas: z.array(recetaSchema).min(1).max(3),
  consejo: z.string(),
});

export const menuInputSchema = z.object({
  ingredientes: z.string().min(2).max(500).trim(),
  edadMeses: z.number().int().min(0).max(36),
  edadDias: z.number().int().min(0),
  nombreBebe: z.string(),
});

export type IngredienteNoApto = z.infer<typeof ingredienteNoAptoSchema>;
export type RecetaSugerida = z.infer<typeof recetaSchema>;
export type MenuOutput = z.infer<typeof menuOutputSchema>;
export type MenuInput = z.infer<typeof menuInputSchema>;
