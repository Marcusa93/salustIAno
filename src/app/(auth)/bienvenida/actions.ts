'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  type CompleteOnboardingInput,
  completeOnboardingSchema,
} from '@/lib/validators/onboarding';
import { revalidatePath } from 'next/cache';

export type CompleteOnboardingResult =
  | { ok: true }
  | { ok: false; error: string; field?: keyof CompleteOnboardingInput };

/**
 * Cierra el flow de onboarding de un miembro recién creado por admin:
 *   1. Cambia la contraseña usando el cliente del usuario (mantiene la sesión).
 *   2. Limpia `user_metadata.must_change_password` con el cliente admin
 *      (el regular requiere refrescar JWT y a veces no toma).
 *   3. Revalida /home así el siguiente render usa los claims actualizados.
 *
 * El proxy se encarga de no dejar pasar a otras rutas hasta que esto
 * vuelva ok=true.
 */
export async function completeOnboardingAction(
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const parsed = completeOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? 'Datos inválidos.',
      ...(issue?.path[0] && typeof issue.path[0] === 'string'
        ? { field: issue.path[0] as keyof CompleteOnboardingInput }
        : {}),
    };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: 'Sesión expirada. Iniciá de nuevo.' };
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateErr) {
    // Mensaje más claro para los errores comunes de Supabase.
    const msg = updateErr.message;
    if (/same as the existing/i.test(msg)) {
      return {
        ok: false,
        error: 'Esa es la contraseña que te dieron. Tenés que poner una nueva.',
        field: 'password',
      };
    }
    if (/weak/i.test(msg)) {
      return {
        ok: false,
        error: 'La contraseña es muy débil. Probá con una más larga.',
        field: 'password',
      };
    }
    return { ok: false, error: 'No pudimos cambiar tu contraseña. Probá de nuevo.' };
  }

  // Limpiar el flag de onboarding desde admin para garantizar que el JWT
  // se actualice. Mantenemos el resto de user_metadata intacto.
  const adminClient = createAdminClient();
  const existingMeta = (userData.user.user_metadata as Record<string, unknown> | null) ?? {};
  const { must_change_password: _omit, ...rest } = existingMeta;
  await adminClient.auth.admin.updateUserById(userData.user.id, {
    user_metadata: rest,
  });

  // Forzar refresh del JWT en este request para que el próximo navigate vea
  // el flag actualizado y no rebote al /bienvenida.
  await supabase.auth.refreshSession();

  revalidatePath('/home');
  return { ok: true };
}
