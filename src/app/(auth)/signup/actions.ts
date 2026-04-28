'use server';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { type SignupInput, signupSchema } from '@/lib/validators/auth';

type SignupResult =
  | { ok: true; requiresEmailConfirmation: boolean }
  | { ok: false; errors: Partial<Record<keyof SignupInput | 'root', string>> };

/**
 * Crea una cuenta nueva en Supabase Auth.
 *
 * Si el proyecto remoto tiene `enable_confirmations = true` (default en
 * Supabase), el usuario recibe un mail con link a /auth/confirm. Hasta que
 * confirme, signInWithPassword va a tirar 'Email not confirmed'.
 *
 * Pasamos `displayName` y `familyName` como `user_metadata`. Esos datos
 * los lee el bootstrap de family_group cuando entre, en un commit posterior.
 *
 * NO redirigimos desde el server: dejamos que el cliente muestre el estado
 * "revisá tu mail" y maneje la navegación.
 */
export async function signupAction(data: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        passwordConfirm: fieldErrors.passwordConfirm?.[0],
        familyName: fieldErrors.familyName?.[0],
        displayName: fieldErrors.displayName?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      data: {
        display_name: parsed.data.displayName,
        family_name: parsed.data.familyName,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { ok: false, errors: { email: 'Ya hay una cuenta con ese mail. Probá entrar.' } };
    }
    return { ok: false, errors: { root: 'Hubo un problema creando la cuenta. Probá de nuevo.' } };
  }

  // Si el proyecto tiene confirmation desactivada, signUp devuelve
  // session != null. Si la tiene activa (default), session es null y
  // el user tiene que confirmar mail antes de loguearse.
  const requiresEmailConfirmation = signUpData.session === null;

  return { ok: true, requiresEmailConfirmation };
}
