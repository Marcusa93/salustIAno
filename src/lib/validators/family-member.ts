import { z } from 'zod';

/**
 * Roles disponibles cuando un admin agrega a un miembro nuevo.
 *
 * Notar que `admin` no aparece acá: solo se puede asignar admin a través de
 * un cambio explícito (todavía no implementado) o cuando alguien crea su
 * propio family_group durante signup. Esto evita que un admin cree otro admin
 * "por error" desde el formulario.
 */
export const memberRoleSchema = z.enum(['caregiver', 'family', 'viewer']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

/**
 * Input para crear un miembro nuevo. La contraseña la genera el server, no
 * el admin — así evitamos que el admin elija una débil y simplificamos el
 * flow para la familia (el admin la copia y la pasa por WhatsApp).
 */
export const createMemberSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z
      .string()
      .min(1, 'El email es obligatorio')
      .email('Ingresá un email válido')
      .max(254, 'Email demasiado largo'),
  ),
  displayName: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(60, 'Máximo 60 caracteres')
    .transform((v) => v.trim()),
  relationship: z
    .string()
    .max(60, 'Máximo 60 caracteres')
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : undefined;
    }),
  role: memberRoleSchema,
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
