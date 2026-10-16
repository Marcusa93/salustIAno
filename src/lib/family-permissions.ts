/**
 * Qué puede hacer cada quien con los miembros de su familia.
 *
 * - Un admin gestiona a cuidadores, familia y visores: cambia su rol, les
 *   resetea la contraseña y los saca de la familia.
 * - El superadmin (flag `superadmin` en `app_metadata` de Supabase Auth,
 *   que solo se escribe con la secret key) además crea y nombra admins,
 *   gestiona a otros admins y puede borrar cuentas del todo.
 * - Nadie se gestiona a sí mismo desde acá (eso va en /perfil) y nadie
 *   gestiona a un superadmin: así no se puede dejar sin acceso al dueño.
 *
 * Es la única fuente de verdad: la usan las server actions para autorizar
 * y la pantalla de Familia para decidir qué opciones mostrar.
 */

export type FamilyRole = 'admin' | 'caregiver' | 'family' | 'viewer';

export interface FamilyActor {
  role: FamilyRole | null;
  isSuperadmin: boolean;
}

export interface FamilyTarget {
  role: FamilyRole;
  isSelf: boolean;
  isSuperadmin: boolean;
}

export interface MemberPermissions {
  changeRole: boolean;
  resetPassword: boolean;
  remove: boolean;
  deleteAccount: boolean;
}

const NONE: MemberPermissions = {
  changeRole: false,
  resetPassword: false,
  remove: false,
  deleteAccount: false,
};

const BASE_ROLES: FamilyRole[] = ['caregiver', 'family', 'viewer'];

/** Solo el superadmin cuenta como superadmin si además es admin de la familia. */
export function isFamilySuperadmin(actor: FamilyActor): boolean {
  return actor.role === 'admin' && actor.isSuperadmin;
}

/** Roles que el actor puede asignar al crear un miembro o cambiarle el rol. */
export function assignableRoles(actor: FamilyActor): FamilyRole[] {
  if (actor.role !== 'admin') return [];
  return isFamilySuperadmin(actor) ? ['admin', ...BASE_ROLES] : BASE_ROLES;
}

export function memberPermissions(actor: FamilyActor, target: FamilyTarget): MemberPermissions {
  if (actor.role !== 'admin' || target.isSelf || target.isSuperadmin) return NONE;

  const superadmin = isFamilySuperadmin(actor);
  if (target.role === 'admin' && !superadmin) return NONE;

  return {
    changeRole: true,
    resetPassword: true,
    remove: true,
    deleteAccount: superadmin,
  };
}

/** Lee el flag de superadmin de un user de Supabase Auth (app_metadata). */
export function readSuperadminFlag(appMetadata: unknown): boolean {
  if (typeof appMetadata !== 'object' || appMetadata === null) return false;
  return (appMetadata as { superadmin?: unknown }).superadmin === true;
}
