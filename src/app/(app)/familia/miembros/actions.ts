'use server';

import {
  type FamilyActor,
  type FamilyRole,
  type MemberPermissions,
  assignableRoles,
  memberPermissions,
  readSuperadminFlag,
} from '@/lib/family-permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  type CreateMemberAsSuperadminInput,
  type FamilyMemberRole,
  createMemberAsSuperadminSchema,
  familyRoleSchema,
} from '@/lib/validators/family-member';
import { revalidatePath } from 'next/cache';

export interface MemberEntry {
  membershipId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  relationship: string | null;
  role: FamilyRole;
  acceptedAt: string;
  isSelf: boolean;
  isSuperadmin: boolean;
}

export type CreateMemberResult =
  | {
      ok: true;
      tempPassword: string;
      member: MemberEntry;
    }
  | { ok: false; error: string; field?: keyof CreateMemberAsSuperadminInput };

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

interface CallerAdminContext {
  familyGroupId: string;
  userId: string;
  actor: FamilyActor;
}

/**
 * Resuelve el family_group del admin que está logueado y verifica que sea
 * efectivamente admin. Si algo falla, devuelve null para que el caller lo
 * mapee a "no autorizado".
 *
 * El flag de superadmin sale de `app_metadata` del user verificado por
 * Supabase Auth: solo se escribe con la secret key, nadie se lo pone solo.
 */
async function getCallerAdminContext(): Promise<CallerAdminContext | null> {
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
  return {
    familyGroupId: membership.family_group_id as string,
    userId: userData.user.id,
    actor: { role: 'admin', isSuperadmin: readSuperadminFlag(userData.user.app_metadata) },
  };
}

type ManagedAction = keyof MemberPermissions;

const SELF_MESSAGES: Record<ManagedAction, string> = {
  changeRole: 'No podés cambiarte el rol a vos misma.',
  resetPassword: 'Reseteá tu propia contraseña desde tu perfil.',
  remove: 'No podés sacarte a vos misma.',
  deleteAccount: 'No podés borrar tu propia cuenta desde acá.',
};

/**
 * Carga la membresía sobre la que se quiere actuar, verifica que sea de la
 * familia del admin y que `memberPermissions` habilite la acción. Devuelve
 * el target listo para operar o el mensaje de error para la UI.
 */
async function loadManagedTarget(
  ctx: CallerAdminContext,
  membershipId: string,
  action: ManagedAction,
): Promise<
  | {
      ok: true;
      target: { id: string; userId: string; role: FamilyRole };
      authUser: { email: string | null; userMetadata: Record<string, unknown> };
    }
  | { ok: false; error: string }
> {
  if (typeof membershipId !== 'string' || membershipId.length === 0) {
    return { ok: false, error: 'ID inválido.' };
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

  const { data: authData } = await adminClient.auth.admin.getUserById(target.user_id);
  const isSelf = target.user_id === ctx.userId;
  const isSuperadmin = readSuperadminFlag(authData.user?.app_metadata);
  const role = target.role as FamilyRole;
  const allowed = memberPermissions(ctx.actor, { role, isSelf, isSuperadmin })[action];

  if (!allowed) {
    if (isSelf) return { ok: false, error: SELF_MESSAGES[action] };
    if (isSuperadmin) return { ok: false, error: 'Nadie puede gestionar al superadmin.' };
    if (action === 'deleteAccount') {
      return { ok: false, error: 'Solo el superadmin puede borrar cuentas.' };
    }
    if (role === 'admin') {
      return { ok: false, error: 'Solo el superadmin puede gestionar a otro admin.' };
    }
    return { ok: false, error: 'No tenés permiso para hacer esto.' };
  }

  return {
    ok: true,
    target: { id: target.id as string, userId: target.user_id as string, role },
    authUser: {
      email: authData.user?.email ?? null,
      userMetadata: (authData.user?.user_metadata as Record<string, unknown> | null) ?? {},
    },
  };
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
  const superadminIds = new Set<string>();
  for (const id of userIds) {
    // Una llamada por user — la cantidad de miembros por familia es chica
    // (5-10 típicamente), no vale la pena un RPC custom.
    const { data: u } = await adminClient.auth.admin.getUserById(id);
    if (u?.user?.email) emailByUserId.set(id, u.user.email);
    if (readSuperadminFlag(u?.user?.app_metadata)) superadminIds.add(id);
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
    isSuperadmin: superadminIds.has(r.user_id as string),
  }));
}

/**
 * Crea un usuario nuevo en auth.users (con email confirmado y contraseña
 * temporal generada por el server) y lo agrega como miembro del family_group
 * del admin que llamó. Solo el superadmin puede crear admins.
 *
 * Devuelve la contraseña temporal **una sola vez** — el admin la copia y la
 * comparte por un canal seguro. Después no se puede recuperar.
 */
export async function createMemberAction(
  input: CreateMemberAsSuperadminInput,
): Promise<CreateMemberResult> {
  const parsed = createMemberAsSuperadminSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? 'Datos inválidos.',
      ...(issue?.path[0] && typeof issue.path[0] === 'string'
        ? { field: issue.path[0] as keyof CreateMemberAsSuperadminInput }
        : {}),
    };
  }
  const data = parsed.data;

  const ctx = await getCallerAdminContext();
  if (!ctx) {
    return { ok: false, error: 'Solo un admin puede crear miembros.' };
  }
  if (!assignableRoles(ctx.actor).includes(data.role)) {
    return { ok: false, error: 'Solo el superadmin puede crear admins.', field: 'role' };
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
        isSuperadmin: false,
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
      isSuperadmin: false,
    },
  };
}

