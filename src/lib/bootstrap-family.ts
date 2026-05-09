import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Devuelve el `family_group_id` activo del usuario, o null si todavía no
 * pertenece a ninguna familia.
 *
 * Histórico: esta función creaba un family_group + admin membership a
 * cualquier user sin grupo (signup público auto-bootstrap). Eso generaba
 * familias huérfanas y rompía la unidad "una familia, un bebé". Ahora
 * Salu es invitation-only: el único camino para crear una membership
 * nueva es vía `redeemInvitationAction` (con código de admin) o
 * `createMemberAction` (admin agrega a alguien con password temporal).
 *
 * Como esos dos flows insertan la membership ellos mismos, este helper
 * pasó a ser solo un lookup. Lo mantenemos como punto de extensión por
 * si en algún futuro queremos volver a abrir self-bootstrap (con
 * superadmin manual, por ejemplo) — pero por defecto NO crea nada.
 *
 * Idempotente: llamadas repetidas siempre devuelven el mismo group_id
 * para un user que ya tiene membership.
 */
export async function ensureFamilyForUser(userId: string): Promise<string | null> {
  const admin = createAdminClient();

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

  return existingMemberships?.[0]?.family_group_id ?? null;
}
