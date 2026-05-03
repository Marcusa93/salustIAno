'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  type CreateMemberInput,
  type MemberRole,
  createMemberSchema,
  memberRoleSchema,
} from '@/lib/validators/family-member';
import { revalidatePath } from 'next/cache';

export interface MemberEntry {
  membershipId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  relationship: string | null;
  role: 'admin' | 'caregiver' | 'family' | 'viewer';
  acceptedAt: string;
  isSelf: boolean;
}

export type CreateMemberResult =
  | {
      ok: true;
      tempPassword: string;
      member: MemberEntry;
    }
  | { ok: false; error: string; field?: keyof CreateMemberInput };

/**
 * Genera una contraseña temporal segura de 14 caracteres con mayúscula,
 * minúscula, dígito y símbolo. Pensada para que el admin la copie y la
 * comparta por un canal seguro (WhatsApp, persona) — la familia la cambia
 * desde /perfil cuando entra por primera vez.
 *
 * Usa crypto.randomUUID para entropía y arma un set garantizando reglas.
 */
function generateTempPassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz'; // sin l ni o (legibilidad)
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O
  const digit = '23456789'; // sin 0 ni 1
  const symbol = '!#$%&*+-?@';
  const all = lower + upper + digit + symbol;

  const pickRandom = (set: string): string => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const idx = (arr[0] ?? 0) % set.length;
    return set.charAt(idx);
  };

  const required = [pickRandom(lower), pickRandom(upper), pickRandom(digit), pickRandom(symbol)];
  const rest = Array.from({ length: 10 }, () => pickRandom(all));
  const combined = [...required, ...rest];

  // Shuffle in-place (Fisher-Yates con randomValues).
  for (let i = combined.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = (arr[0] ?? 0) % (i + 1);
    const tmp = combined[i];
    const swap = combined[j];
    if (tmp !== undefined && swap !== undefined) {
      combined[i] = swap;
      combined[j] = tmp;
    }
  }
  return combined.join('');
}

/**
 * Resuelve el family_group del admin que está logueado y verifica que sea
 * efectivamente admin. Si algo falla, devuelve null para que el caller lo
 * mapee a "no autorizado".
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
 * Lista los miembros activos del family_group del usuario logueado.
 * Cualquier miembro (no solo admins) puede ver la lista.
 */
export async function listMembersAction(): Promise<MemberEntry[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data: myMembership } = await supabase
    .from('family_memberships')
    .select('family_group_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!myMembership?.family_group_id) return [];

  const { data: rows } = await supabase
    .from('family_memberships')
    .select('id, user_id, role, display_name, relationship, accepted_at')
    .eq('family_group_id', myMembership.family_group_id)
    .is('deleted_at', null)
    .order('role', { ascending: true })
    .order('accepted_at', { ascending: true });

  if (!rows) return [];

  // Buscar emails — RLS no te deja leer auth.users, así que hacemos un round
  // por admin client (server-only). Es OK porque ya verificamos la
  // pertenencia del caller a la family_group antes.
  const adminClient = createAdminClient();
  const userIds = (rows as Array<{ user_id: string }>).map((r) => r.user_id);

  const emailByUserId = new Map<string, string>();
  for (const id of userIds) {
    // Una llamada por user — la cantidad de miembros por familia es chica
    // (5-10 típicamente), no vale la pena un RPC custom.
    const { data: u } = await adminClient.auth.admin.getUserById(id);
    if (u?.user?.email) emailByUserId.set(id, u.user.email);
  }

  return (rows as Array<Record<string, unknown>>).map((r) => ({
    membershipId: r.id as string,
    userId: r.user_id as string,
    email: emailByUserId.get(r.user_id as string) ?? null,
    displayName: (r.display_name as string | null) ?? null,
    relationship: (r.relationship as string | null) ?? null,
    role: r.role as MemberEntry['role'],
    acceptedAt: r.accepted_at as string,
    isSelf: r.user_id === userData.user?.id,
  }));
}

/**
 * Crea un usuario nuevo en auth.users (con email confirmado y contraseña
 * temporal generada por el server) y lo agrega como miembro del family_group
 * del admin que llamó.
 *
 * Devuelve la contraseña temporal **una sola vez** — el admin la copia y la
 * comparte por un canal seguro. Después no se puede recuperar.
 */
