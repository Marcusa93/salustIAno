import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'El email es obligatorio').email('Ingresá un email válido'),
  password: z.string().min(8, 'La contraseña tiene que tener al menos 8 caracteres'),
});

export const signupSchema = z
  .object({
    email: z.string().min(1, 'El email es obligatorio').email('Ingresá un email válido'),
    password: z
      .string()
      .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Tiene que incluir al menos una letra mayúscula')
      .regex(/[0-9]/, 'Tiene que incluir al menos un número'),
    passwordConfirm: z.string().min(1, 'Confirmá tu contraseña'),
    familyName: z
      .string()
      .min(1, 'El nombre de familia es obligatorio')
      .max(100, 'El nombre no puede superar los 100 caracteres'),
    displayName: z
      .string()
      .min(1, 'Tu nombre es obligatorio')
      .max(100, 'El nombre no puede superar los 100 caracteres'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
