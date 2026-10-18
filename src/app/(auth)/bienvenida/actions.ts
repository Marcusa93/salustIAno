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
 *   2. Pone `user_metadata.must_change_password` en false con el cliente admin
 *      (el regular requiere refrescar JWT y a veces no toma).
 *   3. Revalida /home así el siguiente render usa los claims actualizados.
 *
 * Si Supabase dice que la clave nueva es igual a la actual pero el flag ya
 * está limpio, es que ya la había cambiado: la dejamos pasar.
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

  const adminClient = createAdminClient();
  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateErr) {
    if (updateErr.code === 'same_password' || /different from the old/i.test(updateErr.message)) {
      // Puede ser que ya la haya cambiado y solo haya quedado el flag colgado
      // (pasaba cuando no se limpiaba bien): manda el dato fresco, no el JWT.
      const { data: fresh } = await adminClient.auth.admin.getUserById(userData.user.id);
      if (fresh.user && fresh.user.user_metadata?.must_change_password !== true) {
        await supabase.auth.refreshSession();
        revalidatePath('/home');
        return { ok: true };
      }
      return {
        ok: false,
        error: 'Esa es la contraseña temporal que te dieron. Elegí una nueva.',
        field: 'password',
      };
    }
    if (updateErr.code === 'weak_password' || /weak/i.test(updateErr.message)) {
      return {
        ok: false,
        error: 'Esa contraseña es muy fácil de adivinar. Probá con una más larga o distinta.',
        field: 'password',
      };
    }
    return { ok: false, error: 'No pudimos cambiar tu contraseña. Probá de nuevo.' };
  }

  // Limpiar el flag de onboarding desde admin. Ojo: user_metadata se COMBINA
  // con lo que ya hay, así que omitir la clave no la borra: va en false.
  const { error: flagErr } = await adminClient.auth.admin.updateUserById(userData.user.id, {
    user_metadata: { must_change_password: false },
  });
  if (flagErr) {
    return {
      ok: false,
      error: 'Tu contraseña ya cambió, pero no pudimos terminar. Probá de nuevo en un momento.',
    };
  }

  // Forzar refresh del JWT en este request para que el próximo navigate vea
  // el flag actualizado y no rebote al /bienvenida.
  await supabase.auth.refreshSession();

  revalidatePath('/home');
  return { ok: true };
}
