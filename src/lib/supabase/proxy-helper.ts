import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

const PUBLIC_ROUTES = new Set<string>([
  '/login',
  '/signup',
  '/recuperar',
  '/restablecer',
  '/auth/callback',
  '/auth/confirm',
  // Endpoint de la Alexa Skill: lo llama Amazon (máquina-a-máquina, sin cookie
  // de sesión). Su seguridad la maneja el propio route handler (applicationId +
  // firma de Alexa), no el proxy — por eso va como público.
  '/api/alexa',
]);

const AUTH_ROUTES = new Set<string>(['/login', '/signup']);

/**
 * Rutas en las que dejamos pasar a un user que tiene `must_change_password`
 * sin redirigir a /bienvenida. Necesitamos:
 *   - /bienvenida (la página misma del onboarding)
 *   - /logout, /api/* (acción de logout y endpoints internos)
 *   - rutas públicas (login, recuperar, etc.) por si terminan acá vía algún
 *     redirect raro
 */
const ONBOARDING_ALLOWED_PREFIXES = ['/bienvenida', '/api', '/auth'];

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

  // Toda redirección lleva las cookies que Supabase haya renovado en este
  // request: si no, el navegador reusa el token viejo y la sesión se cae.
  const redirectTo = (path: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    if (next) url.searchParams.set('next', next);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  const { pathname } = request.nextUrl;
  // Las rutas /compartir/cancion/[token] y /compartir/cuento/[token] son
  // públicas — accedidas con un token random sin necesidad de auth para
  // que cualquier persona con el link (familia extensa) pueda escuchar
  // o leer.
  const isShareRoute = pathname.startsWith('/compartir/') || pathname.startsWith('/salu/');
  const isPublic = PUBLIC_ROUTES.has(pathname) || pathname === '/' || isShareRoute;
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  if (!isAuthenticated && !isPublic) {
    return redirectTo('/login', pathname + request.nextUrl.search);
  }

  if (isAuthenticated && isAuthRoute) {
    return redirectTo('/home');
  }

  // Onboarding forzado: si la persona fue creada por un admin con la
  // contraseña temporal, le pedimos cambiarla antes de mostrarle el resto.
  // El flag vive en user_metadata.must_change_password (admin lo set en
  // createMemberAction; /bienvenida lo limpia tras cambiar la pass).
  if (isAuthenticated && data?.claims) {
    const meta = (data.claims as { user_metadata?: { must_change_password?: boolean } })
      .user_metadata;
    let mustChange = meta?.must_change_password === true;
    // El JWT puede quedar viejo hasta 1 h después de limpiar el flag. Si dice
    // que falta cambiar la clave, lo confirmamos contra Auth: si ya no hace
    // falta, refrescamos la sesión en vez de rebotar a /bienvenida (y evitamos
    // el loop /home ↔ /bienvenida, porque la página lee el dato fresco).
    if (mustChange) {
      const { data: fresh } = await supabase.auth.getUser();
      if (fresh.user && fresh.user.user_metadata?.must_change_password !== true) {
        await supabase.auth.refreshSession();
        mustChange = false;
      }
    }
    const isAllowed = ONBOARDING_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
    if (mustChange && !isAllowed) {
      return redirectTo('/bienvenida');
    }
    // Si ya no necesita cambiar la pass pero está en /bienvenida, lo sacamos.
    if (!mustChange && pathname === '/bienvenida') {
      return redirectTo('/home');
    }
  }

  return response;
}
