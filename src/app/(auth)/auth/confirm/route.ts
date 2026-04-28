import { ensureFamilyForUser } from '@/lib/bootstrap-family';
import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Maneja el link que viene en el email de confirmación de Supabase.
 *
 * Supabase manda al usuario a `/auth/confirm?token_hash=...&type=signup&next=...`.
 * Acá llamamos a `verifyOtp` con esos parámetros; en éxito el cookie de
 * sesión se setea, garantizamos que tenga family_group + admin membership
 * (bootstrap idempotente) y redirigimos al `next` (default /home).
 *
 * Si falta el token o falla la verificación, redirigimos a /login con un
 * mensaje de error en query.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as
    | 'signup'
    | 'invite'
    | 'magiclink'
    | 'recovery'
    | 'email_change'
    | 'email'
    | null;
  const next = searchParams.get('next') ?? '/home';

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=confirm_invalid_link`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
  }

  // Bootstrap idempotente: si es la primera vez del user, le crea
  // family_group + admin membership leyendo el metadata del signup.
  if (data.user) {
    await ensureFamilyForUser(data.user.id);
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/home';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
