'use server';

import { createClient } from '@/lib/supabase/server';
import { type ResetPasswordInput, resetPasswordSchema } from '@/lib/validators/auth';
import type { Route } from 'next';
import { redirect } from 'next/navigation';

type ResetPasswordResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof ResetPasswordInput | 'root', string>> };

/**
 * Establece la nueva contraseña del usuario. Solo funciona si hay sesión
 * activa, lo que sucede automáticamente cuando llega vía /auth/confirm
 * con type=recovery.
 *
 * En éxito: redirige a /home. En fallo: devuelve errores estructurados.
 */
export async function resetPasswordAction(data: ResetPasswordInput): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        password: fieldErrors.password?.[0],
        passwordConfirm: fieldErrors.passwordConfirm?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      ok: false,
      errors: {
        root: 'El link expiró o ya se usó. Pedí uno nuevo desde "¿La olvidaste?".',
      },
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('same as the existing')) {
      return {
        ok: false,
        errors: { password: 'Tiene que ser distinta a la actual.' },
      };
    }
    return { ok: false, errors: { root: 'No pudimos actualizar la contraseña.' } };
  }

  redirect('/home' as Route);
}
