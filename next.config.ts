import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      // En el futuro, agregar el dominio de Supabase Storage cuando se configure.
      // {
      //   protocol: 'https',
      //   hostname: '<project>.supabase.co',
      //   pathname: '/storage/v1/object/public/**',
      // },
    ],
  },
  // Cabeceras de seguridad por defecto. Se afinan cuando entren cookies, CSP estricta, etc.
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
    ];
  },
};

export default nextConfig;
