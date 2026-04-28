'use server';

import { createClient } from '@/lib/supabase/server';
import { type LoginInput, loginSchema } from '@/lib/validators/auth';
import type { Route } from 'next';
import { redirect } from 'next/navigation';

type LoginResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof LoginInput | 'root', string>> };

/**
 * Inicia sesión con email + contraseña contra Supabase Auth.
 *
 * En éxito: redirect server-side a `next` (si vino del proxy con
 * `?next=/crear/cuento`) o a /home. El redirect ocurre fuera de
 * try/catch porque Next lo implementa lanzando una excepción especial.
 *
 * En fallo: devuelve LoginResult con errors. El cliente muestra toast.
 */
export async function loginAction(data: LoginInput, next?: string): Promise<LoginResult> {
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        ok: false,
        errors: { root: 'Confirmá tu email primero. Revisá tu casilla.' },
      };
    }
    if (error.message.toLowerCase().includes('invalid login')) {
      return {
        ok: false,
        errors: { root: 'Email o contraseña incorrectos.' },
      };
    }
    return { ok: false, errors: { root: 'No pudimos iniciarte la sesión. Probá de nuevo.' } };
  }

  // Validamos `next` para evitar open redirects: solo paths internos.
  // Cast a Route porque typedRoutes pide rutas literales y `next` es
  // dinámico; la validación previa garantiza que es path interno.
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/home';
  redirect(safeNext as Route);
}
