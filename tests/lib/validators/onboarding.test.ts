import { completeOnboardingSchema } from '@/lib/validators/onboarding';
import { describe, expect, it } from 'vitest';

describe('completeOnboardingSchema', () => {
  const valid = { password: 'Segura123', passwordConfirm: 'Segura123' };

  it('acepta una pass de 8+ chars con mayúscula y número', () => {
    expect(completeOnboardingSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza pass de menos de 8 chars', () => {
    const r = completeOnboardingSchema.safeParse({ password: 'Ab1', passwordConfirm: 'Ab1' });
    expect(r.success).toBe(false);
  });

  it('rechaza pass sin mayúscula', () => {
    const r = completeOnboardingSchema.safeParse({
      password: 'segura123',
      passwordConfirm: 'segura123',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza pass sin número', () => {
    const r = completeOnboardingSchema.safeParse({
      password: 'SeguraAB',
      passwordConfirm: 'SeguraAB',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza si las contraseñas no coinciden', () => {
    const r = completeOnboardingSchema.safeParse({
      password: 'Segura123',
      passwordConfirm: 'Segura1234',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('passwordConfirm'))).toBe(true);
    }
  });
});
