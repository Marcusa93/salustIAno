import { Toaster } from '@/components/ui/sonner';
import type { Metadata } from 'next';
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
          <Toaster position="bottom-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
