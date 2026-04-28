import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// TODO: Implementar OAuth callback con Supabase
// Ref: https://supabase.com/docs/guides/auth/server-side/nextjs
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    // TODO: supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
