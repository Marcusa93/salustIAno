'use server';

import { type SignupInput, signupSchema } from '@/lib/validators/auth';

type SignupResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof SignupInput | 'root', string>> };

export async function signupAction(data: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(data);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        passwordConfirm: fieldErrors.passwordConfirm?.[0],
        familyName: fieldErrors.familyName?.[0],
        displayName: fieldErrors.displayName?.[0],
      },
    };
  }

  // TODO: conectar con Supabase Auth
  // const { error } = await supabase.auth.signUp({ email, password, options: { data: { displayName, familyName } } })

  return { ok: true };
}
