import {
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/lib/validators/auth';
import { describe, expect, it } from 'vitest';

describe('loginSchema', () => {
  it('parsea un email y password válidos', () => {
    const result = loginSchema.safeParse({
      email: 'marco@example.com',
      password: 'contraseña123',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un email inválido con mensaje en español', () => {
    const result = loginSchema.safeParse({
      email: 'no-es-un-email',
      password: 'contraseña123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.flatten().fieldErrors.email?.[0];
      expect(emailError).toBeTruthy();
      expect(emailError).toMatch(/email/i);
    }
  });

  it('rechaza contraseña menor a 8 caracteres con mensaje en español', () => {
    const result = loginSchema.safeParse({
      email: 'marco@example.com',
      password: 'corta',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.flatten().fieldErrors.password?.[0];
      expect(passwordError).toBeTruthy();
      expect(passwordError).toMatch(/8/);
    }
  });
});

describe('signupSchema', () => {
  const validData = {
    email: 'marco@example.com',
    password: 'Contraseña123',
    passwordConfirm: 'Contraseña123',
    familyName: 'Los Rossi',
    displayName: 'Marco',
  };

  it('parsea datos de registro válidos', () => {
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rechaza contraseñas que no coinciden con mensaje en español', () => {
    const result = signupSchema.safeParse({
      ...validData,
      passwordConfirm: 'OtraContraseña123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten();
      const confirmError = errors.fieldErrors.passwordConfirm?.[0];
      expect(confirmError).toBeTruthy();
      expect(confirmError).toMatch(/coincid/i);
    }
  });

  it('rechaza contraseña corta con mensaje en español', () => {
    const result = signupSchema.safeParse({
      ...validData,
      password: 'Corta1',
      passwordConfirm: 'Corta1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.flatten().fieldErrors.password?.[0];
      expect(passwordError).toBeTruthy();
      expect(passwordError).toMatch(/8/);
    }
  });
});

describe('requestResetSchema', () => {
  it('acepta email válido', () => {
    expect(requestResetSchema.safeParse({ email: 'marco@example.com' }).success).toBe(true);
  });

  it('rechaza email vacío', () => {
    expect(requestResetSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('rechaza email malformado', () => {
    expect(requestResetSchema.safeParse({ email: 'no-email' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const valid = {
    password: 'Contraseña123',
    passwordConfirm: 'Contraseña123',
  };

  it('acepta password fuerte y confirmación coincidente', () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza si las contraseñas no coinciden', () => {
    const result = resetPasswordSchema.safeParse({
      ...valid,
      passwordConfirm: 'Otra123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.flatten().fieldErrors.passwordConfirm?.[0];
      expect(err).toMatch(/coincid/i);
    }
  });

  it('rechaza password sin mayúscula', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'contraseña123',
        passwordConfirm: 'contraseña123',
      }).success,
    ).toBe(false);
  });

  it('rechaza password sin número', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'Contraseña',
        passwordConfirm: 'Contraseña',
      }).success,
    ).toBe(false);
  });

  it('rechaza password corto', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'Cort1',
        passwordConfirm: 'Cort1',
      }).success,
    ).toBe(false);
  });
});
