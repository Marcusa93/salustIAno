import { SaluLogo } from '@/components/salu/salu-logo';
import Link from 'next/link';
import type * as React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex justify-center px-6 py-8">
        <Link href="/" aria-label="Ir al inicio">
          <SaluLogo size="default" />
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <div className="w-full max-w-sm animate-page-enter">{children}</div>
      </main>

      <footer className="py-6 text-center text-muted-foreground text-xs">
        Hecho con cuidado en Tucumán
      </footer>
    </div>
  );
}
