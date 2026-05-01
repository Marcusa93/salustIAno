'use server';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { type RequestResetInput, requestResetSchema } from '@/lib/validators/auth';

type RequestResetResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof RequestResetInput | 'root', string>> };

/**
 * Pide a Supabase Auth que mande un email con link para recuperar contraseña.
 *
 * El link aterriza en /auth/confirm?type=recovery&next=/restablecer, donde
 * verifyOtp setea la sesión y nos manda a /restablecer para que el usuario
 * elija nueva password.
 *
 * Comportamiento defensivo: nunca filtramos si el email existe o no. La
 * action siempre devuelve ok (incluso si el email no está registrado),
 * para que un atacante no pueda usar este endpoint para enumerar emails.
 * Supabase ya hace esto del lado de ellos para `resetPasswordForEmail`,
 * pero igual blindamos el resultado.
 */
export async function requestResetAction(data: RequestResetInput): Promise<RequestResetResult> {
  const parsed = requestResetSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        email: fieldErrors.email?.[0],
      },
    };
  }

  const supabase = await createClient();
  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/restablecer`;

  // Ignoramos el error: aunque falle (email no existe, rate limit, etc.),
  // mostramos el mismo "te mandamos un mail" para no leakear info.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  return { ok: true };
}
