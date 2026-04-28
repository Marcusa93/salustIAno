import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Maneja el link que viene en el email de confirmación de Supabase.
 *
 * Supabase manda al usuario a `/auth/confirm?token_hash=...&type=signup&next=...`.
 * Acá llamamos a `verifyOtp` con esos parámetros; en éxito el cookie de
 * sesión se setea y redirigimos al `next` (default /home).
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
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/home';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
