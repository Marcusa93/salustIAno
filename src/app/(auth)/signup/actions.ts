'use server';

import {
  _findRedeemableInvitation,
  _markInvitationRedeemed,
} from '@/app/(app)/familia/miembros/invitations-actions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { type RedeemInvitationInput, redeemInvitationSchema } from '@/lib/validators/invitation';

type RedeemResult =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<Record<keyof RedeemInvitationInput | 'root', string>>;
    };

/**
 * Sumarse a una familia con un código de invitación.
 *
 * Reemplaza al signup público de antes — Salu es una webapp privada y
 * cada cuenta nueva tiene que entrar invitada por un admin del grupo.
 *
 * Flow:
 *   1. Validamos el código (existe + no expirado + no redimido + no
 *      revocado).
 *   2. Creamos el user en auth.users con `email_confirm: true` vía admin
 *      client. El código en sí valida la confianza — no necesitamos un
 *      roundtrip de mail. Si el email ya estaba registrado, fallamos
 *      con un mensaje claro: "tu cuenta ya existe, entrá con tu pass".
 *   3. Insertamos la membership en el `family_group_id` del código,
 *      con el rol que el admin pre-asignó.
 *   4. Marcamos el código como redeemed.
 *   5. Iniciamos sesión con la pass que el usuario eligió, así no tiene
 *      que volver a tipearla en /login.
 *
 * Si algo después del paso 2 falla (insert membership, etc.) limpiamos
 * el user creado — evitamos cuentas huérfanas en auth.users.
 */
export async function redeemInvitationAction(input: RedeemInvitationInput): Promise<RedeemResult> {
  const parsed = redeemInvitationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        code: fieldErrors.code?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        passwordConfirm: fieldErrors.passwordConfirm?.[0],
        displayName: fieldErrors.displayName?.[0],
      },
    };
  }
  const data = parsed.data;

  // 1. Validar código.
  const invitation = await _findRedeemableInvitation(data.code);
  if (!invitation) {
    return {
      ok: false,
      errors: {
        code: 'Código inválido, vencido o ya usado. Pediles uno nuevo a tu admin.',
      },
    };
  }

  // 2. Crear el user con email confirmado.
  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      display_name: data.displayName,
    },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message?.toLowerCase() ?? '';
    if (msg.includes('already') || msg.includes('exists')) {
      return {
        ok: false,
        errors: {
          email:
            'Ya hay una cuenta con ese mail. Pedile a tu admin que te agregue desde /familia, o entrá si ya tenés contraseña.',
        },
      };
    }
    return {
      ok: false,
      errors: { root: 'Hubo un problema creando la cuenta. Probá de nuevo.' },
    };
  }

  const newUserId = created.user.id;

  // 3. Insertar membership.
  // biome-ignore lint/suspicious/noExplicitAny: types stale para family_memberships.
  const sb = admin as any;
  const { error: membershipErr } = await sb.from('family_memberships').insert({
    family_group_id: invitation.family_group_id,
    user_id: newUserId,
    role: invitation.role,
    display_name: data.displayName,
  });

  if (membershipErr) {
    // Cleanup: borramos el user que acabamos de crear para no dejar
    // huérfanos en auth.users.
    await admin.auth.admin.deleteUser(newUserId).catch(() => {
      /* best-effort */
    });
    return {
      ok: false,
      errors: { root: 'No pudimos sumarte a la familia. Probá de nuevo.' },
    };
  }

  // 4. Marcar código redeemed.
  await _markInvitationRedeemed(invitation.id, newUserId);

  // 5. Iniciar sesión con la SSR client (setea cookies para el browser).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (signInErr) {
    // Cuenta creada OK pero no pudimos firmar la sesión. La familia
    // puede entrar manualmente con /login. No revertimos: el user existe
    // y la membership también.
    return {
      ok: true,
    };
  }

  return { ok: true };
}
