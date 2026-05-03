import { SaluLogo } from '@/components/salu/salu-logo';
import { SoftBackdrop } from '@/components/salu/soft-backdrop';
import Link from 'next/link';
import type * as React from 'react';

/**
 * Layout para rutas públicas /compartir/*. Sin sidebar/bottom-nav ni user
 * menu — la página la abre alguien que no necesariamente tiene cuenta
 * (la abuela, un amigo de la familia). Solo logo + footer + el backdrop.
 */
export default function CompartirLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SoftBackdrop />
      <header className="relative z-10 flex justify-center px-6 py-8">
        <Link href="/" aria-label="Ir al inicio">
          <SaluLogo size="default" />
        </Link>
      </header>
      <div className="relative z-10 flex-1">{children}</div>
      <footer className="relative z-10 py-6 text-center text-muted-foreground text-xs">
        Hecho con cuidado en Tucumán
      </footer>
    </div>
  );
}
