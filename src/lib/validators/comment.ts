import { z } from 'zod';

export const commentTargetEnum = z.enum([
  'note',
  'feeding',
  'sleep',
  'diaper',
  'milestone',
  'media',
]);
export type CommentTarget = z.infer<typeof commentTargetEnum>;

export const createCommentSchema = z.object({
  targetType: commentTargetEnum,
  targetId: z.string().min(1, 'ID inválido.').max(80),
  content: z
    .string()
    .min(1, 'El comentario no puede estar vacío.')
    .max(500, 'Máximo 500 caracteres.')
    .transform((v) => v.trim()),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
