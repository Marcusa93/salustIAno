import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Asegura que el usuario tenga al menos un `family_group` con membership
 * activa de rol `admin`.
 *
 * Idempotente: si ya tiene una membership, no hace nada y retorna su
 * `family_group_id`.
 *
 * Usa admin client porque hay un chicken-and-egg con RLS: para leer
 * `family_memberships` la policy pide ser miembro, y para insertar la
 * primera membership necesitás un family_group que todavía no creaste.
 * El admin bypassea RLS.
 *
 * Toma `family_name` y `display_name` del `user_metadata` que se setea en
 * signup. Si faltan, usa defaults razonables.
 *
 * Devuelve el `family_group_id` del grupo donde el user es miembro
 * (recién creado o el que ya tenía).
 */
export async function ensureFamilyForUser(userId: string): Promise<string | null> {
  const admin = createAdminClient();

  // ¿Ya tiene membership activa?
  const { data: existingMemberships, error: lookupError } = await admin
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(1);

  if (lookupError) {
    console.error('[bootstrap-family] lookup failed:', lookupError.message);
    return null;
  }

  if (existingMemberships && existingMemberships.length > 0) {
    return existingMemberships[0]?.family_group_id ?? null;
  }

  // Recuperar metadata del user (display_name, family_name).
  const { data: userResponse, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userResponse?.user) {
    console.error('[bootstrap-family] getUserById failed:', userError?.message);
    return null;
  }

  const meta = userResponse.user.user_metadata as
    | { display_name?: string; family_name?: string }
    | undefined;
  const familyName = meta?.family_name?.trim() || 'Mi familia';
  const displayName = meta?.display_name?.trim() ?? null;

  // Crear el family_group.
  const { data: group, error: groupError } = await admin
    .from('family_groups')
    .insert({ name: familyName })
    .select('id')
    .single();

  if (groupError || !group) {
    console.error('[bootstrap-family] family_group insert failed:', groupError?.message);
    return null;
  }

  // Crear la membership de admin.
  const { error: membershipError } = await admin.from('family_memberships').insert({
    family_group_id: group.id,
    user_id: userId,
    role: 'admin',
    display_name: displayName,
  });

  if (membershipError) {
    console.error('[bootstrap-family] membership insert failed:', membershipError.message);
    return null;
  }

  return group.id;
}
