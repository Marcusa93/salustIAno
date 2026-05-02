import { IntroVideoBackground } from '@/components/salu/intro-video-background';
import { SaluLogo } from '@/components/salu/salu-logo';
import Link from 'next/link';
import type * as React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <IntroVideoBackground />

      <header className="flex justify-center px-6 py-8">
        <Link href="/" aria-label="Ir al inicio">
          <SaluLogo size="default" />
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <div className="w-full max-w-sm animate-page-enter rounded-3xl border border-white/40 bg-card/75 p-7 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.30),0_8px_24px_-12px_rgba(15,23,42,0.20)] backdrop-blur-2xl sm:p-9 dark:border-white/10 dark:bg-card/60">
          {children}
        </div>
      </main>

      <footer className="py-6 text-center text-muted-foreground text-xs">
        Hecho con cuidado en Tucumán
      </footer>
    </div>
  );
}
