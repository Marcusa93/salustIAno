'use server';

import { type LoginInput, loginSchema } from '@/lib/validators/auth';

type LoginResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof LoginInput | 'root', string>> };

export async function loginAction(data: LoginInput): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(data);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  // TODO: conectar con Supabase Auth
  // const { error } = await supabase.auth.signInWithPassword({ email, password })

  return { ok: true };
}
