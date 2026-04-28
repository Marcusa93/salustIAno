'use client';

import { cn } from '@/lib/utils';
import { Baby, BookHeart, Home, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/cuidar', label: 'Cuidar', icon: Baby },
  { href: '/timeline', label: 'Recordar', icon: BookHeart },
  { href: '/crear', label: 'Crear', icon: Sparkles },
  { href: '/familia', label: 'Familia', icon: Users },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-border border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Navegación principal"
    >
      <div className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 py-2 font-medium text-xs transition-colors',
                'transition-transform duration-150 active:scale-95',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
