import { z } from 'zod';

/**
 * Roles disponibles cuando un admin agrega a un miembro nuevo.
 *
 * Notar que `admin` no aparece acá: un admin común no puede crear ni nombrar
 * otros admins. Solo el superadmin puede (ver `familyRoleSchema` y
 * `@/lib/family-permissions`), o alguien que crea su propio family_group
 * durante signup.
 */
export const memberRoleSchema = z.enum(['caregiver', 'family', 'viewer']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

/** Todos los roles, incluido `admin`. Solo para lo que hace el superadmin. */
export const familyRoleSchema = z.enum(['admin', 'caregiver', 'family', 'viewer']);
export type FamilyMemberRole = z.infer<typeof familyRoleSchema>;

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

/** Igual que `createMemberSchema`, pero el superadmin también puede crear admins. */
export const createMemberAsSuperadminSchema = createMemberSchema.extend({
  role: familyRoleSchema,
});

export type CreateMemberAsSuperadminInput = z.infer<typeof createMemberAsSuperadminSchema>;
