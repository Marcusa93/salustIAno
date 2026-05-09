import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/proxy-helper';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Excluimos:
    //   - assets de Next (_next/static, _next/image)
    //   - SEO básico (robots, sitemap, favicon)
    //   - PWA / manifest: manifest.webmanifest, sw.js, workbox-*.js
    //   - extensiones binarias comunes (svg, png, ...).
    // Sin esto, el browser pide /manifest.webmanifest y el proxy lo
    // redirige a /login si la cookie de sesión no acompañó al request
    // — el browser entonces parsea HTML como JSON y tira "Manifest:
    // Line 1, column 1, Syntax error".
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov|m4a|mp3|woff|woff2|ttf|otf|webmanifest)$).*)',
  ],
};
