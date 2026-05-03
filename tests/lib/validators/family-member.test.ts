import {
  type CreateMemberInput,
  createMemberSchema,
  memberRoleSchema,
} from '@/lib/validators/family-member';
import { describe, expect, it } from 'vitest';

describe('memberRoleSchema', () => {
  it('acepta caregiver, family y viewer', () => {
    expect(memberRoleSchema.safeParse('caregiver').success).toBe(true);
    expect(memberRoleSchema.safeParse('family').success).toBe(true);
    expect(memberRoleSchema.safeParse('viewer').success).toBe(true);
  });

  it('rechaza admin (no se asigna por formulario)', () => {
    expect(memberRoleSchema.safeParse('admin').success).toBe(false);
  });
});

describe('createMemberSchema', () => {
  const valid: CreateMemberInput = {
    email: 'ana@ejemplo.com',
    displayName: 'Ana',
    relationship: 'mamá',
    role: 'family',
  };

  it('acepta un input completo válido', () => {
    expect(createMemberSchema.safeParse(valid).success).toBe(true);
  });

  it('normaliza el email a lowercase y trim', () => {
    const r = createMemberSchema.parse({ ...valid, email: '  ANA@EJEMPLO.com  ' });
    expect(r.email).toBe('ana@ejemplo.com');
  });

  it('trimea el displayName', () => {
    const r = createMemberSchema.parse({ ...valid, displayName: '  Ana  ' });
    expect(r.displayName).toBe('Ana');
  });

  it('relationship vacío se vuelve undefined', () => {
    const r = createMemberSchema.parse({ ...valid, relationship: '' });
    expect(r.relationship).toBeUndefined();
  });

  it('relationship omitido es undefined', () => {
    const { relationship: _omit, ...without } = valid;
    const r = createMemberSchema.parse(without);
    expect(r.relationship).toBeUndefined();
  });

  it('rechaza email mal formado', () => {
    expect(createMemberSchema.safeParse({ ...valid, email: 'no-es-email' }).success).toBe(false);
  });

  it('rechaza displayName vacío', () => {
    expect(createMemberSchema.safeParse({ ...valid, displayName: '' }).success).toBe(false);
  });

  it('rechaza displayName demasiado largo', () => {
    expect(createMemberSchema.safeParse({ ...valid, displayName: 'a'.repeat(61) }).success).toBe(
      false,
    );
  });

  it('rechaza role admin', () => {
    expect(createMemberSchema.safeParse({ ...valid, role: 'admin' as never }).success).toBe(false);
  });
});