export async function createMemberAction(input: CreateMemberInput): Promise<CreateMemberResult> {
  const parsed = createMemberSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? 'Datos inválidos.',
      ...(issue?.path[0] && typeof issue.path[0] === 'string'
        ? { field: issue.path[0] as keyof CreateMemberInput }
        : {}),
    };
  }
  const data = parsed.data;

  const ctx = await getCallerAdminContext();
  if (!ctx) {
    return { ok: false, error: 'Solo un admin puede crear miembros.' };
  }

  const adminClient = createAdminClient();

  // ¿Ya existe un user con ese email? Si sí, evitamos crearlo dos veces y
  // verificamos que no esté ya en esta familia. Si está en otra familia,
  // por ahora lo rechazamos (multi-family fuera de scope).
  const { data: existingUsers } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const existing = existingUsers?.users.find(
    (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
  );

  if (existing) {
    // ¿Ya es miembro?
    const { data: existingMembership } = await adminClient
      .from('family_memberships')
      .select('id, deleted_at, family_group_id')
      .eq('user_id', existing.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingMembership) {
      if (existingMembership.family_group_id === ctx.familyGroupId) {
        return { ok: false, error: 'Esa persona ya está en tu familia.', field: 'email' };
      }
      return {
        ok: false,
        error: 'Esa persona ya está en otra familia.',
        field: 'email',
      };
    }

    // User existe pero no tiene membership activa — la agregamos a esta familia.
    // No se le manda contraseña porque ya tenía una.
    const { data: inserted, error: insertErr } = await adminClient
      .from('family_memberships')
      .insert({
        family_group_id: ctx.familyGroupId,
        user_id: existing.id,
        role: data.role,
        display_name: data.displayName,
        relationship: data.relationship ?? null,
      })
      .select('id, accepted_at')
      .single();

    if (insertErr || !inserted) {
      return { ok: false, error: 'No pudimos agregar a esta persona a la familia.' };
    }

    revalidatePath('/familia');
    return {
      ok: true,
      tempPassword: '',
      member: {
        membershipId: inserted.id as string,
        userId: existing.id,
        email: existing.email ?? data.email,
        displayName: data.displayName,
        relationship: data.relationship ?? null,
        role: data.role,
        acceptedAt: inserted.accepted_at as string,
        isSelf: false,
      },
    };
  }

  // User nuevo: lo creamos con contraseña temporal y email confirmado.
  // `must_change_password` queda en user_metadata — el proxy lo lee del JWT
  // y fuerza redirect a /bienvenida hasta que la persona cambie la pass.
  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name: data.displayName,
      created_by_admin: ctx.userId,
      must_change_password: true,
    },
  });

  if (createErr || !created.user) {
    const message = createErr?.message ?? 'No pudimos crear la cuenta.';
    // Mensajes más claros para los errores comunes.
    if (/already.*registered/i.test(message)) {
      return { ok: false, error: 'Ya existe una cuenta con ese email.', field: 'email' };
    }
    if (/password/i.test(message)) {
      return { ok: false, error: 'La contraseña temporal generada fue rechazada. Probá de nuevo.' };
    }
    return { ok: false, error: message };
  }

  // Insertar membership. Si falla, intentamos limpiar el user creado para
  // no dejar cuentas huérfanas.
  const { data: inserted, error: insertErr } = await adminClient
    .from('family_memberships')
    .insert({
      family_group_id: ctx.familyGroupId,
      user_id: created.user.id,
      role: data.role,
      display_name: data.displayName,
      relationship: data.relationship ?? null,
    })
    .select('id, accepted_at')
    .single();

  if (insertErr || !inserted) {
    await adminClient.auth.admin.deleteUser(created.user.id).catch(() => {});
    return { ok: false, error: 'No pudimos asociar a la persona a tu familia.' };
  }

  revalidatePath('/familia');
  return {
    ok: true,
    tempPassword,
    member: {
      membershipId: inserted.id as string,
      userId: created.user.id,
      email: data.email,
      displayName: data.displayName,
      relationship: data.relationship ?? null,
      role: data.role,
      acceptedAt: inserted.accepted_at as string,
      isSelf: false,
    },
  };
}

/**
 * Soft-delete de una membership. El user en auth.users sigue existiendo
 * (por si después lo querés reactivar) pero pierde acceso al family_group.
 * No podés sacarte a vos misma ni sacar a otro admin.
 */
