import { loginSchema, signupSchema } from '@/lib/validators/auth';
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
