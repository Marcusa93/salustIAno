import { z } from 'zod';

/**
 * Schema para el form de bienvenida que cierra el flujo de admin-creates-user.
 * Mismas reglas de fortaleza que signup (8 chars, mayúscula, número).
 */
export const completeOnboardingSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Tiene que incluir al menos una letra mayúscula')
      .regex(/[0-9]/, 'Tiene que incluir al menos un número'),
    passwordConfirm: z.string().min(1, 'Confirmá tu contraseña'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  });

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
