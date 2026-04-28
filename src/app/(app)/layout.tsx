import { BottomNav } from '@/components/salu/bottom-nav';
import { DesktopSidebar } from '@/components/salu/desktop-sidebar';
import { MobileMenu } from '@/components/salu/mobile-menu';
import { SaluLogo } from '@/components/salu/salu-logo';
import { UserMenu } from '@/components/salu/user-menu';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import type * as React from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-border border-b bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <MobileMenu />
          <Link href="/home" aria-label="Ir al inicio">
            <SaluLogo size="default" />
          </Link>
          <div className="flex-1" />
          <UserMenu />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 sm:px-6">
        <DesktopSidebar />
        <main className="min-w-0 flex-1 py-8 pb-20 md:pb-8">{children}</main>
      </div>

      <Separator />
      <footer className="py-4 text-center text-muted-foreground text-xs">
        Hecho con cuidado en Tucumán
      </footer>

      <BottomNav />
    </div>
  );
}
