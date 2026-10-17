import { describe, expect, it } from 'vitest';
import {
  type FamilyActor,
  type FamilyTarget,
  assignableRoles,
  memberPermissions,
  readSuperadminFlag,
} from './family-permissions';

const admin: FamilyActor = { role: 'admin', isSuperadmin: false };
const superadmin: FamilyActor = { role: 'admin', isSuperadmin: true };
const caregiver: FamilyActor = { role: 'caregiver', isSuperadmin: false };

const target = (overrides: Partial<FamilyTarget> = {}): FamilyTarget => ({
  role: 'family',
  isSelf: false,
  isSuperadmin: false,
  ...overrides,
});

describe('assignableRoles', () => {
  it('un admin asigna cuidador, familia y visor, pero no admin', () => {
    expect(assignableRoles(admin)).toEqual(['caregiver', 'family', 'viewer']);
  });

  it('el superadmin además puede nombrar admins', () => {
    expect(assignableRoles(superadmin)).toEqual(['admin', 'caregiver', 'family', 'viewer']);
  });

  it('quien no es admin no asigna nada, aunque tenga el flag', () => {
    expect(assignableRoles(caregiver)).toEqual([]);
    expect(assignableRoles({ role: 'family', isSuperadmin: true })).toEqual([]);
  });
});

describe('memberPermissions', () => {
  it('un admin gestiona a no-admins pero no borra cuentas', () => {
    expect(memberPermissions(admin, target())).toEqual({
      changeRole: true,
      resetPassword: true,
      remove: true,
      deleteAccount: false,
    });
  });

  it('un admin no toca a otro admin', () => {
    expect(memberPermissions(admin, target({ role: 'admin' }))).toEqual({
      changeRole: false,
      resetPassword: false,
      remove: false,
      deleteAccount: false,
    });
  });

  it('el superadmin gestiona a otros admins y puede borrar cuentas', () => {
    expect(memberPermissions(superadmin, target({ role: 'admin' }))).toEqual({
      changeRole: true,
      resetPassword: true,
      remove: true,
      deleteAccount: true,
    });
  });

  it('nadie se gestiona a sí mismo desde la lista', () => {
    const self = memberPermissions(superadmin, target({ role: 'admin', isSelf: true }));
    expect(Object.values(self).every((allowed) => !allowed)).toBe(true);
  });

  it('nadie gestiona a un superadmin', () => {
    const other = memberPermissions(superadmin, target({ role: 'admin', isSuperadmin: true }));
    expect(Object.values(other).every((allowed) => !allowed)).toBe(true);
  });

  it('quien no es admin no gestiona a nadie', () => {
    const result = memberPermissions(caregiver, target({ role: 'viewer' }));
    expect(Object.values(result).every((allowed) => !allowed)).toBe(true);
  });
});

describe('readSuperadminFlag', () => {
  it('solo es true con superadmin === true', () => {
    expect(readSuperadminFlag({ superadmin: true })).toBe(true);
    expect(readSuperadminFlag({ superadmin: 'true' })).toBe(false);
    expect(readSuperadminFlag({})).toBe(false);
    expect(readSuperadminFlag(null)).toBe(false);
    expect(readSuperadminFlag(undefined)).toBe(false);
  });
});
