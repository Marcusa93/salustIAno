import { z } from 'zod';

import { memberRoleSchema } from './family-member';

/**
 * Formato del código de invitación: dos bloques de 4 caracteres
 * separados por guión, alfanuméricos en mayúsculas. Ejemplo:
 * "A4P2-Q9XR".
 *
 * Por qué este formato:
 *   - 8 chars de entropía (~32 bits sin caracteres ambiguos) — robusto
 *     contra adivinanza pero corto de tipear.
 *   - El guión hace fácil leerlo en voz alta y saber dónde va el "espacio".
 *   - Sólo mayúsculas: cuando se comparte por WhatsApp el autocorrector
 *     no se confunde y la familia no se pelea con shift.
 *   - Sin O/0/I/1: no los usamos al generar para evitar confusión visual.
 */
export const INVITATION_CODE_REGEX = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/**
 * Caracteres permitidos al generar un código (server-side). Excluyen los
 * que se confunden a la lectura: 0/O, 1/I, B/8 todavía pasan pero el
 * resto evita ambigüedad.
 */
export const INVITATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const EXPIRES_IN_DAYS_OPTIONS = [1, 3, 7, 14, 30] as const;

/**
 * Input para que un admin genere un código de invitación.
 *
 * `expiresInDays` está acotado al set fijo arriba — un selector cerrado
 * en la UI evita que la familia ponga "365" sin querer. Default 7.
 */
export const createInvitationSchema = z.object({
  role: memberRoleSchema,
  expiresInDays: z
    .union([z.literal(1), z.literal(3), z.literal(7), z.literal(14), z.literal(30)])
    .default(7),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export const INVITATION_EXPIRES_IN_DAYS_OPTIONS = EXPIRES_IN_DAYS_OPTIONS;

/**
 * Input que llega desde /signup cuando alguien redime un código.
 *
 * El email + password los maneja Supabase Auth; los validamos acá para
 * dar feedback inmediato antes de hacer el redondtrip server-side.
 */
export const redeemInvitationSchema = z
  .object({
    code: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
      z.string().regex(INVITATION_CODE_REGEX, 'Código inválido. Formato esperado: XXXX-XXXX.'),
    ),
    email: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z
        .string()
        .min(1, 'El email es obligatorio.')
        .email('Ingresá un email válido.')
        .max(254, 'Email demasiado largo.'),
    ),
    password: z
      .string()
      .min(8, 'La contraseña tiene que tener al menos 8 caracteres.')
      .max(128, 'Contraseña demasiado larga.'),
    passwordConfirm: z.string(),
    displayName: z
      .string()
      .max(60, 'Máximo 60 caracteres.')
      .transform((v) => v.trim())
      .refine((v) => v.length >= 1, 'Decinos cómo te llamamos.'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirm'],
  });

export type RedeemInvitationInput = z.infer<typeof redeemInvitationSchema>;

/**
 * Genera un código en el formato esperado. Server-only — usa
 * `crypto.randomBytes` para buena entropía.
 *
 * No garantiza unicidad por sí solo: el caller tiene que insertarlo y
 * reintentar si choca con el partial unique de la migración (caso muy
 * improbable con 8 chars del alfabeto reducido).
 */
export function generateInvitationCode(): string {
  // Web Crypto API — disponible tanto en Node 18+ como en edge.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars: string[] = [];
  for (const byte of bytes) {
    chars.push(INVITATION_CODE_ALPHABET[byte % INVITATION_CODE_ALPHABET.length] ?? 'A');
  }
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}
