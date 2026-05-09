'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  type CreateInvitationInput,
  createInvitationSchema,
  generateInvitationCode,
} from '@/lib/validators/invitation';
import { revalidatePath } from 'next/cache';

export interface InvitationEntry {
  id: string;
  code: string;
  role: 'admin' | 'caregiver' | 'family' | 'viewer';
  createdAt: string;
  createdByDisplayName: string | null;
  expiresAt: string;
  /** True si ya pasó la expiración (UI lo muestra en gris). */
  isExpired: boolean;
}

export type CreateInvitationResult =
  | { ok: true; invitation: InvitationEntry }
  | { ok: false; error: string };

export type RevokeInvitationResult = { ok: true } | { ok: false; error: string };

/**
 * Resuelve el family_group del admin que está logueado y verifica que
 * sea efectivamente admin. Patrón compartido con createMemberAction —
 * lo dejamos local porque la doble responsabilidad de exportarlo no
 * justifica un módulo extra todavía.
 */
async function getCallerAdminContext(): Promise<{
  familyGroupId: string;
  userId: string;
} | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: membership } = await supabase
    .from('family_memberships')
    .select('family_group_id, role')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') return null;
  return { familyGroupId: membership.family_group_id as string, userId: userData.user.id };
}

/**
 * Lista las invitaciones activas (no redimidas, no revocadas) del
 * family_group del admin que llama. Las expiradas se incluyen con flag
 * para que la UI las muestre como "vencida — generá una nueva".
 */
export async function listInvitationsAction(): Promise<InvitationEntry[]> {
  const ctx = await getCallerAdminContext();
  if (!ctx) return [];

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale para family_invitations.
  const sb = supabase as any;
  const { data: rows } = await sb
    .from('family_invitations')
    .select('id, code, role, created_by, expires_at, created_at')
    .eq('family_group_id', ctx.familyGroupId)
    .is('redeemed_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!rows || rows.length === 0) return [];

  // Resolvemos el display_name del creador con un solo round a memberships.
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb2 = supabase as any;
  const creatorIds = Array.from(
    new Set((rows as Array<{ created_by: string }>).map((r) => r.created_by)),
  );
  const { data: creators } = await sb2
    .from('family_memberships')
    .select('user_id, display_name')
    .in('user_id', creatorIds)
    .eq('family_group_id', ctx.familyGroupId);

  const creatorByUserId = new Map<string, string | null>();
  for (const c of (creators as Array<{ user_id: string; display_name: string | null }>) ?? []) {
    creatorByUserId.set(c.user_id, c.display_name);
  }

  const now = Date.now();
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    role: r.role as InvitationEntry['role'],
    createdAt: r.created_at as string,
    createdByDisplayName: creatorByUserId.get(r.created_by as string) ?? null,
    expiresAt: r.expires_at as string,
    isExpired: new Date(r.expires_at as string).getTime() < now,
  }));
}

/**
 * Crea un código de invitación nuevo. Reintenta hasta 3 veces si el
 * código generado choca con el unique partial — con 8 chars del alfabeto
 * reducido es altamente improbable, pero la función está acotada para
 * no quedar en loop si algo está roto.
 */
export async function createInvitationAction(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const data = parsed.data;

  const ctx = await getCallerAdminContext();
  if (!ctx) {
    return { ok: false, error: 'Solo un admin puede generar códigos.' };
  }

  const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);
  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInvitationCode();
    const { data: inserted, error } = await sb
      .from('family_invitations')
      .insert({
        family_group_id: ctx.familyGroupId,
        code,
        role: data.role,
        created_by: ctx.userId,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, code, role, created_at, expires_at')
      .single();

    if (error) {
      // Postgres unique violation = 23505. Si pegamos un código duplicado
      // entre los activos, reintentamos con uno nuevo.
      if ((error as { code?: string }).code === '23505') {
        lastError = 'duplicate';
        continue;
      }
      return { ok: false, error: 'No pudimos generar el código.' };
    }

    if (!inserted) {
      return { ok: false, error: 'No pudimos generar el código.' };
    }

    // Buscamos el display_name del creador (somos nosotros mismos).
    const { data: myMembership } = await sb
      .from('family_memberships')
      .select('display_name')
      .eq('user_id', ctx.userId)
      .eq('family_group_id', ctx.familyGroupId)
      .maybeSingle();

    revalidatePath('/familia');
    return {
      ok: true,
      invitation: {
        id: inserted.id as string,
        code: inserted.code as string,
        role: inserted.role as InvitationEntry['role'],
        createdAt: inserted.created_at as string,
        createdByDisplayName: (myMembership?.display_name as string | null) ?? null,
        expiresAt: inserted.expires_at as string,
        isExpired: false,
      },
    };
  }

  return {
    ok: false,
    error: `No pudimos generar un código único (${lastError ?? 'unknown'}). Probá de nuevo.`,
  };
}

/**
 * Revoca un código antes de que se redima ("se lo mandé a quien no era").
 * Solo el admin del grupo dueño del código puede hacerlo — RLS lo
 * verifica en la base, pero también lo chequeamos acá para no exponer
 * detalle al caller equivocado.
 */
export async function revokeInvitationAction(id: string): Promise<RevokeInvitationResult> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }
  const ctx = await getCallerAdminContext();
  if (!ctx) {
    return { ok: false, error: 'Solo un admin puede revocar códigos.' };
  }

  const supabase = await createClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = supabase as any;

  const { error } = await sb
    .from('family_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('family_group_id', ctx.familyGroupId)
    .is('redeemed_at', null);

  if (error) return { ok: false, error: 'No pudimos revocar el código.' };

  revalidatePath('/familia');
  return { ok: true };
}

/**
 * Helper interno usado por el flow público de redeem (en /signup/actions).
 * Vive acá porque lee la tabla `family_invitations` y queremos que toda
 * la lógica relacionada quede en un módulo. NO se exporta en el barrel
 * de la app: solo el redeem-action lo importa.
 *
 * Devuelve la fila si es válida (no redimida, no revocada, no expirada),
 * null si no.
 */
export async function _findRedeemableInvitation(code: string): Promise<{
  id: string;
  family_group_id: string;
  role: 'admin' | 'caregiver' | 'family' | 'viewer';
} | null> {
  // Usamos admin client porque el caller es anónimo (todavía no tiene
  // sesión) — RLS bloquearía SELECT si fuese authenticated.
  const admin = createAdminClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = admin as any;
  const { data } = await sb
    .from('family_invitations')
    .select('id, family_group_id, role, expires_at, redeemed_at, revoked_at')
    .eq('code', code)
    .maybeSingle();

  if (!data) return null;
  if (data.redeemed_at) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;

  return {
    id: data.id as string,
    family_group_id: data.family_group_id as string,
    role: data.role as 'admin' | 'caregiver' | 'family' | 'viewer',
  };
}

/**
 * Marca un código como redimido. Server-only, llamado al final del
 * redeem flow una vez que el user + membership ya están creados.
 */
export async function _markInvitationRedeemed(invitationId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  // biome-ignore lint/suspicious/noExplicitAny: types stale.
  const sb = admin as any;
  await sb
    .from('family_invitations')
    .update({ redeemed_at: new Date().toISOString(), redeemed_by: userId })
    .eq('id', invitationId);
}
