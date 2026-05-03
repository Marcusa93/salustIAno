'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function updateDisplayNameAction(
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return { ok: false, error: 'El nombre tiene que tener entre 1 y 100 caracteres.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: 'Sesión expirada.' };
  }

  const { error } = await supabase
    .from('family_memberships')
    .update({ display_name: trimmed })
    .eq('user_id', userData.user.id)
    .is('deleted_at', null);

  if (error) {
    return { ok: false, error: 'No pudimos guardar el nombre.' };
  }
  revalidatePath('/perfil');
  revalidatePath('/home');
  return { ok: true };
}

export async function changePasswordAction(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { ok: false, error: 'La contraseña tiene que tener al menos 8 caracteres.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: 'No pudimos cambiar la contraseña. Probá de nuevo.' };
  }
  return { ok: true };
}
