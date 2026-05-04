import type { NextConfig } from 'next';

// Extraemos el hostname del Supabase URL para dejar que `next/image` consuma
// signed URLs sin warning. Si no está seteado (build time en CI), seguimos
// sin remotePatterns — la app igual sirve las fotos vía <img> de fallback.
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Server Actions: subimos el bodySizeLimit del default 1mb a 50mb porque
  // /album acepta fotos hasta 20MB cada una y el upload es batch (varias
  // fotos en un solo formData → puede totalizar ~50MB).
  // En el server action seguimos validando file.size <= 20MB por foto y
  // descartamos las que se pasan, así que esto no expone superficie de
  // abuso — solo evita el rechazo prematuro de Next.
  // Long term: migrar a uploads directos al Storage con signed URLs así no
  // pasan por Next/Vercel — pero por ahora batch via action funciona ok.
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/**',
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // El service worker del PWA no debería cachearse para que recibamos
      // updates apenas se publican. Lo servimos con no-cache.
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
