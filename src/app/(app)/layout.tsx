import { BottomNav } from '@/components/salu/bottom-nav';
import { CommandPalette, CommandPaletteTrigger } from '@/components/salu/command-palette';
import { DesktopSidebar } from '@/components/salu/desktop-sidebar';
import { InstallHint } from '@/components/salu/install-hint';
import { MobileMenu } from '@/components/salu/mobile-menu';
import { SaluLogo } from '@/components/salu/salu-logo';
import { SoftBackdrop } from '@/components/salu/soft-backdrop';
import { UserMenu } from '@/components/salu/user-menu';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import type * as React from 'react';
import { FloatingSalu } from './_floating-salu/floating-salu';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Skip-to-content para teclado / lectores de pantalla. Invisible hasta
          que recibe foco; entonces salta a #main. */}
      <a
        href="#main"
        className="sr-only fixed top-2 left-2 z-50 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm shadow focus:not-sr-only focus:outline-2 focus:outline-ring focus:outline-offset-2"
      >
        Saltar al contenido
      </a>
      <div className="print:hidden">
        <SoftBackdrop />
      </div>
      <header className="sticky top-0 z-40 border-border/40 border-b bg-background/70 backdrop-blur-xl supports-backdrop-blur:bg-background/60 print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <MobileMenu />
          <Link href="/home" aria-label="Ir al inicio">
            <SaluLogo size="default" />
          </Link>
          <div className="flex-1" />
          <CommandPaletteTrigger />
          <UserMenu />
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 sm:px-6 print:max-w-none print:px-0">
        <div className="print:hidden">
          <DesktopSidebar />
        </div>
        <main id="main" className="min-w-0 flex-1 py-8 pb-20 md:pb-8 print:py-0 print:pb-0">
          {children}
        </main>
      </div>

      <Separator className="print:hidden" />
      <footer className="py-4 text-center text-muted-foreground text-xs print:hidden">
        Hecho con cuidado en Tucumán
      </footer>

      <div className="print:hidden">
        <BottomNav />
        <InstallHint />
        <FloatingSalu />
        <CommandPalette />
      </div>
    </div>
  );
}
