import { ThemeProvider } from '@/components/salu/theme-provider';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Salu',
    template: '%s · Salu',
  },
  description: 'Sistema operativo familiar para acompañar la crianza de Salustiano.',
  applicationName: 'Salu',
  authors: [{ name: 'Familia Salu' }],
  generator: 'Next.js',
  keywords: ['crianza', 'familia', 'bebé', 'memoria', 'cuidado'],
  robots: {
    index: false,
    follow: false,
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7fbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#10182a' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
