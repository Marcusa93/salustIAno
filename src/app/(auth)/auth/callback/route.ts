import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Callback de OAuth (cuando se sume un provider tipo Google o GitHub) y
 * de magic link. Supabase devuelve `?code=<authcode>` que canjeamos por
 * sesión vía `exchangeCodeForSession`.
 *
 * No usado por el flow email + password actual (ese va por /auth/confirm
 * con verifyOtp). Lo dejamos cableado por si se suma OAuth más adelante.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback_missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/home';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
