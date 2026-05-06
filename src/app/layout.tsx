import { BackgroundMusic } from '@/components/salu/background-music';
import { Toaster } from '@/components/ui/sonner';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  fallback: ['Newsreader', 'Georgia', 'serif'],
});

export const metadata: Metadata = {
  // TODO: set NEXT_PUBLIC_SITE_URL in production (e.g. https://salu.app)
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Salu — un lugar para Salustiano',
    template: '%s · Salu',
  },
  description:
    'Salu es la casa donde vamos a guardar todo lo de Salustiano cuando llegue. Hecho con cuidado en Tucumán.',
  applicationName: 'Salu',
  appleWebApp: {
    capable: true,
    title: 'Salu',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Salu — un lugar para Salustiano',
    description:
      'Salu es la casa donde vamos a guardar todo lo de Salustiano cuando llegue. Hecho con cuidado en Tucumán.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'Salu',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Salu — un lugar para Salustiano',
    description:
      'Salu es la casa donde vamos a guardar todo lo de Salustiano cuando llegue. Hecho con cuidado en Tucumán.',
  },
};

/**
 * Viewport + theme color. Next ≥ 14 los pide separados de `metadata` para
 * que la metadata estática quede sin runtime. El theme_color del manifest
 * lo respeta el splash; este `themeColor` controla la barra del navegador
 * (Android Chrome) y la barra de estado del PWA cuando está abierto.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe2' },
    { media: '(prefers-color-scheme: dark)', color: '#1a2436' },
  ],
  // PWA-friendly: evitar que el usuario haga zoom accidental al tipear.
  // Mantenemos viewport-fit=cover para que el safe-area-inset funcione.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={['system', 'light', 'dark', 'night']}
        >
          {children}
          <BackgroundMusic />
          {/* Toasts en top-center — el bottom queda denso entre bottom-nav,
              FloatingSalu y safe-area-inset; arriba se ven sin tapar nada
              y son fáciles de descartar. */}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