/**
 * Soft-delete de una membership. El user en auth.users sigue existiendo
 * (por si después lo querés reactivar) pero pierde acceso al family_group.
 * No podés sacarte a vos misma; a otro admin solo lo saca el superadmin.
 */
export async function removeMemberAction(
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getCallerAdminContext();
  if (!ctx) {
    return { ok: false, error: 'Solo un admin puede sacar miembros.' };
  }

  const loaded = await loadManagedTarget(ctx, membershipId, 'remove');
  if (!loaded.ok) return loaded;

  const { error } = await createAdminClient()
    .from('family_memberships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', loaded.target.id);

  if (error) return { ok: false, error: 'No pudimos sacar al miembro.' };

  revalidatePath('/familia');
  return { ok: true };
}

/**
 * Cambia el rol de un miembro existente. Reglas (ver `@/lib/family-permissions`):
 *   - Solo admin puede, y nunca sobre su propio rol.
 *   - Cambiar el rol de otro admin, o nombrar admin a alguien, solo lo
 *     puede hacer el superadmin.
 */
export async function updateMemberRoleAction(
  membershipId: string,
  newRole: FamilyMemberRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = familyRoleSchema.safeParse(newRole);
  if (!parsed.success) return { ok: false, error: 'Rol inválido.' };

  const ctx = await getCallerAdminContext();
  if (!ctx) return { ok: false, error: 'Solo un admin puede cambiar roles.' };
  if (!assignableRoles(ctx.actor).includes(parsed.data)) {
    return { ok: false, error: 'Solo el superadmin puede nombrar admins.' };
  }

  const loaded = await loadManagedTarget(ctx, membershipId, 'changeRole');
  if (!loaded.ok) return loaded;

  const { error } = await createAdminClient()
    .from('family_memberships')
    .update({ role: parsed.data })
    .eq('id', loaded.target.id);

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
 * No se puede resetear la propia contraseña; la de otro admin, solo el
 * superadmin.
 */
export async function resetMemberPasswordAction(
  membershipId: string,
): Promise<{ ok: true; tempPassword: string; email: string } | { ok: false; error: string }> {
  const ctx = await getCallerAdminContext();
  if (!ctx) return { ok: false, error: 'Solo un admin puede resetear contraseñas.' };

  const loaded = await loadManagedTarget(ctx, membershipId, 'resetPassword');
  if (!loaded.ok) return loaded;
  if (!loaded.authUser.email) {
    return { ok: false, error: 'No encontramos la cuenta del miembro.' };
  }

  const tempPassword = generateTempPassword();
  const { error: updateErr } = await createAdminClient().auth.admin.updateUserById(
    loaded.target.userId,
    {
      password: tempPassword,
      user_metadata: { ...loaded.authUser.userMetadata, must_change_password: true },
    },
  );

  if (updateErr) {
    return { ok: false, error: 'No pudimos resetear la contraseña.' };
  }

  revalidatePath('/familia');
  return { ok: true, tempPassword, email: loaded.authUser.email };
}

/**
 * Borra la cuenta de un miembro (solo superadmin). Primero intenta el
 * borrado definitivo de auth.users, que arrastra su membresía. Si la cuenta
 * tiene historial que la base no deja borrar (por ejemplo dosis de
 * medicamentos que cargó), la da de baja en Supabase Auth: no puede volver
 * a entrar, su email queda libre y los registros de la familia se conservan.
 */
export async function deleteMemberAccountAction(
  membershipId: string,
): Promise<{ ok: true; mode: 'deleted' | 'deactivated' } | { ok: false; error: string }> {
  const ctx = await getCallerAdminContext();
  if (!ctx) return { ok: false, error: 'Solo un admin puede borrar cuentas.' };

  const loaded = await loadManagedTarget(ctx, membershipId, 'deleteAccount');
  if (!loaded.ok) return loaded;

  const adminClient = createAdminClient();
  const { data: otherFamilies } = await adminClient
    .from('family_memberships')
    .select('id')
    .eq('user_id', loaded.target.userId)
    .neq('family_group_id', ctx.familyGroupId)
    .is('deleted_at', null)
    .limit(1);
  if (otherFamilies && otherFamilies.length > 0) {
    return { ok: false, error: 'Esa cuenta también está en otra familia: sacala de la tuya.' };
  }

  const hard = await adminClient.auth.admin.deleteUser(loaded.target.userId);
  if (!hard.error) {
    revalidatePath('/familia');
    return { ok: true, mode: 'deleted' };
  }

  const soft = await adminClient.auth.admin.deleteUser(loaded.target.userId, true);
  if (soft.error) {
    return { ok: false, error: 'No pudimos borrar la cuenta.' };
  }
  await adminClient
    .from('family_memberships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', loaded.target.id);

  revalidatePath('/familia');
  return { ok: true, mode: 'deactivated' };
}