export async function removeMemberAction(
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof membershipId !== 'string' || membershipId.length === 0) {
    return { ok: false, error: 'ID inválido.' };
  }

  const ctx = await getCallerAdminContext();
  if (!ctx) {
    return { ok: false, error: 'Solo un admin puede sacar miembros.' };
  }

  const adminClient = createAdminClient();
  const { data: target } = await adminClient
    .from('family_memberships')
    .select('id, user_id, role, family_group_id, deleted_at')
    .eq('id', membershipId)
    .maybeSingle();

  if (!target || target.deleted_at) {
    return { ok: false, error: 'No encontramos esa membresía.' };
  }
  if (target.family_group_id !== ctx.familyGroupId) {
    return { ok: false, error: 'Esa membresía no es de tu familia.' };
  }
  if (target.user_id === ctx.userId) {
    return { ok: false, error: 'No podés sacarte a vos misma.' };
  }
  if (target.role === 'admin') {
    return { ok: false, error: 'No podés sacar a otro admin.' };
  }

  const { error } = await adminClient
    .from('family_memberships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', membershipId);

  if (error) return { ok: false, error: 'No pudimos sacar al miembro.' };

  revalidatePath('/familia');
  return { ok: true };
}

/**
 * Cambia el rol de un miembro existente. Reglas:
 *   - Solo admin puede.
 *   - No podés cambiar tu propio rol (te quedaría sin admins la familia).
 *   - No podés cambiar el rol de otro admin (mismo motivo).
 *   - El nuevo rol no puede ser 'admin' (se asigna por otra vía: signup).
 */
export async function updateMemberRoleAction(
  membershipId: string,
  newRole: MemberRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = memberRoleSchema.safeParse(newRole);
  if (!parsed.success) return { ok: false, error: 'Rol inválido.' };

  const ctx = await getCallerAdminContext();
  if (!ctx) return { ok: false, error: 'Solo un admin puede cambiar roles.' };

  const adminClient = createAdminClient();
  const { data: target } = await adminClient
    .from('family_memberships')
    .select('id, user_id, role, family_group_id, deleted_at')
    .eq('id', membershipId)
    .maybeSingle();

  if (!target || target.deleted_at) {
    return { ok: false, error: 'No encontramos esa membresía.' };
  }
  if (target.family_group_id !== ctx.familyGroupId) {
    return { ok: false, error: 'Esa membresía no es de tu familia.' };
  }
  if (target.user_id === ctx.userId) {
    return { ok: false, error: 'No podés cambiarte el rol a vos misma.' };
  }
  if (target.role === 'admin') {
    return { ok: false, error: 'No podés cambiar el rol de otro admin.' };
  }

  const { error } = await adminClient
    .from('family_memberships')
    .update({ role: parsed.data })
    .eq('id', membershipId);

  if (error) return { ok: false, error: 'No pudimos cambiar el rol.' };

  revalidatePath('/familia');
  return { ok: true };
}

/**
 * Resetea la contraseña del miembro y vuelve a marcar
 * `must_change_password=true` para forzarle el flow de bienvenida la próxima
 * vez que entre. Devuelve la pass nueva una sola vez para que el admin la
 * pase por un canal seguro.
 *
 * No se puede resetear la propia contraseña ni la de otro admin.
 */
export async function resetMemberPasswordAction(
  membershipId: string,
): Promise<{ ok: true; tempPassword: string; email: string } | { ok: false; error: string }> {
  const ctx = await getCallerAdminContext();
  if (!ctx) return { ok: false, error: 'Solo un admin puede resetear contraseñas.' };

  const adminClient = createAdminClient();
  const { data: target } = await adminClient
    .from('family_memberships')
    .select('id, user_id, role, family_group_id, deleted_at')
    .eq('id', membershipId)
    .maybeSingle();

  if (!target || target.deleted_at) {
    return { ok: false, error: 'No encontramos esa membresía.' };
  }
  if (target.family_group_id !== ctx.familyGroupId) {
    return { ok: false, error: 'Esa membresía no es de tu familia.' };
  }
  if (target.user_id === ctx.userId) {
    return { ok: false, error: 'Reseteá tu propia contraseña desde tu perfil.' };
  }
  if (target.role === 'admin') {
    return { ok: false, error: 'No podés resetear la contraseña de otro admin.' };
  }

  // Buscar el email + el user_metadata existente para no pisar otros campos.
  const { data: existing, error: getErr } = await adminClient.auth.admin.getUserById(
    target.user_id,
  );
  if (getErr || !existing.user?.email) {
    return { ok: false, error: 'No encontramos la cuenta del miembro.' };
  }

  const tempPassword = generateTempPassword();
  const previousMeta = (existing.user.user_metadata as Record<string, unknown> | null) ?? {};
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(target.user_id, {
    password: tempPassword,
    user_metadata: { ...previousMeta, must_change_password: true },
  });

  if (updateErr) {
    return { ok: false, error: 'No pudimos resetear la contraseña.' };
  }

  revalidatePath('/familia');
  return { ok: true, tempPassword, email: existing.user.email };
}
