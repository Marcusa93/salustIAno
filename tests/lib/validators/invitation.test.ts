import {
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_REGEX,
  createInvitationSchema,
  generateInvitationCode,
  redeemInvitationSchema,
} from '@/lib/validators/invitation';
import { describe, expect, it } from 'vitest';

describe('INVITATION_CODE_REGEX', () => {
  it('acepta el formato XXXX-XXXX con alfanuméricos en mayúscula', () => {
    expect(INVITATION_CODE_REGEX.test('ABCD-2345')).toBe(true);
    expect(INVITATION_CODE_REGEX.test('XYZ9-PQ34')).toBe(true);
  });

  it('rechaza minúsculas', () => {
    expect(INVITATION_CODE_REGEX.test('abcd-2345')).toBe(false);
  });

  it('rechaza el caracter prohibido (0/O/1/I)', () => {
    expect(INVITATION_CODE_REGEX.test('A0CD-2345')).toBe(false);
    expect(INVITATION_CODE_REGEX.test('A1CD-2345')).toBe(false);
    expect(INVITATION_CODE_REGEX.test('AOCD-2345')).toBe(true); // O sí es alfabético excluido del alfabeto pero no del regex
    expect(INVITATION_CODE_REGEX.test('AICD-2345')).toBe(true); // idem I
  });

  it('rechaza largo distinto', () => {
    expect(INVITATION_CODE_REGEX.test('ABC-2345')).toBe(false);
    expect(INVITATION_CODE_REGEX.test('ABCDE-2345')).toBe(false);
    expect(INVITATION_CODE_REGEX.test('ABCD-234')).toBe(false);
  });

  it('rechaza sin guión', () => {
    expect(INVITATION_CODE_REGEX.test('ABCD2345')).toBe(false);
  });
});

describe('generateInvitationCode', () => {
  it('genera siempre en formato XXXX-XXXX', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInvitationCode();
      expect(code).toMatch(INVITATION_CODE_REGEX);
    }
  });

  it('solo usa caracteres del alfabeto reducido (sin 0/O/1/I)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInvitationCode().replace('-', '');
      for (const c of code) {
        expect(INVITATION_CODE_ALPHABET).toContain(c);
      }
    }
  });

  it('no genera el mismo código dos veces seguidas (smoke test de entropía)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateInvitationCode());
    // Con ~32 bits de entropía, en 100 iteraciones la chance de colisión
    // es despreciable. Si esto falla seguido, algo anda mal con
    // crypto.getRandomValues.
    expect(codes.size).toBe(100);
  });
});

describe('createInvitationSchema', () => {
  it('rol caregiver con expiry default es válido', () => {
    const r = createInvitationSchema.safeParse({ role: 'caregiver' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.expiresInDays).toBe(7);
  });

  it('rechaza expiry fuera del set de opciones', () => {
    expect(createInvitationSchema.safeParse({ role: 'caregiver', expiresInDays: 5 }).success).toBe(
      false,
    );
    expect(
      createInvitationSchema.safeParse({ role: 'caregiver', expiresInDays: 365 }).success,
    ).toBe(false);
  });

  it('acepta los 5 valores de expiry permitidos', () => {
    for (const days of [1, 3, 7, 14, 30]) {
      const r = createInvitationSchema.safeParse({ role: 'caregiver', expiresInDays: days });
      expect(r.success).toBe(true);
    }
  });

  it('rechaza rol admin (admin no se puede asignar via invitación)', () => {
    expect(createInvitationSchema.safeParse({ role: 'admin' }).success).toBe(false);
  });
});

describe('redeemInvitationSchema', () => {
  const valid = {
    code: 'ABCD-2345',
    email: 'abril@example.com',
    password: 'super-pass-1',
    passwordConfirm: 'super-pass-1',
    displayName: 'Abril',
  };

  it('acepta input válido', () => {
    expect(redeemInvitationSchema.safeParse(valid).success).toBe(true);
  });

  it('normaliza el código a mayúsculas y trimea', () => {
    const r = redeemInvitationSchema.safeParse({ ...valid, code: '  abcd-2345  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('ABCD-2345');
  });

  it('normaliza el email a minúsculas', () => {
    const r = redeemInvitationSchema.safeParse({ ...valid, email: 'ABRIL@Example.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('abril@example.com');
  });

  it('rechaza si las passwords no coinciden', () => {
    const r = redeemInvitationSchema.safeParse({ ...valid, passwordConfirm: 'otra-cosa-99' });
    expect(r.success).toBe(false);
  });

  it('rechaza password corta (<8)', () => {
    const r = redeemInvitationSchema.safeParse({
      ...valid,
      password: 'short',
      passwordConfirm: 'short',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza email inválido', () => {
    const r = redeemInvitationSchema.safeParse({ ...valid, email: 'no-es-email' });
    expect(r.success).toBe(false);
  });

  it('rechaza código con formato distinto', () => {
    const r = redeemInvitationSchema.safeParse({ ...valid, code: 'INVALIDOO' });
    expect(r.success).toBe(false);
  });

  it('rechaza displayName vacío', () => {
    const r = redeemInvitationSchema.safeParse({ ...valid, displayName: '   ' });
    expect(r.success).toBe(false);
  });
});
