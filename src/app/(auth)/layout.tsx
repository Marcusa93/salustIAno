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
        <div className="w-full max-w-sm animate-page-enter rounded-2xl border border-border/50 bg-card/85 p-6 shadow-xl shadow-black/5 backdrop-blur-md sm:p-8">
          {children}
        </div>
      </main>

      <footer className="py-6 text-center text-muted-foreground text-xs">
        Hecho con cuidado en Tucumán
      </footer>
    </div>
  );
}
