import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

const PUBLIC_ROUTES = new Set<string>(['/login', '/signup', '/auth/callback', '/auth/confirm']);

const AUTH_ROUTES = new Set<string>(['/login', '/signup']);

/**
 * Refresca la sesión de Supabase en cada request y aplica las redirecciones
 * básicas según el estado de autenticación.
 *
 * ⚠️  CRÍTICO — esto es lo que mantiene la sesión viva en SSR. No agregar
 * más lógica acá: todo lo que sea de dominio (permisos finos, banners,
 * feature flags) va en layouts o Server Actions, no en el proxy.
 *
 * Reglas:
 *   - Rutas públicas: /login, /signup, /auth/callback, /auth/confirm.
 *   - `/` también queda accesible sin sesión (landing).
 *   - No autenticado en ruta privada → redirect a /login con `?next=<url>`.
 *   - Autenticado entrando a /login o /signup → redirect a /home.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() decodifica el JWT localmente (sin round-trip) si el
  // proyecto tiene asymmetric JWT signing keys habilitadas; si no, hace un
  // fetch a Supabase. En ambos casos refresca el token cuando hace falta.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = data?.claims != null;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.has(pathname) || pathname === '/';
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  if (!isAuthenticated && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAuthRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/home';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
